export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { event_type, data } = req.body;
    
    // Handle Instantly webhook events
    if (event_type === 'email_opened') {
      // Growth plan opened
      console.log('Growth plan opened:', data);
    }
    
    if (event_type === 'email_replied') {
      // Response to growth plan
      console.log('Growth plan response:', data);
      // Analyze sentiment and auto-schedule if positive
    }
    
    res.json({ success: true });
  }
}
