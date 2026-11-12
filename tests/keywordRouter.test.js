import { describe, it, expect } from 'vitest';
import { keywordRoute } from '../src/lib/keywordRouter.js';

// The spec's success criteria: these must keep routing correctly even with no LLM.
const golden = [
  ['I want to create a new catalog', 'onboarding'],
  ['How do I onboard an inbound Delta Share from 84.51?', 'onboarding'],
  ['Which form do I use for a new schema?', 'onboarding'],
  ['Get me the latest email from Alex about the request', 'tracker'],
  ['Log a tracker record for the Teams message', 'tracker'],
  ['What are the catalog naming standards?', 'knowledge'],
  ['What is the difference between a managed and external table?', 'knowledge'],
  ['Who owns the sales schema?', 'ownership'],
  ['Show data sources with stale owners', 'ownership'],
  ['I need read access to the finance catalog', 'access'],
];

describe('keywordRoute', () => {
  it.each(golden)('%s -> %s', (q, agent) => { expect(keywordRoute(q).agent).toBe(agent); });
  it('falls back to knowledge with low confidence when nothing matches', () => {
    const d = keywordRoute('hello there');
    expect(d.agent).toBe('knowledge');
    expect(d.confidence).toBeLessThan(0.6);
  });
  it('returns up to two alternatives that differ from the primary', () => {
    const d = keywordRoute('I need access to a new catalog');
    expect(d.alternatives.length).toBeLessThanOrEqual(2);
    expect(d.alternatives.map(a => a.agent)).not.toContain(d.agent);
  });
  it('caps confidence at 0.85 so keyword matches never look like LLM certainty', () => {
    expect(keywordRoute('create a new catalog onboarding form schema share').confidence).toBeLessThanOrEqual(0.85);
  });
});
