export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Start with mock data that matches your current prospects
  const prospects = [
    {
      id: 1,
      name: "Jonathan",
      company: "Brewer Suite Co", 
      industry: "Interior Design",
      status: "discovery_scheduled",
      podcastScore: 38,
      qualified: true,
      source: "podcast"
    },
    {
      id: 2,
      name: "Tye Shumway",
      company: "TWS Construction",
      industry: "Construction", 
      status: "discovery_completed",
      podcastScore: 35,
      qualified: true,
      source: "podcast"
    }
  ];
  
  res.json(prospects);
}
