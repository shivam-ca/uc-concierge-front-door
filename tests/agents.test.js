import { describe, it, expect } from 'vitest';
import { AGENTS, ROUTABLE_IDS, getAgent, CONFIDENCE_THRESHOLD } from '../src/config/agents.js';

describe('agent registry', () => {
  it('lists all seven components with unique ids', () => {
    expect(AGENTS.map(a => a.id).sort()).toEqual(['access', 'knowledge', 'onboarding', 'orchestrator', 'ownership', 'tracker', 'validation']);
  });
  it('routes only to the five specialists', () => {
    expect([...ROUTABLE_IDS].sort()).toEqual(['access', 'knowledge', 'onboarding', 'ownership', 'tracker']);
  });
  it('gives every routable agent handles text and at least two examples', () => {
    for (const id of ROUTABLE_IDS) {
      const a = getAgent(id);
      expect(a.handles.length).toBeGreaterThan(40);
      expect(a.examples.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('has no URL for coming-soon and platform entries', () => {
    expect(getAgent('access').defaultUrl).toBeNull();
    expect(getAgent('orchestrator').defaultUrl).toBeNull();
  });
  it('uses 0.6 as the auto-redirect threshold', () => { expect(CONFIDENCE_THRESHOLD).toBe(0.6); });
});
