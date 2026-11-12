import { ROUTABLE_IDS } from '../config/agents.js';
import { resolveAgentUrl } from './agentUrl.js';

/** Where each routable agent lives for this user right now (null = no UI configured). */
export function agentUrls({ settings, env }) {
  return Object.fromEntries(ROUTABLE_IDS.map(id => [id, resolveAgentUrl(id, { settings, env })]));
}

/**
 * One submit, in the only order popup blockers accept: open the handoff tab first, synchronously,
 * inside the user's click; then route; then tell the tab. Errors are published too, so the tab never hangs.
 */
export function runSubmit(query, { newNonce, openTab, route, publish, urls }) {
  const nonce = newNonce();
  const { blocked } = openTab(nonce);
  return route(query).then((out) => {
    if (out.error) {
      publish(nonce, { query, error: out.message });
      return { error: out.error, message: out.message, blocked };
    }
    publish(nonce, { query, decision: out.decision, urls: urls() });
    return { decision: out.decision, blocked };
  });
}
