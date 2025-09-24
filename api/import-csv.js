const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { csvData, source } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ error: 'Invalid CSV data format' });
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const row of csvData) {
      try {
        // Clean and validate required fields
        const name = (row.name || row.Name || row.first_name || row.First_Name || '').trim();
        const email = (row.email || row.Email || '').trim().toLowerCase();
        const company = (row.company || row.Company || row.organization || '').trim();
        
        // Skip rows without name or email
        if (!name || !email) {
          results.skipped++;
          continue;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.errors.push(`Invalid email format: ${email}`);
          results.skipped++;
          continue;
        }

        // Check if prospect already exists
        const { data: existing } = await supabase
          .from('prospects')
          .select('id')
          .eq('email', email)
          .single();

        if (existing) {
          results.skipped++;
          continue;
        }

        // Prepare prospect data
        const prospectData = {
          name: name,
          email: email,
          company: company || null,
          status: 'new',
          pipeline_stage: 'new',
          source: source || 'csv_import',
          qualification_score: 0,
          last_activity_date: new Date().toISOString(),
          // Map additional CSV fields
          phone: (row.phone || row.Phone || row.mobile || '').trim() || null,
          industry: (row.industry || row.Industry || '').trim() || null,
          title: (row.title || row.Title || row.position || '').trim() || null,
          website: (row.website || row.Website || row.url || '').trim() || null,
          linkedin: (row.linkedin || row.LinkedIn || row.linkedin_url || '').trim() || null,
          notes: (row.notes || row.Notes || row.description || '').trim() || null
        };

        // Insert prospect
        const { error: insertError } = await supabase
          .from('prospects')
          .insert(prospectData);

        if (insertError) {
          results.errors.push(`Error importing ${name}: ${insertError.message}`);
          results.skipped++;
        } else {
          results.imported++;
        }

      } catch (error) {
        results.errors.push(`Error processing row: ${error.message}`);
        results.skipped++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Import completed: ${results.imported} imported, ${results.skipped} skipped`,
      results: results
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return res.status(500).json({ error: error.message });
  }
};
