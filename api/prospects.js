// /api/prospects.js  (Vercel serverless)
// Node runtime 18+ (default). CommonJS is fine.

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS for GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1) Check env vars early
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      where: 'env',
      message: 'Missing Supabase env vars',
      details: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(url),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(key)
      }
    });
  }

  try {
    const supabase = createClient(url, key);

    // 2) Lightweight ping to catch RLS / table existence problems
    const ping = await supabase.from('prospects').select('id').limit(1);
    if (ping.error) {
      return res.status(500).json({
        ok: false,
        where: 'ping',
        message: 'Supabase ping failed',
        supabase_error: {
          message: ping.error.message,
          details: ping.error.details,
          hint: ping.error.hint,
          code: ping.error.code
        }
      });
    }

    // 3) Safe SELECT — only columns you’re sure exist
    // (add more fields once this succeeds)
    const { data, error } = await supabase
      .from('prospects')
      .select('id,name,email,company,qualification_score,pipeline_stage,industry,phone,source')   // <— adjust to your schema
      .limit(50);

    if (error) {
      return res.status(500).json({
        ok: false,
        where: 'select',
        message: 'Supabase select failed',
        supabase_error: {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        }
      });
    }

    return res.status(200).json({ ok: true, prospects: data || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, where: 'catch', message: e.message });
  }
};
