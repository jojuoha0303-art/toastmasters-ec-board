import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://shzfjiujdziuosefqxsl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoemZqaXVqZHppdW9zZWZxeHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODc0OTIsImV4cCI6MjA5NTU2MzQ5Mn0.fuPqex83Ik8xmkhD6iwbFh3cBQqLW2mMSIdP1fBYh0U';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // 論理削除されていないものだけ取得
    const r = await fetch(`${SUPABASE_URL}/rest/v1/otmc_topics?select=*&deleted=eq.false&order=created_at.asc`, { headers });
    const data = await r.json();
    return res.status(r.status).json(data);
  }

  if (req.method === 'POST') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/otmc_topics`, {
      method: 'POST', headers, body: JSON.stringify(req.body),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
