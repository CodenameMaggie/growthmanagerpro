export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Enhanced prospect data with more realistic information
      const prospects = [
        {
          id: 1,
          name: "Jonathan",
          email: "jonathan@brewersuite.com",
          phone: "(555) 123-4567",
          company: "Brewer Suite Co", 
          industry: "Interior Design",
          status: "discovery_scheduled",
          podcastScore: 38,
          qualified: true,
          source: "podcast",
          nextAction: "Discovery Call - Tomorrow 2:00 PM",
          notes: "Interested in automated lead generation for interior design clients",
          calendlyEvent: "discovery-call-booked",
          lastActivity: new Date().toISOString(),
          tags: ["high-priority", "interior-design", "automation-interested"]
        },
        {
          id: 2,
          name: "Tye Shumway",
          email: "tye@twsconstruction.com", 
          phone: "(555) 987-6543",
          company: "TWS Construction",
          industry: "Construction", 
          status: "discovery_completed",
          podcastScore: 35,
          qualified: true,
          source: "podcast",
          nextAction: "Send Growth Plan Proposal",
          notes: "Completed discovery call. Needs help with contractor lead generation",
          calendlyEvent: "discovery-completed",
          lastActivity: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          tags: ["discovery-done", "construction", "ready-for-proposal"]
        },
        {
          id: 3,
          name: "Sarah Mitchell",
          email: "sarah@digitalmarketingpro.com",
          phone: "(555) 456-7890", 
          company: "Digital Marketing Pro",
          industry: "Digital Marketing",
          status: "growth_plan_sent",
          podcastScore: 42,
          qualified: true,
          source: "podcast",
          nextAction: "Follow up on Growth Plan",
          notes: "Growth plan sent via Instantly. Awaiting response",
          calendlyEvent: null,
          lastActivity: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          tags: ["growth-plan-sent", "digital-marketing", "follow-up-needed"]
        },
        {
          id: 4,
          name: "Michael Chen",
          email: "m.chen@realestateleads.com",
          phone: "(555) 321-0987",
          company: "Chen Real Estate Group", 
          industry: "Real Estate",
          status: "sales_call_scheduled",
          podcastScore: 45,
          qualified: true,
          source: "podcast",
          nextAction: "Sales Call - Friday 10:00 AM",
          notes: "Reviewed growth plan. Ready to discuss implementation",
          calendlyEvent: "sales-call-booked",
          lastActivity: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
          tags: ["high-score", "real-estate", "sales-ready"]
        }
      ];
      
      // Handle filtering and sorting if provided
      let filteredProspects = prospects;
      
      const { status, source, qualified } = req.query;
      
      if (status) {
        filteredProspects = filteredProspects.filter(p => p.status === status);
      }
      
      if (source) {
        filteredProspects = filteredProspects.filter(p => p.source === source);
      }
      
      if (qualified !== undefined) {
        filteredProspects = filteredProspects.filter(p => p.qualified === (qualified === 'true'));
      }
      
      res.status(200).json({
        success: true,
        data: filteredProspects,
        total: filteredProspects.length,
        timestamp: new Date().toISOString()
      });
      
    } else if (req.method === 'POST') {
      // Create new prospect
      const newProspect = req.body;
      
      // Add server-generated fields
      const prospect = {
        ...newProspect,
        id: Date.now(), // Simple ID generation for now
        lastActivity: new Date().toISOString(),
        qualified: false // Default to unqualified until scored
      };
      
      // Here you would save to database
      // await db.prospects.create(prospect);
      
      res.status(201).json({
        success: true,
        data: prospect,
        message: 'Prospect created successfully'
      });
      
    } else if (req.method === 'PUT') {
      // Update existing prospect
      const { id } = req.query;
      const updates = req.body;
      
      // Here you would update in database
      // const updatedProspect = await db.prospects.update(id, updates);
      
      res.status(200).json({
        success: true,
        data: { id, ...updates, lastActivity: new Date().toISOString() },
        message: 'Prospect updated successfully'
      });
      
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
