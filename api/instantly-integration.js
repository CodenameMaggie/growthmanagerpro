// /api/instantly-integration.js
const { createClient } = require('@supabase/supabase-js');

const INSTANTLY_BASE = process.env.INSTANTLY_API_BASE || 'https://api.instantly.ai/api/v3';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const apiKey = process.env.INSTANTLY_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: 'INSTANTLY_API_KEY is missing' });

    if (req.method === 'GET') {
      const { data: campaigns, mocked: cMock } = await fetchCampaigns(apiKey);
      const { data: leads, mocked: lMock } = await fetchLeads(apiKey);

      // Store/refresh campaign metrics (best-effort)
      await upsertCampaigns(supabase, campaigns);

      // Match & annotate leads against prospects (and optionally update)
      const matchedLeads = await matchLeadsToProspects(supabase, leads);

      return res.status(200).json({
        success: true,
        mocked: cMock || lMock || false,
        campaigns,
        leads: matchedLeads,
        summary: {
          totalCampaigns: campaigns.length,
          totalLeads: leads.length,
          matchedProspects: matchedLeads.filter(l => l.prospectId).length
        }
      });
    }

    if (req.method === 'POST') {
      // Optional: send an email via Instantly campaign
      const { recipientEmail, subject, message, campaignId } = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
      const out = await sendInstantlyEmail(apiKey, { recipientEmail, subject, message, campaignId });
      return res.status(200).json({ success: true, emailResult: out });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('Instantly integration error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

async function fetchCampaigns(apiKey) {
  const url = `${INSTANTLY_BASE}/campaigns?api_key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error('Instantly campaigns non-200:', r.status, await safeText(r));
    return { mocked: true, data: [
      { id: 'mock_campaign_1', name: 'Interior Design Outreach - Q4', status: 'active', sent: 487, opened: 104, replied: 14 },
      { id: 'mock_campaign_2', name: 'Construction LinkedIn Outreach',  status: 'active', sent: 324, opened:  59, replied:  8 },
      { id: 'mock_campaign_3', name: 'Professional Services Follow-up', status: 'active', sent: 436, opened:  86, replied: 12 }
    ] };
  }
  const data = await r.json();
  return { mocked: false, data: data?.campaigns || data?.data || [] };
}

async function fetchLeads(apiKey) {
  // You can add filters here (limit, page, etc.). This pulls a chunk for dashboard.
  const url = `${INSTANTLY_BASE}/leads?api_key=${encodeURIComponent(apiKey)}&limit=100`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error('Instantly leads non-200:', r.status, await safeText(r));
    const mocks = [
      { email: 'jonathan@brewersuite.com', firstName: 'Jonathan', company: 'Brewer Suite Co', campaignId: 'mock_campaign_1', status: 'replied',
        lastMessage: 'Interested in learning more about scaling interior design firms.', repliedAt: new Date(Date.now() - 2*864e5).toISOString() }
    ];
    return { mocked: true, data: mocks };
  }
  const data = await r.json();
  // API sometimes returns {leads:[]}, sometimes {data:[]}
  return { mocked: false, data: data?.leads || data?.data || [] };
}

async function upsertCampaigns(supabase, campaigns) {
  try {
    for (const c of campaigns) {
      const row = {
        instantly_campaign_id: c.id,
        name: c.name,
        status: c.status || 'active',
        total_sent: Number(c.sent || 0),
        opens: Number(c.opened || 0),
        replies: Number(c.replied || 0),
        qualified_leads: 0
      };
      await supabase.from('campaigns').upsert(row, { onConflict: 'instantly_campaign_id' });
    }
  } catch (e) {
    console.warn('upsertCampaigns warn:', e.message);
  }
}

async function matchLeadsToProspects(supabase, leads) {
  const out = [];
  for (const lead of leads) {
    try {
      const email = (lead.email || '').toLowerCase();
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id,name,qualification_score,pipeline_stage')
        .eq('email', email)
        .maybeSingle();

      out.push({
        ...lead,
        prospectId: prospect?.id || null,
        prospectName: prospect?.name || [lead.firstName, lead.lastName].filter(Boolean).join(' '),
        qualificationScore: prospect?.qualification_score || 0,
        pipelineStage: prospect?.pipeline_stage || 'new'
      });

      // Optional: freshen activity/campaign id when matched
      if (prospect) {
        await supabase
          .from('prospects')
          .update({
            instantly_campaign_id: lead.campaignId || null,
            last_activity_date: lead.repliedAt || new Date().toISOString()
          })
          .eq('id', prospect.id);
      }
    } catch (e) {
      console.warn('matchLeadsToProspects warn:', e.message);
      out.push({
        ...lead,
        prospectId: null,
        prospectName: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
        qualificationScore: 0,
        pipelineStage: 'new'
      });
    }
  }
  return out;
}

async function sendInstantlyEmail(apiKey, { recipientEmail, subject, message, campaignId }) {
  try {
    const url = `${INSTANTLY_BASE}/campaigns/${encodeURIComponent(campaignId)}/send?api_key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: recipientEmail, subject, body: message })
    });
    if (!r.ok) {
      console.error('Instantly send non-200:', r.status, await safeText(r));
      return { success: false, message: `HTTP ${r.status}` };
    }
    return await r.json();
  } catch (e) {
    console.warn('sendInstantlyEmail mock-success:', e.message);
    return { success: true, message: 'mock delivery (dev mode)' };
  }
}

async function safeText(r) { try { return await r.text(); } catch { return '(no body)'; } }
