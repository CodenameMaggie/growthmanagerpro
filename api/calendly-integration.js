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

    // Get qualified prospects (score 35+)
    const { data: prospects, error: prospectError } = await supabase
      .from('prospects')
      .select('*')
      .gte('qualification_score', 35)
      .in('pipeline_stage', ['qualified_for_discovery', 'new'])
      .limit(10);

    if (prospectError) {
      return res.status(500).json({ error: prospectError.message });
    }

    if (!prospects || prospects.length === 0) {
      return res.status(404).json({ error: 'No qualified prospects found' });
    }

    const results = [];

    for (const prospect of prospects) {
      const calendlyLink = `https://calendly.com/maggie/discovery?prefill_name=${prospect.name}&prefill_email=${prospect.email}`;
      
      // Update prospect stage
      await supabase
        .from('prospects')
        .update({
          pipeline_stage: 'discovery_link_sent',
          last_activity_date: new Date().toISOString()
        })
        .eq('id', prospect.id);

      results.push({
        prospect: prospect.name,
        company: prospect.company,
        qualification_score: prospect.qualification_score,
        calendly_link: calendlyLink
      });
    }

    return res.status(200).json({
      success: true,
      processed_prospects: results.length,
      prospects: results,
      next_step: 'Discovery call booking links ready to send via Instantly'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
