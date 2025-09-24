const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle Zoom webhook verification challenge
  if (req.method === 'POST' && req.body.event === 'endpoint.url_validation') {
    const { challenge } = req.body.payload;
    return res.status(200).json({
      plainToken: challenge,
      encryptedToken: challenge // For basic verification, return the challenge
    });
  }

  // Handle actual webhook events
  if (req.method === 'POST') {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { event, payload } = req.body;
      
      if (event === 'meeting.ended') {
        const { object } = payload;
        const meetingId = object.id;
        const duration = object.duration;
        
        const { data: call, error: callError } = await supabase
          .from('calls')
          .insert({
            zoom_meeting_id: meetingId,
            duration_minutes: duration,
            qualification_score: 0
          })
          .select()
          .single();

        if (callError) {
          console.error('Error storing call:', callError);
          return res.status(500).json({ error: callError.message });
        }

        console.log('Meeting stored:', call.id);
      }

      return res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Zoom webhook error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
