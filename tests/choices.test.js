import { describe, it, expect } from 'vitest';
import { choicesFor } from '../src/lib/choices.js';

const d = (agent, confidence, alternatives = []) => ({ agent, confidence, reason: 'r', alternatives });

describe('choicesFor', () => {
  it('returns just the alternatives when confident', () => {
    expect(choicesFor(d('tracker', 0.9, [{ agent: 'knowledge', confidence: 0.3, reason: 'k' }])).map(c => c.agent)).toEqual(['knowledge']);
  });
  it('when unsure, lists every other routable agent: alternatives first, then the rest in registry order', () => {
    expect(choicesFor(d('knowledge', 0.3, [{ agent: 'ownership', confidence: 0.2, reason: 'o' }])).map(c => c.agent))
      .toEqual(['ownership', 'onboarding', 'tracker', 'access']);
  });
  it('gives padded agents their tagline as the reason', () => {
    const c = choicesFor(d('knowledge', 0.3)).find(x => x.agent === 'onboarding');
    expect(c.reason).toMatch(/form/);
    expect(c.confidence).toBe(0);
  });
});
