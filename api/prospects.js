// api/prospects.js - Supabase Real-time Version- updated version
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    switch (req.method) {
      case 'GET':
        await handleGetProspects(req, res)
        break
      case 'POST':
        await handleCreateProspect(req, res)
        break
      case 'PUT':
        await handleUpdateProspect(req, res)
        break
      case 'DELETE':
        await handleDeleteProspect(req, res)
        break
      default:
        res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
}

async function handleGetProspects(req, res) {
  const { status, source, qualified, id, search, limit = 100 } = req.query
  
  let query = supabase
    .from('prospects')
    .select(`
      *,
      email_activities(count),
      meeting_activities(count)
    `)
  
  // Apply filters
  if (id) {
    query = query.eq('id', id)
  } else {
    if (status) {
      query = query.eq('status', status)
    }
    
    if (source) {
      query = query.eq('source', source)
    }
    
    if (qualified !== undefined) {
      query = query.eq('qualified', qualified === 'true')
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,industry.ilike.%${search}%`)
    }
  }
  
  // Order and limit
  query = query
    .order('last_activity', { ascending: false })
    .limit(parseInt(limit))
  
  const { data, error } = await query
  
  if (error) {
    console.error('Supabase error:', error)
    return res.status(500).json({ error: 'Failed to fetch prospects' })
  }
  
  res.status(200).json({
    success: true,
    data: data || [],
    total: data?.length || 0,
    timestamp: new Date().toISOString()
  })
}

async function handleCreateProspect(req, res) {
  const prospectData = req.body
  
  // Validate required fields
  if (!prospectData.email || !prospectData.name) {
    return res.status(400).json({ 
      error: 'Email and name are required' 
    })
  }
  
  const { data, error } = await supabase
    .from('prospects')
    .insert([{
      ...prospectData,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) {
    console.error('Supabase error:', error)
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Prospect with this email already exists' })
    }
    return res.status(500).json({ error: 'Failed to create prospect' })
  }
  
  // Log activity
  await logActivity({
    prospect_id: data.id,
    type: 'prospect_created',
    data: { source: data.source }
  })
  
  res.status(201).json({
    success: true,
    data: data,
    message: 'Prospect created successfully'
  })
}

async function handleUpdateProspect(req, res) {
  const { id } = req.query
  const updateData = req.body
  
  if (!id) {
    return res.status(400).json({ error: 'Prospect ID is required' })
  }
  
  const { data, error } = await supabase
    .from('prospects')
    .update({
      ...updateData,
      last_activity: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Supabase error:', error)
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Prospect not found' })
    }
    return res.status(500).json({ error: 'Failed to update prospect' })
  }
  
  // Log activity
  await logActivity({
    prospect_id: data.id,
    type: 'prospect_updated',
    data: updateData
  })
  
  res.status(200).json({
    success: true,
    data: data,
    message: 'Prospect updated successfully'
  })
}

async function handleDeleteProspect(req, res) {
  const { id } = req.query
  
  if (!id) {
    return res.status(400).json({ error: 'Prospect ID is required' })
  }
  
  const { data, error } = await supabase
    .from('prospects')
    .delete()
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Supabase error:', error)
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Prospect not found' })
    }
    return res.status(500).json({ error: 'Failed to delete prospect' })
  }
  
  res.status(200).json({
    success: true,
    data: data,
    message: 'Prospect deleted successfully'
  })
}

// Helper function to log activities
async function logActivity(activityData) {
  try {
    await supabase
      .from('integration_logs')
      .insert([{
        source: 'api',
        event_type: activityData.type,
        prospect_email: null,
        payload: activityData.data,
        processed: true,
        timestamp: new Date().toISOString()
      }])
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

// Helper functions for webhook integrations
export async function findProspectByEmail(email) {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('email', email)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error finding prospect:', error)
  }
  
  return data
}

export async function updateProspectByEmail(email, updateData) {
  const { data, error } = await supabase
    .from('prospects')
    .update({
      ...updateData,
      last_activity: new Date().toISOString()
    })
    .eq('email', email)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating prospect:', error)
    return null
  }
  
  // Log activity
  await logActivity({
    prospect_id: data.id,
    type: 'prospect_updated_by_email',
    data: updateData
  })
  
  return data
}

export async function createProspectFromWebhook(prospectData) {
  // Check if prospect already exists
  const existing = await findProspectByEmail(prospectData.email)
  if (existing) {
    return existing
  }
  
  const { data, error } = await supabase
    .from('prospects')
    .insert([{
      name: prospectData.name || prospectData.email.split('@')[0],
      email: prospectData.email,
      company: prospectData.company || '',
      industry: prospectData.industry || '',
      source: prospectData.source || 'webhook',
      status: 'new',
      qualified: false,
      podcast_score: 0,
      engagement_score: 0,
      tags: [],
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      ...prospectData
    }])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating prospect from webhook:', error)
    return null
  }
  
  // Log activity
  await logActivity({
    prospect_id: data.id,
    type: 'prospect_created_from_webhook',
    data: { source: data.source }
  })
  
  return data
}

export async function logEmailActivity(activityData) {
  const { data, error } = await supabase
    .from('email_activities')
    .insert([{
      prospect_id: activityData.prospect_id,
      email: activityData.email,
      activity_type: activityData.activity_type,
      campaign_name: activityData.campaign_name,
      sequence_step: activityData.sequence_step,
      subject_line: activityData.subject_line,
      metadata: activityData.metadata || {},
      timestamp: activityData.timestamp || new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) {
    console.error('Error logging email activity:', error)
    return null
  }
  
  return data
}

export async function logMeetingActivity(activityData) {
  const { data, error } = await supabase
    .from('meeting_activities')
    .insert([{
      prospect_id: activityData.prospect_id,
      meeting_type: activityData.meeting_type,
      platform: activityData.platform,
      platform_meeting_id: activityData.platform_meeting_id,
      activity_type: activityData.activity_type,
      scheduled_for: activityData.scheduled_for,
      duration_minutes: activityData.duration_minutes,
      attendees: activityData.attendees || {},
      recording_url: activityData.recording_url,
      notes: activityData.notes,
      metadata: activityData.metadata || {},
      timestamp: activityData.timestamp || new Date().toISOString()
    }])
    .select()
    .single()
  
  if (error) {
    console.error('Error logging meeting activity:', error)
    return null
  }
  
  return data
}
