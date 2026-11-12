import { ROUTABLE_IDS } from '../config/agents.js';

const clamp = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const text = (s) => (typeof s === 'string' ? s.trim().slice(0, 240) : '');

/**
 * Turns whatever a router produced (LLM output, keywords, a server response) into a safe Decision,
 * or null when there is no valid primary agent. Alternatives: known, distinct, not the primary, at most two.
 */
export function normalizeDecision(raw, meta) {
  if (!raw || !ROUTABLE_IDS.includes(raw.agent)) return null;
  const seen = new Set([raw.agent]);
  const alternatives = [];
  for (const alt of Array.isArray(raw.alternatives) ? raw.alternatives : []) {
    if (!alt || !ROUTABLE_IDS.includes(alt.agent) || seen.has(alt.agent)) continue;
    seen.add(alt.agent);
    alternatives.push({ agent: alt.agent, confidence: clamp(alt.confidence), reason: text(alt.reason) });
    if (alternatives.length === 2) break;
  }
  return { agent: raw.agent, confidence: clamp(raw.confidence), reason: text(raw.reason), alternatives, ...meta };
}
