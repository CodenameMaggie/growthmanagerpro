const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { callId, transcript } = req.body;
    
    // Simple AI analysis (you can replace with OpenAI or other AI service)
    const score = analyzeTranscript(transcript);
    const analysis = {
      score: score,
      pain_points: extractPainPoints(transcript),
      business_size: extractBusinessSize(transcript),
      qualification_reasons: getQualificationReasons(score, transcript)
    };

    // Update call with analysis
    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update({
        transcript: transcript,
        ai_analysis: analysis,
        qualification_score: score
      })
      .eq('id', callId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // If qualified (35+), automatically advance to discovery
    if (score >= 35) {
      // Find prospect by meeting and update status
      await supabase
        .from('prospects')
        .update({
          qualification_score: score,
          pipeline_stage: 'qualified_for_discovery',
          last_activity_date: new Date().toISOString()
        })
        .eq('zoom_meeting_id', updatedCall.zoom_meeting_id);
    }

    return res.status(200).json({ 
      success: true, 
      score: score,
      qualified: score >= 35,
      analysis: analysis
    });
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Simple qualification scoring logic
function analyzeTranscript(transcript) {
  if (!transcript) return 0;
  
  let score = 0;
  const text = transcript.toLowerCase();
  
  // Business size indicators
  if (text.includes('revenue') || text.includes('million') || text.includes('scale')) score += 10;
  if (text.includes('employees') || text.includes('team')) score += 8;
  
  // Pain point indicators
  if (text.includes('challenge') || text.includes('problem')) score += 12;
  if (text.includes('system') || text.includes('process')) score += 10;
  if (text.includes('growth') || text.includes('scaling')) score += 15;
  
  // Interest indicators
  if (text.includes('interested') || text.includes('help')) score += 10;
  if (text.includes('yes') && text.includes('work together')) score += 8;
  
  return Math.min(score, 50); // Cap at 50
}

function extractPainPoints(transcript) {
  // Extract key business challenges mentioned
  const painPoints = [];
  const text = transcript.toLowerCase();
  
  if (text.includes('cash flow')) painPoints.push('Cash flow management');
  if (text.includes('team') && text.includes('manage')) painPoints.push('Team management');
  if (text.includes('system')) painPoints.push('Business systems');
  if (text.includes('scale') || text.includes('grow')) painPoints.push('Scaling challenges');
  
  return painPoints;
}

function extractBusinessSize(transcript) {
  const text = transcript.toLowerCase();
  if (text.includes('million')) return 'Multi-million';
  if (text.includes('750k') || text.includes('500k')) return '500K-1M';
  return 'Under 500K';
}

function getQualificationReasons(score, transcript) {
  const reasons = [];
  if (score >= 35) {
    reasons.push('Strong business challenges identified');
    reasons.push('Appropriate business size');
    reasons.push('Expressed interest in solutions');
  }
  return reasons;
}
