import { getAgent } from '../config/agents.js';

// A usable candidate: non-blank and a valid http(s) address. Anything else falls through to the next source.
const clean = (v) => (typeof v === 'string' && v.trim() && !urlProblem(v) ? v.trim() : null);

/** Settings (this browser) beat build-time env, which beats the registry default; invalid values are skipped. */
export function resolveAgentUrl(id, { settings = {}, env = {} } = {}) {
  const agent = getAgent(id);
  if (!agent || agent.kind === 'platform') return null;
  return clean(settings.urls?.[id]) ?? clean(env[`VITE_AGENT_URL_${id.toUpperCase()}`]) ?? agent.defaultUrl ?? null;
}

/** Adds q and from=concierge, keeping any existing query and hash. Null for missing, malformed or non-http(s) URLs. */
export function buildAgentUrl(baseUrl, query) {
  if (!baseUrl) return null;
  let url;
  try { url = new URL(baseUrl); } catch { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.searchParams.delete('q');
  url.searchParams.delete('from');
  url.searchParams.set('q', query);
  url.searchParams.set('from', 'concierge');
  return url.toString();
}

/** Agents whose URLs point at the same host:port: only one of them can be running there. */
export function findPortClashes(urlsById) {
  const byHost = new Map();
  for (const [id, raw] of Object.entries(urlsById)) {
    if (!raw) continue;
    let u;
    try { u = new URL(raw); } catch { continue; }
    const hostPort = `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
    byHost.set(hostPort, [...(byHost.get(hostPort) || []), id]);
  }
  return [...byHost].filter(([, ids]) => ids.length > 1).map(([hostPort, ids]) => ({ hostPort, ids }));
}

/** Settings validation: null when the value is usable (blank means "use the default"), otherwise a short fix-it message. */
export function urlProblem(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  let u;
  try { u = new URL(v); } catch { return 'Enter a full address starting with http:// or https://'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Enter a full address starting with http:// or https://';
  return null;
}
