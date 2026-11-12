import { CONFIDENCE_THRESHOLD, ROUTABLE_IDS, getAgent } from '../config/agents.js';

/**
 * The "other options" to show beside the chosen agent. When the router is unsure, every other agent is offered
 * (its alternatives first, then the rest in registry order), so the user can always reach the right one.
 */
export function choicesFor(decision) {
  const alts = decision.alternatives || [];
  if (decision.confidence >= CONFIDENCE_THRESHOLD) return alts;
  const seen = new Set([decision.agent, ...alts.map(a => a.agent)]);
  const rest = ROUTABLE_IDS.filter(id => !seen.has(id)).map(id => ({ agent: id, confidence: 0, reason: getAgent(id).tagline }));
  return [...alts, ...rest];
}
