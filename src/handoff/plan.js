import { CONFIDENCE_THRESHOLD, getAgent } from '../config/agents.js';
import { buildAgentUrl } from '../lib/agentUrl.js';
import { choicesFor } from '../lib/choices.js';

/**
 * What the handoff tab should do with what the front door sent it:
 * redirect (confident, agent has a UI) | choose (unsure) | soon (no UI) | error.
 */
export function planHandoff(payload) {
  if (!payload) return { kind: 'error', message: 'The request did not reach this tab. Go back to UC Concierge and try again.' };
  if (payload.error) return { kind: 'error', message: payload.error };
  const { query, decision, urls = {} } = payload;
  if (!decision || !getAgent(decision.agent)) return { kind: 'error', message: 'No agent was chosen. Go back to UC Concierge and try again.' };
  if (decision.confidence < CONFIDENCE_THRESHOLD) return { kind: 'choose', choices: [decision, ...choicesFor(decision)] };
  const url = buildAgentUrl(urls[decision.agent] ?? null, query, decision.trace);
  return url ? { kind: 'redirect', agent: decision.agent, url } : { kind: 'soon', agent: decision.agent };
}
