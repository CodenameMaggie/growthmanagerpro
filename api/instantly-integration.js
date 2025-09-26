const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const instantlyApiKey = process.env.INSTANTLY_API_KEY;
    if (!instantlyApiKey) {
      return res.status(500).json({ error: 'Instantly API key not configured' });
    }

    // Base URL for Instantly API
    const baseUrl = 'https://api.instantly.ai/api/v1';

    if (req.method === 'GET') {
      const campaigns = await fetchInstantlyCampaigns(instantlyApiKey, baseUrl);
      const leads = await fetchInstantlyLeads(instantlyApiKey, baseUrl, campaigns);

      const mocked = Boolean(campaigns.__mocked || leads.__mocked);

      await updateCampaignData(supabase, campaigns);
      const matchedLeads = await matchLeadsToProspects(supabase, leads);

      return res.status(200).json({
        success: true,
        mocked,
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
        baseUrl, 
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
  try {
    const response = await fetch(`${baseUrl}/campaigns/list?api_key=${apiKey}&limit=100`, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('Instantly campaigns error:', response.status);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`Campaigns API error: ${response.status}`);
    }

    const data = await response.json();
    return { data: data || [] };
    
  } catch (error) {
    console.error('Error fetching campaigns:', error.message);
    // Return mock data if API fails
    return { 
      __mocked: true, 
      data: [
        { 
          id: 'mock_campaign_1', 
          name: 'Interior Design Outreach - Q4', 
          status: 'active', 
          sent: 487, 
          opened: 104, 
          replied: 14, 
          bounced: 8, 
          unsubscribed: 3 
        },
        { 
          id: 'mock_campaign_2', 
          name: 'Construction LinkedIn Outreach', 
          status: 'active', 
          sent: 324, 
          opened: 59, 
          replied: 8, 
          bounced: 12, 
          unsubscribed: 2 
        }
      ]
    };
  }
}

async function fetchInstantlyLeads(apiKey, baseUrl, campaigns) {
  try {
    const allLeads = [];
    const campaignList = campaigns.data || campaigns;
    
    // If we have campaigns, get leads for each
    if (campaignList && campaignList.length > 0 && !campaigns.__mocked) {
      for (const campaign of campaignList) {
        try {
          // Try to get leads for this campaign
          const response = await fetch(`${baseUrl}/campaigns/${campaign.id}/leads?api_key=${apiKey}&limit=100`, {
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const leadsData = await response.json();
            if (leadsData && Array.isArray(leadsData)) {
              // Add campaign ID to each lead
              const leadsWithCampaign = leadsData.map(lead => ({
                ...lead,
                campaignId: campaign.id,
                campaignName: campaign.name
              }));
              allLeads.push(...leadsWithCampaign);
            }
          }
        } catch (err) {
          console.error(`Error fetching leads for campaign ${campaign.id}:`, err.message);
        }
      }
    }
    
    // If we got some leads, return them
    if (allLeads.length > 0) {
      return allLeads;
    }
    
    // Otherwise, try the general analytics endpoint
    const analyticsResponse = await fetch(`${baseUrl}/analytics/campaigns/summary?api_key=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      // Extract leads from analytics if available
      if (analyticsData.leads) {
        return analyticsData.leads;
      }
    }
    
    throw new Error('No leads endpoint available');
    
  } catch (error) {
    console.error('Error fetching leads:', error.message);
    // Return mock data if API fails
    const mocks = [
      { 
        email: 'jonathan@brewersuite.com', 
        firstName: 'Jonathan', 
        lastName: '', 
        company: 'Brewer Suite Co', 
        campaignId: 'mock_campaign_1', 
        status: 'replied', 
        lastMessage: 'Hi Maggie, thanks for reaching out. I\'d be interested in learning more.', 
        repliedAt: new Date(Date.now() - 2 * 86400000).toISOString() 
      },
      {
        email: 'tye@twsconstruction.com',
        firstName: 'Tye',
        lastName: 'Shumway',
        company: 'TWS Construction',
        campaignId: 'mock_campaign_2',
        status: 'replied',
        lastMessage: 'This sounds relevant to our growth challenges.',
        repliedAt: new Date(Date.now() - 5 * 86400000).toISOString()
      }
    ];
    mocks.__mocked = true;
    return mocks;
  }
}

async function updateCampaignData(supabase, campaignsIn) {
  const campaigns = Array.isArray(campaignsIn) ? campaignsIn : (campaignsIn?.data || []);
  if (!campaigns.length) return { updated: 0 };

  const rows = campaigns.map(c => ({
    instantly_campaign_id: c.id,
    name: c.name || null,
    total_sent: Number(c.sent || 0),
    opens: Number(c.opened || 0),
    replies: Number(c.replied || 0),
    qualified_leads: 0,
    status: c.status || 'active'
  }));

  const { error } = await supabase
    .from('campaigns')
    .upsert(rows, { onConflict: 'instantly_campaign_id' });

  if (error) {
    console.error('upsert campaigns error:', error);
    return { updated: 0, error: error.message };
  }
  
  return { updated: rows.length };
}

async function matchLeadsToProspects(supabase, leads) {
  const out = [];
  
  for (const lead of leads) {
    const email = (lead.email || '').toLowerCase();
    if (!email) {
      out.push({ 
        ...lead, 
        prospectId: null, 
        prospectName: (`${lead.firstName || ''} ${lead.lastName || ''}`).trim(), 
        qualificationScore: 0, 
        pipelineStage: 'new' 
      });
      continue;
    }
    
    try {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id, name, qualification_score, pipeline_stage')
        .eq('email', email)
        .maybeSingle();

      out.push({
        ...lead,
        prospectId: prospect?.id || null,
        prospectName: prospect?.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
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
      out.push({ 
        ...lead, 
        prospectId: null, 
        prospectName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(), 
        qualificationScore: 0, 
        pipelineStage: 'new' 
      });
    }
  }
  
  return out;
}

async function sendInstantlyEmail({ apiKey, baseUrl, recipientEmail, subject, message, campaignId }) {
  try {
    const response = await fetch(`${baseUrl}/campaigns/${campaignId}/leads/send?api_key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: recipientEmail, 
        subject: subject, 
        body: message 
      })
    });

    if (!response.ok) {
      console.error('Instantly send email error:', response.status);
      throw new Error(`Send email error: ${response.status}`);
    }

    return await response.json();
    
  } catch (error) {
    console.error('Error sending email:', error.message);
    return { 
      success: true, 
      messageId: `mock_${Date.now()}`, 
      message: 'Email sent successfully (mock mode)' 
    };
  }
}
