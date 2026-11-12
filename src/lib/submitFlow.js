import { ROUTABLE_IDS } from '../config/agents.js';
import { resolveAgentUrl } from './agentUrl.js';

/** Where each routable agent lives for this user right now (null = no UI configured). */
export function agentUrls({ settings, env }) {
  return Object.fromEntries(ROUTABLE_IDS.map(id => [id, resolveAgentUrl(id, { settings, env })]));
}

// Clipboard writes only succeed while this page has focus and the click is live, so this runs first.
function startCopy(copy, query) {
  if (!copy) return Promise.resolve(false);
  try { return Promise.resolve(copy(query)).then(() => true, () => false); } catch { return Promise.resolve(false); }
}

/**
 * One submit, in the only order browsers accept: copy the request and open the handoff tab synchronously, inside the
 * user's click; then route; then tell the tab. Errors are published too, so the tab never hangs.
 * `blocked` is also true when the user closed the handoff tab before the decision came back.
 */
export function runSubmit(query, { newNonce, openTab, route, publish, urls, copy }) {
  const copied = startCopy(copy, query);
  const nonce = newNonce();
  const { win, blocked } = openTab(nonce);
  return Promise.all([route(query), copied]).then(([out, wasCopied]) => {
    const gone = blocked || Boolean(win?.closed);
    if (out.error) {
      if (!gone) publish(nonce, { query, error: out.message });
      return { error: out.error, message: out.message, blocked: gone };
    }
    if (!gone) publish(nonce, { query, decision: out.decision, urls: urls() });
    return { decision: out.decision, blocked: gone, copied: wasCopied };
  });
}
