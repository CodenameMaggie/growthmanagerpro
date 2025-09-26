// api/instantly-integration.js
// Vercel serverless function (Node 18+). No external fetch lib needed.

const { createClient } = require('@supabase/supabase-js');

// ---- CORS ----
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---- Config ----
const INSTANTLY_BASE = 'https://api.instantly.ai/api/v2'; // v2 base (Bearer)
const INSTANTLY_KEY = process.env.INSTANTLY_API_V2_KEY || process.env.INSTANTLY_API_KEY; // prefer v2 key

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Optional Supabase (only used if both URL + Service key exist)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSrvKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only key
  const supabase = (supabaseUrl && supabaseSrvKey)
    ? createClient(supabaseUrl, supabaseSrvKey)
    : null;

  try {
    if (!INSTANTLY_KEY) {
      return res.status(500).json({ success: false, error: 'INSTANTLY_API_V2_KEY is not set' });
    }

    if (req.method === 'GET') {
      // 1) Campaigns
      const { campaigns, campaignsStatus } = await fetchCampaignsV2(INSTANTLY_KEY);

      // 2) Leads (workspace-level). We request a small batch so it’s fast.
      const { leads, leadsStatus } = await fetchLeadsV2(INSTANTLY_KEY, { limit: 100 });

      const mocked = campaignsStatus !== 200 || leadsStatus !== 200;

      // 3) Optional: update Supabase (safe, won’t crash your route if schema differs)
      if (supabase) {
        try { await upsertCampaigns(supabase, campaigns); } catch (e) { console.error('upsertCampaigns:', e.message); }
        try { await matchLeadsToProspects(supabase, leads); } catch (e) { console.error('matchLeadsToProspects:', e.message); }
      }

      return res.status(200).json({
        success: true,
        mocked,
        campaigns,
        leads: leads.map(normalizeLeadForUI),
        summary: {
          totalCampaigns: campaigns.length,
          totalLeads: leads.length
        }
      });
    }

    if (req.method === 'POST') {
      // Minimal “send email” passthrough for your button, using v2 Emails
      const { recipientEmail, subject, message, campaignId } = req.body || {};
      if (!recipientEmail || !subject || !message || !campaignId) {
        return res.status(400).json({
          success: false,
          error: 'recipientEmail, subject, message, campaignId are required'
        });
      }
      const emailResult = await sendEmailV2(INSTANTLY_KEY, { recipientEmail, subject, message, campaignId });
      return res.status(200).json({ success: true, emailResult });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Instantly integration fatal error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------
// Instantly v2 helpers
// ---------------------------
async function fetchCampaignsV2(apiKey) {
  const r = await fetch(`${INSTANTLY_BASE}/campaigns`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const status = r.status;
  if (!r.ok) {
    console.error('fetchCampaignsV2 non-200:', status, await safeText(r));
    return { campaigns: [], campaignsStatus: status };
  }
  const json = await r.json();
  // v2 lists typically return { items: [...], next_starting_after: "..." }
  const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
  return { campaigns: items.map(normalizeCampaign), campaignsStatus: status };
}

async function fetchLeadsV2(apiKey, { limit = 100, starting_after } = {}) {
  // v2 “List leads” is POST /api/v2/leads/list with JSON body
  // (docs show Bearer auth; v1 used different patterns). :contentReference[oaicite:1]{index=1}
  const body = JSON.stringify({ limit, starting_after });
  const r = await fetch(`${INSTANTLY_BASE}/leads/list`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body
  });
  const status = r.status;
  if (!r.ok) {
    console.error('fetchLeadsV2 non-200:', status, await safeText(r));
    return { leads: [], leadsStatus: status };
  }
  const json = await r.json();
  const items = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
  return { leads: items, leadsStatus: status };
}

// Optional: v2 Emails (send) (adjust if you later prefer a specific endpoint)
async function sendEmailV2(apiKey, { recipientEmail, subject, message, campaignId }) {
  const r = await fetch(`${INSTANTLY_BASE}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: recipientEmail,
      subject,
      body: message,
      campaign_id: campaignId
    })
  });
  if (!r.ok) {
    throw new Error(`Instantly email send failed: ${r.status} ${await safeText(r)}`);
  }
  return await r.json();
}

// ---------------------------
// Normalizers for your UI
// ---------------------------
function normalizeCampaign(c) {
  // v2 typically returns snake_case fields; keep a minimal set your UI might use
  return {
    id: c.id || c._id || c.uuid || null,
    name: c.name || '',
    status: mapCampaignStatus(c.status),
    // The simple list endpoint may not include these metrics; keep 0 if not present.
    sent: c.sent || 0,
    opened: c.opened || 0,
    replied: c.replied || 0,
    bounced: c.bounced || 0,
    unsubscribed: c.unsubscribed || 0
  };
}

function mapCampaignStatus(code) {
  if (typeof code === 'string') return code;
  const map = { 0: 'paused', 1: 'active' };
  return map[code] ?? 'unknown';
}

function normalizeLeadForUI(l) {
  // Convert typical v2 snake_case to the names your front-end mapper tolerates
  return {
    email: l.email || l.email_address || '',
    firstName: l.first_name || '',
    lastName: l.last_name || '',
    company: l.company_name || '',
    campaignId: l.campaign_id || null,
    status: l.status || '',
    lastMessage: l.last_message || '',
    repliedAt: l.replied_at || null
  };
}

// ---------------------------
// Supabase helpers (safe, optional)
// ---------------------------
async function upsertCampaigns(supabase, campaigns) {
  if (!Array.isArray(campaigns) || !campaigns.length) return;
  for (const c of campaigns) {
    const row = {
      instantly_campaign_id: c.id,
      name: c.name || '',
      total_sent: c.sent || 0,
      opens: c.opened || 0,
      replies: c.replied || 0,
      qualified_leads: 0,
      status: c.status || 'unknown'
    };
    const { error } = await supabase
      .from('campaigns')
      .upsert(row, { onConflict: 'instantly_campaign_id' });

    if (error) console.error('supabase campaigns upsert error:', c.id, error.message);
  }
}

async function matchLeadsToProspects(supabase, leads) {
  if (!Array.isArray(leads) || !leads.length) return [];
  const out = [];
  for (const l of leads) {
    const email = (l.email || '').toLowerCase();
    if (!email) { out.push({ ...l, prospectId: null }); continue; }

    try {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id, name, qualification_score, pipeline_stage')
        .eq('email', email)
        .maybeSingle(); // supabase-js v2

      out.push({
        ...l,
        prospectId: prospect?.id || null,
        prospectName: prospect?.name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
        qualificationScore: prospect?.qualification_score || 0,
        pipelineStage: prospect?.pipeline_stage || 'new'
      });

      if (prospect) {
        await supabase
          .from('prospects')
          .update({
            instantly_campaign_id: l.campaign_id || null,
            last_activity_date: l.replied_at || new Date().toISOString()
          })
          .eq('id', prospect.id);
      }
    } catch (e) {
      console.error('matchLeadsToProspects error:', email, e.message);
      out.push({ ...l, prospectId: null });
    }
  }
  return out;
}

// ---------------------------
// small util
// ---------------------------
async function safeText(r) { try { return await r.text(); } catch { return ''; } }
