export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { event, payload } = req.body;
    
    // Handle Zoom webhook events
    if (event === 'recording.completed') {
      // New recording available for AI analysis
      console.log('Recording completed:', payload);
      // Trigger AI analysis workflow
    }
    
    res.json({ received: true });
  }
}
