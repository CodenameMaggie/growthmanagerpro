export default async function handler(req, res) {
  // Debug environment variables
  return res.json({
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    urlPreview: process.env.SUPABASE_URL?.substring(0, 30),
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
  });
}
