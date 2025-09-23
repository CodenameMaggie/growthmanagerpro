import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .limit(1)
    
    if (error) {
      return res.status(500).json({ 
        error: 'Supabase error', 
        details: error.message,
        code: error.code
      })
    }
    
    res.status(200).json({
      success: true,
      message: 'Supabase connection working',
      data: data,
      env_vars: {
        has_url: !!process.env.SUPABASE_URL,
        has_key: !!process.env.SUPABASE_ANON_KEY,
        url_preview: process.env.SUPABASE_URL?.substring(0, 30) + '...'
      }
    })
    
  } catch (error) {
    res.status(500).json({
      error: 'Connection failed',
      message: error.message,
      stack: error.stack
    })
  }
}
