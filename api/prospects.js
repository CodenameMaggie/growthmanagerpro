export default async function handler(req, res) {
  res.json({ 
    message: "API is working",
    env_check: {
      has_url: !!process.env.SUPABASE_URL,
      has_key: !!process.env.SUPABASE_ANON_KEY
    }
  });
}
