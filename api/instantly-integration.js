const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // ✅ server-only key
    );

    const instantlyApiKey = process.env.INSTANTLY_API_KEY;
    if (!instantlyApiKey) return res.status(500).json({ error: 'Instantly API key not configured' });

    const instantlyBaseUrl = 'https://api.instantly.ai';

    if (req.method === 'GET') {
      const campaigns = await fetchInstantlyCampaigns(instantlyApiKey, instantlyBaseUrl);
      const leads = await fetchInstantlyLeads(instantlyApiKey, instantlyBaseUrl);

      // If these come from mocks because Instantly returned non-200,
      // you’ll still “succeed”; add a hint flag if you want:
      const mocked = (campaigns.__mocked || leads.__mocked) ? true : false;

      await updateCampaignData(supabase, campaigns);
      const matchedLeads = await matchLeadsToProspects(supabase, leads);

      return res.status(200).json({
        success: true,
        mocked, // 👈 helps you see if data is real
        campaigns: campaigns.data || campaigns,
        leads: matchedLeads,
        summary: {
          totalCampaigns: (campaigns.data || campaigns).length,
          totalLeads: leads.length,
          matchedProspects: matchedLeads.filter(l => l.prospectId).length
        }
      });
    }

    if (req.method === 'POST') {
      const { recipientEmail, subject, message, campaignId } = req.body || {};
      const emailResult = await sendInstantlyEmail({
        apiKey: instantlyApiKey,
        baseUrl: instantlyBaseUrl,
        recipientEmail,
        subject,
        message,
        campaignId
      });
      return res.status(200).json({ success: true, emailResult });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Instantly integration error:', error);
    return res.status(500).json({ error: error.message });
  }
};

async function fetchInstantlyCampaigns(apiKey, baseUrl) {
  const r = await fetch(`${baseUrl}/v1/campaigns`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
  });
  if (!r.ok) {
    console.error('Instantly campaigns non-200:', r.status, await r.text());
    // Return mock + flag
    return { __mocked: true, data: [
      { id:'mock_campaign_1', name:'Interior Design Outreach - Q4', status:'active', sent:487, opened:104, replied:14, bounced:8, unsubscribed:3 },
      { id:'mock_campaign_2', name:'Construction LinkedIn Outreach', status:'active', sent:324, opened:59, replied:8, bounced:12, unsubscribed:2 },
    ]};
  }
  const data = await r.json();
  return { data: data.campaigns || [] };
}

async function fetchInstantlyLeads(apiKey, baseUrl) {
  const r = await fetch(`${baseUrl}/v1/leads`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
  });
  if (!r.ok) {
    console.error('Instantly leads non-200:', r.status, await r.text());
    const mocks = [
      { email:'jonathan@brewersuite.com', firstName:'Jonathan', company:'Brewer Suite Co', campaignId:'mock_campaign_1', status:'replied',
        lastMessage:"Hi Maggie...", repliedAt:new Date(Date.now()-2*864e5).toISOString() }
    ];
    mocks.__mocked = true;
    return mocks;
  }
  const data = await r.json();
  return data.leads || [];
}

async function matchLeadsToProspects(supabase, leads) {
  const out = [];
  for (const lead of leads) {
    const email = (lead.email || '').toLowerCase();
    if (!email) {
      out.push({ ...lead, prospectId:null, prospectName:(`${lead.firstName||''} ${lead.lastName||''}`).trim(), qualificationScore:0, pipelineStage:'new' });
      continue;
    }
    try {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id, name, qualification_score, pipeline_stage')
        .eq('email', email)
        .maybeSingle(); // ✅ no throw on 0 results

      out.push({
        ...lead,
        prospectId: prospect?.id || null,
        prospectName: prospect?.name || `${lead.firstName||''} ${lead.lastName||''}`.trim(),
        qualificationScore: prospect?.qualification_score || 0,
        pipelineStage: prospect?.pipeline_stage || 'new'
      });

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
      console.error('match lead error:', email, e.message);
      out.push({ ...lead, prospectId:null, prospectName:`${lead.firstName||''} ${lead.lastName||''}`.trim(), qualificationScore:0, pipelineStage:'new' });
    }
  }
  return out;
}
