export default function handler(req, res) {
  res.json({ 
    message: "API endpoint working", 
    timestamp: new Date().toISOString() 
  });
}
