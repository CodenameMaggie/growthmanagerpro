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

    // Simulate a qualifying podcast call
    const mockTranscript = `
      Hi Maggie, thanks for having me on. We're a construction company doing about 750K in revenue, 
      looking to scale to 10 million. Our biggest challenges are cash flow management and team systems. 
      We've tried 5 different bookkeepers but can't get the financial systems right. 
      I'm really interested in working together if you can help us grow and scale our operations.
    `;

    // 1. Create a call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        prospect_id: 1, // Your test user
        zoom_meeting_id: 'test_meeting_123',
        transcript: mockTranscript,
        duration_minutes: 45,
        qualification_score: 0
      })
      .select()
      .single();

    if (callError) {
      return res.status(500).json({ error: 'Call creation failed', details: callError });
    }

    // 2. Run AI analysis
    const score = analyzeTranscript(mockTranscript);
    const analysis = {
      score: score,
      pain_points: ['Cash flow management', 'Team systems', 'Financial systems'],
      business_size: '500K-1M',
      qualification_reasons: ['Strong revenue base', 'Clear growth goals', 'Expressed interest']
    };

    // 3. Update call with analysis
    await supabase
      .from('calls')
      .update({
        ai_analysis: analysis,
        qualification_score: score
      })
      .eq('id', call.id);

    // 4. Update prospect if qualified
    let prospectUpdate = {};
    if (score >= 35) {
      prospectUpdate = {
        qualification_score: score,
        pipeline_stage: 'qualified_for_discovery',
        last_activity_date: new Date().toISOString(),
        zoom_meeting_id: 'test_meeting_123'
      };

      await supabase
        .from('prospects')
        .update(prospectUpdate)
        .eq('id', 1);
    }

    return res.status(200).json({
      success: true,
      workflow_completed: true,
      call_id: call.id,
      analysis_score: score,
      qualified: score >= 35,
      prospect_updated: score >= 35,
      next_steps: score >= 35 ? 'Auto-send Calendly discovery call link' : 'Add to nurture sequence',
      analysis: analysis
    });

  } catch (error) {
    console.error('Test workflow error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Same analysis function as before
function analyzeTranscript(transcript) {
  if (!transcript) return 0;
  
  let score = 0;
  const text = transcript.toLowerCase();
  
  // Business size indicators (0-15 points)
  if (text.includes('million') || text.includes('10 million')) score += 15;
  else if (text.includes('750k') || text.includes('500k')) score += 10;
  else if (text.includes('revenue')) score += 5;
  
  // Pain point indicators (0-15 points)
  if (text.includes('cash flow') || text.includes('financial systems')) score += 8;
  if (text.includes('scaling') || text.includes('systems')) score += 5;
  if (text.includes('team') && (text.includes('challenge') || text.includes('manage'))) score += 5;
  
  // Interest level (0-10 points)
  if (text.includes('interested') && text.includes('working together')) score += 8;
  else if (text.includes('help')) score += 4;
  
  // Decision-making capability (0-10 points)
  if (text.includes('looking to') || text.includes('we need')) score += 6;
  if (text.includes('tried') && text.includes('bookkeeper')) score += 4; // Shows they invest in solutions
  
  return Math.min(score, 50);
}
