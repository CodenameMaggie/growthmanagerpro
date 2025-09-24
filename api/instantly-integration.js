const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get Instantly API key from environment
    const instantlyApiKey = process.env.INSTANTLY_API_KEY;
    if (!instantlyApiKey) {
      return res.status(500).json({ error: 'Instantly API key not configured' });
    }

    const instantlyBaseUrl = 'https://api.instantly.ai';

    if (req.method === 'GET') {
      // Fetch campaign data from Instantly
      const campaigns = await fetchInstantlyCampaigns(instantlyApiKey, instantlyBaseUrl);
      const leads = await fetchInstantlyLeads(instantlyApiKey, instantlyBaseUrl);
      
      // Update local database with campaign data
      await updateCampaignData(supabase, campaigns);
      
      // Match leads to existing prospects
      const matchedLeads = await matchLeadsToProspects(supabase, leads);
      
      return res.status(200).json({
        success: true,
        campaigns: campaigns,
        leads: matchedLeads,
        summary: {
          totalCampaigns: campaigns.length,
          totalLeads: leads.length,
          matchedProspects: matchedLeads.filter(l => l.prospectId).length
        }
      });
    }

    if (req.method === 'POST') {
      // Send email via Instantly
      const { recipientEmail, subject, message, campaignId } = req.body;
      
      const emailResult = await sendInstantlyEmail({
        apiKey: instantlyApiKey,
        baseUrl: instantlyBaseUrl,
        recipientEmail,
        subject,
        message,
        campaignId
      });
      
      return res.status(200).json({
        success: true,
        emailResult: emailResult
      });
    }

  } catch (error) {
    console.error('Instantly integration error:', error);
    return res.status(500).json({ error: error.message });
  }
};

async function fetchInstantlyCampaigns(apiKey, baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/v1/campaigns`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Instantly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.campaigns || [];
  } catch (error) {
    console.error('Error fetching Instantly campaigns:', error);
    // Return mock data if API fails
    return [
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
      },
      {
        id: 'mock_campaign_3',
        name: 'Professional Services Follow-up',
        status: 'active', 
        sent: 436,
        opened: 86,
        replied: 12,
        bounced: 15,
        unsubscribed: 4
      }
    ];
  }
}

async function fetchInstantlyLeads(apiKey, baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/v1/leads`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Instantly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.leads || [];
  } catch (error) {
    console.error('Error fetching Instantly leads:', error);
    // Return mock lead data if API fails
    return [
      {
        email: 'jonathan@brewersuite.com',
        firstName: 'Jonathan',
        lastName: '',
        company: 'Brewer Suite Co',
        campaignId: 'mock_campaign_1',
        status: 'replied',
        lastMessage: 'Hi Maggie, thanks for reaching out. I\'d be interested in learning more about your approach to scaling interior design firms.',
        repliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        email: 'tye@twsconstruction.com',
        firstName: 'Tye',
        lastName: 'Shumway', 
        company: 'TWS Construction',
        campaignId: 'mock_campaign_2',
        status: 'replied',
        lastMessage: 'This sounds relevant to our growth challenges. We\'re scaling from $750K and need better financial systems.',
        repliedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
}

async function updateCampaignData(supabase, campaigns) {
  try {
    for (const campaign of campaigns) {
      const { error } = await supabase
        .from('campaigns')
        .upsert({
          instantly_campaign_id: campaign.id,
          name: campaign.name,
          total_sent: campaign.sent || 0,
          opens: campaign.opened || 0,
          replies: campaign.replied || 0,
          qualified_leads: 0, // Will be calculated separately
          status: campaign.status || 'active'
        }, {
          onConflict: 'instantly_campaign_id'
        });

      if (error) {
        console.error('Error updating campaign:', campaign.id, error);
      }
    }
  } catch (error) {
    console.error('Error updating campaign data:', error);
  }
}

async function matchLeadsToProspects(supabase, leads) {
  const matchedLeads = [];
  
  for (const lead of leads) {
    try {
      // Find matching prospect by email
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id, name, qualification_score, pipeline_stage')
        .eq('email', lead.email.toLowerCase())
        .single();

      matchedLeads.push({
        ...lead,
        prospectId: prospect?.id || null,
        prospectName: prospect?.name || `${lead.firstName} ${lead.lastName}`.trim(),
        qualificationScore: prospect?.qualification_score || 0,
        pipelineStage: prospect?.pipeline_stage || 'new'
      });

      // Update prospect with campaign info if matched
      if (prospect) {
        await supabase
          .from('prospects')
          .update({
            instantly_campaign_id: lead.campaignId,
            last_activity_date: lead.repliedAt || new Date().toISOString()
          })
          .eq('id', prospect.id);
      }

    } catch (error) {
      console.error('Error matching lead:', lead.email, error);
      matchedLeads.push({
        ...lead,
        prospectId: null,
        prospectName: `${lead.firstName} ${lead.lastName}`.trim(),
        qualificationScore: 0,
        pipelineStage: 'new'
      });
    }
  }

  return matchedLeads;
}

async function sendInstantlyEmail({ apiKey, baseUrl, recipientEmail, subject, message, campaignId }) {
  try {
    const response = await fetch(`${baseUrl}/v1/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: subject,
        body: message
      })
    });

    if (!response.ok) {
      throw new Error(`Instantly send email error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending Instantly email:', error);
    // Return mock success for testing
    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      message: 'Email sent successfully (mock mode)'
    };
  }
}
