import { GoogleGenAI } from '@google/genai';

// ⚠️ CAMBIAR esto por tu dominio real de Vercel antes de deployar
const ALLOWED_ORIGIN = 'https://talk-to-me-pro.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI Tutor not configured on the server yet.' });

  try {
    const client = new GoogleGenAI({ apiKey });
    const now = Date.now();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    if (!token?.name) throw new Error('Google returned an empty token.');
    res.status(200).json({ token: token.name });
  } catch (err) {
    console.error('gemini-token function error:', err);
    res.status(500).json({ error: err?.message || 'Unexpected server error.' });
  }
}
