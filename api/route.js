import { handleRoute } from '../src/server/handleRoute.js';

// Vercel Node function. Vercel parses JSON bodies into req.body.
export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const out = await handleRoute({ method: req.method, headers: req.headers, body: req.body, ip }, process.env);
  res.status(out.status).setHeader('cache-control', 'no-store').json(out.json);
}
