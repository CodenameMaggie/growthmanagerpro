// api/prospects.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Mock data for now (or connect to a different database)
  const mockProspects = [
    {
      id: 1,
      name: "John Smith",
      email: "john@example.com",
      company: "Tech Corp",
      status: "qualified",
      last_activity: "2024-01-15"
    },
    {
      id: 2,
      name: "Jane Doe", 
      email: "jane@startup.com",
      company: "StartupCo",
      status: "contacted",
      last_activity: "2024-01-14"
    }
  ];

  return res.status(200).json({ prospects: mockProspects });
};
