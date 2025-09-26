// /api/import-csv.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { csvData = [], source = 'csv_import' } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    let imported = 0, skipped = 0;

    for (const r of csvData) {
      const row = {
        name: r.name || [r.first_name, r.last_name].filter(Boolean).join(' '),
        email: r.email || null,
        company: r.company || r.company_name || null,
        phone: r.phone || null,
        industry: r.industry || null,
        source,
        pipeline_stage: 'new',
        qualification_score: Number(r.qualification_score || 0) || 0,
        last_activity_date: new Date().toISOString()
      };
      if (!row.name && !row.email) { skipped++; continue; }

      // Upsert by email if present, else insert
      const upsert = row.email
        ? supabase.from('prospects').upsert(row, { onConflict: 'email' }).select()
        : supabase.from('prospects').insert(row).select();

      const { error } = await upsert;
      if (error) { console.warn('CSV insert/upsert error:', error.message); skipped++; }
      else imported++;
    }

    return res.status(200).json({ success: true, results: { imported, skipped } });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
