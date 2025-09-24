const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { prospect_id } = req.body || { prospect_id: 1 }; // Default to test user for GET

    // Get qualified prospect
    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospect_id)
      .eq('pipeline_stage', 'qualified_for_discovery')
      .single();

    if (prospectError || !prospect) {
      return res.status(404).json({ error: 'Qualified prospect not found' });
    }

    // Simulate sending Calendly link (in production, this would send email via Instantly)
    const calendlyLink = `https://calendly.com/maggie/discovery?prefill_name=${prospect.name}&prefill_email=${prospect.email}`;
    
    // Update prospect to show discovery link sent
    await supabase
      .from('prospects')
      .update({
        pipeline_stage: 'discovery_link_sent',
        last_activity_date: new Date().toISOString()
      })
      .eq('id', prospect_id);

    // In production, this would integrate with Instantly to send personalized email:
    const emailContent = `Hi ${prospect.name},

Thanks for our great podcast conversation! Based on our discussion about ${prospect.qualification_score > 40 ? 'your business growth challenges' : 'scaling your operations'}, I'd love to dive deeper in a discovery call.

Schedule your discovery call here: ${calendlyLink}

Looking forward to exploring how we can help you achieve your growth goals!

Best,
Maggie`;

    return res.status(200).json({
      success: true,
      prospect: prospect.name,
      company: prospect.company,
      qualification_score: prospect.qualification_score,
      calendly_link: calendlyLink,
      email_content: emailContent,
      next_step: 'Discovery call booking link sent via Instantly',
      pipeline_stage: 'discovery_link_sent'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
