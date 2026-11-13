import { createHash, timingSafeEqual } from 'node:crypto';
import { orchestrate } from './orchestrate.js';
import { createRateLimiter } from './rateLimit.js';
import { startTrace } from './tracing.js';

const defaultLimiter = createRateLimiter();
const fail = (status, error) => ({ status, json: { error } });
const digest = (s) => createHash('sha256').update(String(s)).digest();
const sameSecret = (given, expected) => typeof given === 'string' && timingSafeEqual(digest(given), digest(expected));

/** POST {query} -> routing Decision. Framework-free so Vercel and the Vite dev server share it. */
export async function handleRoute({ method, headers = {}, body, ip }, env, { orchestrateFn = orchestrate, limiter = defaultLimiter, startTraceFn = startTrace } = {}) {
  if (method !== 'POST') return fail(405, 'Use POST.');
  // Rate limit first, so wrong passcodes count too (no unlimited guessing).
  if (!limiter.hit(ip || 'unknown')) return fail(429, 'Too many requests. Try again in a minute.');
  if (env.CONCIERGE_PASSCODE && !sameSecret(headers['x-concierge-passcode'], env.CONCIERGE_PASSCODE)) return fail(401, 'Passcode required.');
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 1000) return fail(400, 'Describe your request in 1 to 1000 characters.');
  // One LangSmith trace per request (when LANGSMITH_TRACING is on). Its headers go back with the decision so the agent
  // the user is sent to can nest its own runs under this trace: one request, one trace, front door to answer.
  const trace = startTraceFn({ name: 'UC Concierge', inputs: { query }, metadata: { app: 'uc-concierge-front-door', step: 'route' }, tags: ['front-door'] }, env);
  let decision;
  try {
    decision = await orchestrateFn(query, env, { trace });
  } catch (err) {
    trace.fail(err);
    await trace.flush();
    throw err;
  }
  trace.end(decision, { routed_to: decision?.agent, fallback: Boolean(decision?.fallback) });
  await trace.flush();
  const traceHeaders = trace.headers();
  return { status: 200, json: traceHeaders ? { ...decision, trace: traceHeaders } : decision };
}
