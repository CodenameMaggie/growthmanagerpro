// api/prospects.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Debug: Show what env vars we have
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    return res.status(200).json({ 
      debug: {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        urlPreview: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'missing',
        keyPreview: supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'missing'
      }
    });
    
  } catch (e) {
    return res.status(500).json({ 
      error: "Catch block", 
      details: e.message
    });
  }
};
