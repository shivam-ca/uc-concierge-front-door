import { describe, it, expect } from 'vitest';
import { normalizeDecision } from '../src/lib/normalize.js';

const meta = { provider: 'anthropic', model: 'claude-haiku-5-5', fallback: false, ms: 10 };

describe('normalizeDecision', () => {
  it('passes a valid decision through with meta', () => {
    const d = normalizeDecision({ agent: 'onboarding', confidence: 0.9, reason: 'r', alternatives: [{ agent: 'knowledge', confidence: 0.2, reason: 'k' }] }, meta);
    expect(d).toEqual({ agent: 'onboarding', confidence: 0.9, reason: 'r', alternatives: [{ agent: 'knowledge', confidence: 0.2, reason: 'k' }], ...meta });
  });
  it('returns null for an unknown or platform primary agent', () => {
    expect(normalizeDecision({ agent: 'billing', confidence: 1, reason: '' }, meta)).toBeNull();
    expect(normalizeDecision({ agent: 'orchestrator', confidence: 1, reason: '' }, meta)).toBeNull();
    expect(normalizeDecision(null, meta)).toBeNull();
  });
  it('clamps confidence and coerces non-numbers to 0', () => {
    expect(normalizeDecision({ agent: 'tracker', confidence: 7, reason: '' }, meta).confidence).toBe(1);
    expect(normalizeDecision({ agent: 'tracker', confidence: -1, reason: '' }, meta).confidence).toBe(0);
    expect(normalizeDecision({ agent: 'tracker', confidence: 'high', reason: '' }, meta).confidence).toBe(0);
  });
  it('drops unknown, duplicate and self alternatives and keeps at most two', () => {
    const d = normalizeDecision({ agent: 'tracker', confidence: 0.8, reason: '', alternatives: [
      { agent: 'tracker', confidence: 0.5 }, { agent: 'zzz', confidence: 0.5 }, { agent: 'knowledge', confidence: 0.4 },
      { agent: 'knowledge', confidence: 0.3 }, { agent: 'access', confidence: 0.2 }, { agent: 'ownership', confidence: 0.1 }] }, meta);
    expect(d.alternatives.map(a => a.agent)).toEqual(['knowledge', 'access']);
  });
  it('trims reasons to 240 characters and defaults missing reasons to empty', () => {
    const d = normalizeDecision({ agent: 'tracker', confidence: 0.5, reason: 'x'.repeat(500) }, meta);
    expect(d.reason.length).toBe(240);
    expect(normalizeDecision({ agent: 'tracker', confidence: 0.5 }, meta).reason).toBe('');
  });
});
