import { keywordRoute } from './keywordRouter.js';
import { normalizeDecision } from './normalize.js';

const local = (query) => ({ decision: normalizeDecision(keywordRoute(query), { provider: 'keywords-local', model: null, fallback: true, ms: 0 }) });

/**
 * Asks /api/route. Returns {decision} or a typed {error, message} the user can act on.
 * If the API is unreachable or answers nonsense, routes locally with the same keyword rules, so the page always works.
 */
export async function routeRequest(query, { fetchFn = (...a) => fetch(...a), passcode = '', timeoutMs = 15000 } = {}) {
  // The server gives the LLM 8s; past 15s the API itself is stuck, so stop waiting and route locally.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  let json = null;
  try {
    try {
      res = await fetchFn('/api/route', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(passcode ? { 'x-concierge-passcode': passcode } : {}) },
        body: JSON.stringify({ query }),
        signal: ctrl.signal,
      });
    } catch { return local(query); }
    try { json = await res.json(); } catch {
      if (ctrl.signal.aborted) return local(query);
      json = null;
    }
  } finally { clearTimeout(timer); }
  if (res.status === 401) return { error: 'passcode', message: json?.error || 'Passcode required.' };
  if (res.status === 429) return { error: 'rate', message: json?.error || 'Too many requests. Try again in a minute.' };
  if (res.status === 400) return { error: 'input', message: json?.error || 'Check your request and try again.' };
  if (!res.ok || !json) return local(query);
  const d = normalizeDecision(json, { provider: String(json.provider || 'unknown'), model: json.model ?? null, fallback: Boolean(json.fallback), ms: Number(json.ms) || 0 });
  return d ? { decision: d } : local(query);
}
