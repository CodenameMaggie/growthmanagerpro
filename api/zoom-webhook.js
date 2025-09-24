module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET requests (for testing)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "Zoom webhook endpoint is ready",
      timestamp: new Date().toISOString()
    });
  }

  // Handle POST requests (actual webhooks)
  if (req.method === 'POST') {
    const body = req.body || {};
    
    // Zoom validation challenge
    if (body.event === 'endpoint.url_validation') {
      return res.status(200).json({
        plainToken: body.payload?.plainToken || body.challenge
      });
    }
    
    // Other webhook events
    return res.status(200).json({ 
      received: true,
      event: body.event,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
