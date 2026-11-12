// Deterministic fallback for when the LLM is unavailable. Weighted patterns per agent; the best score wins.
const RULES = {
  onboarding: [
    [/\b(create|new|set ?up|provision|onboard(ing)?)\b.*\b(catalog|schema|volume|share|workspace|external location)s?\b/i, 3],
    [/\bdelta share|84\.?51|inbound share|outbound share\b/i, 3],
    [/\bonboard(ing)?\b/i, 2],
    [/\b(which|what) form\b|\bform\b/i, 1.5],
  ],
  tracker: [
    [/\b(email|e-mail|mail|outlook|teams message|thread|inbox)s?\b/i, 3],
    [/\btracker\b|\blog (a |the )?(record|request|work)\b/i, 3],
    [/\b(from|sent by) [A-Z][a-z]+/, 1],
  ],
  knowledge: [[/\b(what is|what are|how (do|does|to)|explain|difference between|standards?|policy|policies|best practices?|naming)\b/i, 2]],
  ownership: [[/\bwho owns\b|\bowner(s|ship)?\b/i, 3], [/\bstale|departed|left the company|anonymous owner\b/i, 2]],
  access: [
    [/\b(need|request|get|grant|give me)\b.*\baccess\b|\baccess to\b/i, 3],
    [/\bapt role|\biam\b|permission to read|read access|write access\b/i, 2],
  ],
};

const REASONS = {
  onboarding: 'Mentions creating or onboarding a UC object, a share, or a form.',
  tracker: 'Mentions emails, Teams messages or tracker records.',
  knowledge: 'Reads as a general Unity Catalog question.',
  ownership: 'Mentions owners or ownership.',
  access: 'Asks for access to data.',
};

export function keywordRoute(query) {
  const scores = Object.entries(RULES)
    .map(([agent, rules]) => [agent, rules.reduce((s, [re, w]) => s + (re.test(query) ? w : 0), 0)])
    .sort((a, b) => b[1] - a[1]);
  const [topAgent, top] = scores[0];
  if (top === 0) {
    return { agent: 'knowledge', confidence: 0.3, reason: 'No clear match; the Knowledge Agent can help work out what you need.', alternatives: [] };
  }
  const confidence = Math.min(0.85, 0.45 + top * 0.1);
  const alternatives = scores.slice(1).filter(([, s]) => s > 0).slice(0, 2)
    .map(([agent, s]) => ({ agent, confidence: Math.min(0.85, 0.3 + s * 0.08), reason: REASONS[agent] }));
  return { agent: topAgent, confidence, reason: REASONS[topAgent], alternatives };
}
