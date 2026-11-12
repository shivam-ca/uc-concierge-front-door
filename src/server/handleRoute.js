import { createHash, timingSafeEqual } from 'node:crypto';
import { orchestrate } from './orchestrate.js';
import { createRateLimiter } from './rateLimit.js';

const defaultLimiter = createRateLimiter();
const fail = (status, error) => ({ status, json: { error } });
const digest = (s) => createHash('sha256').update(String(s)).digest();
const sameSecret = (given, expected) => typeof given === 'string' && timingSafeEqual(digest(given), digest(expected));

/** POST {query} -> routing Decision. Framework-free so Vercel and the Vite dev server share it. */
export async function handleRoute({ method, headers = {}, body, ip }, env, { orchestrateFn = orchestrate, limiter = defaultLimiter } = {}) {
  if (method !== 'POST') return fail(405, 'Use POST.');
  // Rate limit first, so wrong passcodes count too (no unlimited guessing).
  if (!limiter.hit(ip || 'unknown')) return fail(429, 'Too many requests. Try again in a minute.');
  if (env.CONCIERGE_PASSCODE && !sameSecret(headers['x-concierge-passcode'], env.CONCIERGE_PASSCODE)) return fail(401, 'Passcode required.');
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 1000) return fail(400, 'Describe your request in 1 to 1000 characters.');
  return { status: 200, json: await orchestrateFn(query, env) };
}
