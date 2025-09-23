export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { event, payload } = req.body;
    
    // Handle Calendly webhook events
    if (event === 'invitee.created') {
      // New meeting scheduled
      console.log('New meeting scheduled:', payload);
      // Update prospect status in database
    }
    
    res.json({ received: true });
  }
}
