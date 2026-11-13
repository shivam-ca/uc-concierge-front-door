import { selectProvider } from './providers.js';
import { keywordRoute } from '../lib/keywordRouter.js';
import { normalizeDecision } from '../lib/normalize.js';

const KNOWN_CAUSES = new Set(['provider-not-configured', 'unknown-provider', 'no-decision', 'invalid-decision']);
// Logs only a coarse cause. Error messages can echo the request (SDK errors quote input), so they are never logged as-is.
const causeOf = (err) => (KNOWN_CAUSES.has(err?.message) ? err.message : err?.name === 'AbortError' || err?.name === 'APIUserAbortError' ? 'timeout' : err?.status ? `http-${err.status}` : 'error');

/** Asks the configured LLM which agent should take the request; any failure falls back to keywords. Never throws.
 * trace: the request's LangSmith trace; the LLM call is recorded under it. */
export async function orchestrate(query, env, { selectProviderFn = selectProvider, now = Date.now, timeoutMs = 8000, trace } = {}) {
  const start = now();
  try {
    const provider = selectProviderFn(env);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const raw = await provider.classify(query, { signal: controller.signal, ...(trace ? { trace } : {}) });
      const d = normalizeDecision(raw, { provider: provider.name, model: provider.model, fallback: false, ms: now() - start });
      if (!d) throw new Error('invalid-decision');
      console.log(JSON.stringify({ route: d.agent, confidence: d.confidence, provider: d.provider, ms: d.ms }));
      return d;
    } finally { clearTimeout(timer); }
  } catch (err) {
    console.log(JSON.stringify({ route: 'fallback', cause: causeOf(err) }));
  }
  return normalizeDecision(keywordRoute(query), { provider: 'keywords', model: null, fallback: true, ms: now() - start });
}
