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

    const { event, payload } = req.body;
    
    // Handle meeting ended event
    if (event === 'meeting.ended') {
      const { object } = payload;
      const meetingId = object.id;
      const duration = object.duration;
      
      // Store basic meeting info
      const { data: call, error: callError } = await supabase
        .from('calls')
        .insert({
          zoom_meeting_id: meetingId,
          duration_minutes: duration,
          qualification_score: 0 // Will be updated when AI analysis completes
        })
        .select()
        .single();

      if (callError) {
        console.error('Error storing call:', callError);
        return res.status(500).json({ error: callError.message });
      }

      // TODO: Trigger AI analysis job (we'll add this next)
      console.log('Meeting stored, AI analysis queued:', call.id);
    }

    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Zoom webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
};
