// api/prospects.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Debug: Check if env vars exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ 
        error: "Missing env vars", 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .order('last_activity', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ 
        error: "Supabase query error", 
        details: error.message,
        code: error.code 
      });
    }

    return res.status(200).json({ prospects: data });
    
  } catch (e) {
    return res.status(500).json({ 
      error: "Database error", 
      details: e.message,
      stack: e.stack?.split('\n')[0] // First line of stack trace
    });
  }
};
