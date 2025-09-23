import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const prospects = await sql`SELECT * FROM prospects ORDER BY created_at DESC`;
      res.json(prospects.rows);
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
}
