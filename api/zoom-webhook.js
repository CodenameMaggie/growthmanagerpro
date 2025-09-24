module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'GET') {
    return res.status(200).json({ status: "ready" });
  }
  
  if (req.method === 'POST') {
    const { event, payload } = req.body || {};
    
    if (event === 'endpoint.url_validation') {
      // Zoom expects exactly this response format
      return res.status(200).json({
        plainToken: payload.plainToken
      });
    }
    
    return res.status(200).json({ success: true });
  }
  
  return res.status(200).json({ error: 'Invalid method' });
};
