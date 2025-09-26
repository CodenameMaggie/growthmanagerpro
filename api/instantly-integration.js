// api/instantly-integration.js
const { createClient } = require('@supabase/supabase-js');

const INSTANTLY_BASE = 'https://api.instantly.ai/api/v2';

module.exports = async function handler(req, res) {
  // CORS for GitHub Pages → Vercel calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.INSTANTLY_API_KEY;
  if (!token) return res.status(500).json({ error: 'Missing INSTANTLY_API_KEY' });

  // Use service role on server routes (reads+writes)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    if (req.method === 'GET') {
      // Pull campaigns + recent leads
      const [campaigns, leadsResp] = await Promise.all([
        instantlyGET('/campaigns', token),
        // leads/list is POST; add filters as you like:
        instantlyPOST('/leads/list', token, { limit: 50 })
      ]);

      await updateCampaignData(supabase, campaigns);

      const leads = Array.isArray(leadsResp?.items) ? leadsResp.items : (Array.isArray(leadsResp) ? leadsResp : []);
      const matched = await matchLeadsToProspects(supabase, leads);

      return res.status(200).json({
        success: true,
        campaigns,
        leads: matched,
        summary: {
          totalCampaigns: campaigns.length,
          totalLeads: leads.length,
          matchedProspects: matched.filter(x => x.prospectId).length
        }
      });
    }

    if (req.method === 'POST') {
      // Example: send an email via Instantly campaign
      const { recipientEmail, subject, message, campaignId } = req.body || {};
      if (!recipientEmail || !subject || !message || !campaignId) {
        return res.status(400).json({ error: 'recipientEmail, subject, message, campaignId are required' });
      }
      const r = await instantlyPOST(`/campaigns/${campaignId}/send`, token, {
        to: recipientEmail,
        subject,
        body: message
      });
      return res.status(200).json({ success: true, emailResult: r });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('instantly-integration error:', e);
    return res.status(500).json({ error: e.message, where: e.where });
  }
};

async function instantlyGET(path, token) {
  const r = await fetch(`${INSTANTLY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!r.ok) {
    const text = await r.text();
    const err = new Error(`Instantly GET ${path} → ${r.status} ${text}`);
    err.where = `GET ${path}`;
    throw err;
  }
  return r.json(); // campaigns: array
}

async function instantlyPOST(path, token, body) {
  const r = await fetch(`${INSTANTLY_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) {
    const text = await r.text();
    const err = new Error(`Instantly POST ${path} → ${r.status} ${text}`);
    err.where = `POST ${path}`;
    throw err;
  }
  return r.json();
}

async function updateCampaignData(supabase, campaigns) {
  if (!Array.isArray(campaigns)) return;
  for (const c of campaigns) {
    // be defensive about keys; Instantly payloads can vary
    const payload = {
      instantly_campaign_id: c.id,
      name: c.name ?? '',
      status: c.status ?? 'active',
      total_sent: c.sent ?? 0,
      opens: c.opened ?? 0,
      replies: c.replied ?? 0,
      bounced: c.bounced ?? 0,
      unsubscribed: c.unsubscribed ?? 0,
    };
    const { error } = await supabase
      .from('campaigns')
      .upsert(payload, { onConflict: 'instantly_campaign_id' });
    if (error) console.error('supabase upsert campaign error:', error);
  }
}

async function matchLeadsToProspects(supabase, leads) {
  const out = [];
  for (const lead of leads) {
    // normalize possible field shapes
    const email = (lead.email || lead.emailAddress || '').toLowerCase();
    const first = lead.firstName || lead.first_name || '';
    const last  = lead.lastName  || lead.last_name  || '';
    const company = lead.companyName || lead.company_name || lead.company || '';
    const status  = lead.status || 'new';

    let prospect = null;
    if (email) {
      const { data } = await supabase
        .from('prospects')
        .select('id,name,qualification_score,pipeline_stage')
        .eq('email', email)
        .maybeSingle();
      prospect = data || null;
    }

    out.push({
      ...lead,
      prospectId: prospect?.id || null,
      prospectName: prospect?.name || `${first} ${last}`.trim(),
      qualificationScore: prospect?.qualification_score || 0,
      pipelineStage: prospect?.pipeline_stage || status,
      company,
      email
    });

    // Optionally update last_activity_date if matched
    if (prospect) {
      await supabase
        .from('prospects')
        .update({
          instantly_campaign_id: lead.campaignId ?? lead.campaign_id ?? null,
          last_activity_date: lead.repliedAt || new Date().toISOString()
        })
        .eq('id', prospect.id);
    }
  }
  return out;
}
