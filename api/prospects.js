// /api/prospects.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // CORS for GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      where: 'env',
      message: 'Missing Supabase env vars',
      details: {
        NEXT_PUBLIC_SUPABASE_URL: !!url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!key
      }
    });
  }

  try {
    const supabase = createClient(url, key);

    // 1) Ping table to catch RLS/table issues early
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

    // 2) Safe fetch — no fragile column list
    const { data, error } = await supabase
      .from('prospects')
      .select('*')       // <-- avoids unknown column errors
      .order('id', { ascending: false })
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

    // 3) Normalize to the shape your UI expects
    const prospects = (data || []).map(r => ({
      id: r.id,
      name: r.name ?? '',
      email: r.email ?? '',
      company: r.company ?? '',
      qualification_score: r.qualification_score ?? 0,
      pipeline_stage: r.pipeline_stage ?? 'new',
      // unify possible schema variants or absence
      industry: r.industry ?? r.sector ?? r.vertical ?? '',
      phone: r.phone ?? '',
      source: r.source ?? 'Supabase',
      // keep anything else you like:
      last_activity_date: r.last_activity_date ?? null,
      instantly_campaign_id: r.instantly_campaign_id ?? null
    }));

    return res.status(200).json({ ok: true, prospects });
  } catch (e) {
    return res.status(500).json({ ok: false, where: 'catch', message: e.message });
  }
};
