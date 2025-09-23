// api/prospects.js - Using JSON file storage instead of database
import fs from 'fs';
import path from 'path';

// Data file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const PROSPECTS_FILE = path.join(DATA_DIR, 'prospects.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files if they don't exist
function initializeDataFiles() {
  if (!fs.existsSync(PROSPECTS_FILE)) {
    const initialProspects = [
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
        tags: ["high-priority", "interior-design", "automation-interested"],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        engagementScore: 15
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
        tags: ["discovery-done", "construction", "ready-for-proposal"],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastActivity: new Date(Date.now() - 86400000).toISOString(),
        engagementScore: 22
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
        tags: ["growth-plan-sent", "digital-marketing", "follow-up-needed"],
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        lastActivity: new Date(Date.now() - 172800000).toISOString(),
        engagementScore: 18
      }
    ];
    
    fs.writeFileSync(PROSPECTS_FILE, JSON.stringify(initialProspects, null, 2));
  }
  
  if (!fs.existsSync(ACTIVITIES_FILE)) {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify([], null, 2));
  }
}

// File operations helpers
function readProspects() {
  try {
    if (!fs.existsSync(PROSPECTS_FILE)) {
      initializeDataFiles();
    }
    const data = fs.readFileSync(PROSPECTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading prospects:', error);
    return [];
  }
}

function writeProspects(prospects) {
  try {
    fs.writeFileSync(PROSPECTS_FILE, JSON.stringify(prospects, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing prospects:', error);
    return false;
  }
}

function readActivities() {
  try {
    if (!fs.existsSync(ACTIVITIES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ACTIVITIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading activities:', error);
    return [];
  }
}

function writeActivities(activities) {
  try {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing activities:', error);
    return false;
  }
}

// Main API handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Initialize data files
  initializeDataFiles();

  try {
    switch (req.method) {
      case 'GET':
        await handleGetProspects(req, res);
        break;
      case 'POST':
        await handleCreateProspect(req, res);
        break;
      case 'PUT':
        await handleUpdateProspect(req, res);
        break;
      case 'DELETE':
        await handleDeleteProspect(req, res);
        break;
      default:
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

async function handleGetProspects(req, res) {
  const prospects = readProspects();
  const { status, source, qualified, id, search } = req.query;
  
  let filteredProspects = prospects;
  
  // Filter by ID
  if (id) {
    filteredProspects = prospects.filter(p => p.id === parseInt(id));
  } else {
    // Apply other filters
    if (status) {
      filteredProspects = filteredProspects.filter(p => p.status === status);
    }
    
    if (source) {
      filteredProspects = filteredProspects.filter(p => p.source === source);
    }
    
    if (qualified !== undefined) {
      filteredProspects = filteredProspects.filter(p => p.qualified === (qualified === 'true'));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProspects = filteredProspects.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.company.toLowerCase().includes(searchLower) ||
        p.email.toLowerCase().includes(searchLower) ||
        p.industry.toLowerCase().includes(searchLower)
      );
    }
  }
  
  // Sort by last activity
  filteredProspects.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  
  res.status(200).json({
    success: true,
    data: filteredProspects,
    total: filteredProspects.length,
    timestamp: new Date().toISOString()
  });
}

async function handleCreateProspect(req, res) {
  const prospects = readProspects();
  const newProspect = req.body;
  
  // Generate new ID
  const maxId = prospects.length > 0 ? Math.max(...prospects.map(p => p.id)) : 0;
  
  const prospect = {
    ...newProspect,
    id: maxId + 1,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    qualified: newProspect.qualified || false,
    engagementScore: newProspect.engagementScore || 0,
    tags: newProspect.tags || []
  };
  
  prospects.push(prospect);
  
  if (writeProspects(prospects)) {
    // Log activity
    await logActivity({
      prospectId: prospect.id,
      type: 'prospect_created',
      data: { source: prospect.source }
    });
    
    res.status(201).json({
      success: true,
      data: prospect,
      message: 'Prospect created successfully'
    });
  } else {
    res.status(500).json({ error: 'Failed to save prospect' });
  }
}

async function handleUpdateProspect(req, res) {
  const { id } = req.query;
  const updateData = req.body;
  const prospects = readProspects();
  
  const prospectIndex = prospects.findIndex(p => p.id === parseInt(id));
  
  if (prospectIndex === -1) {
    return res.status(404).json({ error: 'Prospect not found' });
  }
  
  // Update prospect
  const updatedProspect = {
    ...prospects[prospectIndex],
    ...updateData,
    lastActivity: new Date().toISOString()
  };
  
  prospects[prospectIndex] = updatedProspect;
  
  if (writeProspects(prospects)) {
    // Log activity
    await logActivity({
      prospectId: updatedProspect.id,
      type: 'prospect_updated',
      data: updateData
    });
    
    res.status(200).json({
      success: true,
      data: updatedProspect,
      message: 'Prospect updated successfully'
    });
  } else {
    res.status(500).json({ error: 'Failed to update prospect' });
  }
}

async function handleDeleteProspect(req, res) {
  const { id } = req.query;
  const prospects = readProspects();
  
  const prospectIndex = prospects.findIndex(p => p.id === parseInt(id));
  
  if (prospectIndex === -1) {
    return res.status(404).json({ error: 'Prospect not found' });
  }
  
  const deletedProspect = prospects.splice(prospectIndex, 1)[0];
  
  if (writeProspects(prospects)) {
    res.status(200).json({
      success: true,
      data: deletedProspect,
      message: 'Prospect deleted successfully'
    });
  } else {
    res.status(500).json({ error: 'Failed to delete prospect' });
  }
}

// Activity logging helper
async function logActivity(activityData) {
  const activities = readActivities();
  
  const activity = {
    id: activities.length + 1,
    ...activityData,
    timestamp: new Date().toISOString()
  };
  
  activities.push(activity);
  writeActivities(activities);
  
  return activity;
}

// Helper functions for webhooks to use
export async function findProspectByEmail(email) {
  const prospects = readProspects();
  return prospects.find(p => p.email === email);
}

export async function updateProspectByEmail(email, updateData) {
  const prospects = readProspects();
  const prospectIndex = prospects.findIndex(p => p.email === email);
  
  if (prospectIndex === -1) {
    return null;
  }
  
  prospects[prospectIndex] = {
    ...prospects[prospectIndex],
    ...updateData,
    lastActivity: new Date().toISOString()
  };
  
  writeProspects(prospects);
  
  // Log activity
  await logActivity({
    prospectId: prospects[prospectIndex].id,
    type: 'prospect_updated_by_email',
    data: updateData
  });
  
  return prospects[prospectIndex];
}

export async function createProspectFromWebhook(prospectData) {
  const prospects = readProspects();
  
  // Check if prospect already exists
  const existing = prospects.find(p => p.email === prospectData.email);
  if (existing) {
    return existing;
  }
  
  // Generate new ID
  const maxId = prospects.length > 0 ? Math.max(...prospects.map(p => p.id)) : 0;
  
  const prospect = {
    id: maxId + 1,
    name: prospectData.name || prospectData.email.split('@')[0],
    email: prospectData.email,
    company: prospectData.company || '',
    industry: prospectData.industry || '',
    source: prospectData.source || 'webhook',
    status: 'new',
    qualified: false,
    podcastScore: 0,
    engagementScore: 0,
    tags: [],
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...prospectData
  };
  
  prospects.push(prospect);
  writeProspects(prospects);
  
  await logActivity({
    prospectId: prospect.id,
    type: 'prospect_created_from_webhook',
    data: { source: prospect.source }
  });
  
  return prospect;
}
