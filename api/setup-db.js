import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  await sql`CREATE TABLE IF NOT EXISTS prospects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    company VARCHAR(255),
    status VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  res.json({ message: 'Database ready' });
}
