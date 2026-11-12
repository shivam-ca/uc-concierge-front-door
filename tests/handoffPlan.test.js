import { describe, it, expect } from 'vitest';
import { planHandoff } from '../src/handoff/plan.js';

const urls = { onboarding: 'http://127.0.0.1:8784/', tracker: 'http://127.0.0.1:8765/v7', knowledge: null, ownership: null, access: null };
const d = (agent, confidence, alternatives = []) => ({ agent, confidence, reason: '', alternatives });

describe('planHandoff', () => {
  it('redirects when confident and the agent has a URL', () => {
    expect(planHandoff({ query: 'new catalog', decision: d('onboarding', 0.9), urls }))
      .toEqual({ kind: 'redirect', agent: 'onboarding', url: 'http://127.0.0.1:8784/?q=new+catalog&from=concierge' });
  });
  it('redirects at exactly the threshold', () => {
    expect(planHandoff({ query: 'x', decision: d('onboarding', 0.6), urls }).kind).toBe('redirect');
  });
  it('asks the user to choose when confidence is low: primary first, then alternatives, then every other agent', () => {
    const p = planHandoff({ query: 'x', decision: d('tracker', 0.4, [{ agent: 'knowledge', confidence: 0.3, reason: '' }]), urls });
    expect(p.kind).toBe('choose');
    expect(p.choices.map(c => c.agent)).toEqual(['tracker', 'knowledge', 'onboarding', 'ownership', 'access']);
  });
  it('shows coming soon when the agent has no URL', () => {
    expect(planHandoff({ query: 'x', decision: d('access', 0.95), urls })).toEqual({ kind: 'soon', agent: 'access' });
  });
  it('treats a malformed configured URL as not configured', () => {
    expect(planHandoff({ query: 'x', decision: d('onboarding', 0.95), urls: { onboarding: 'not a url' } })).toEqual({ kind: 'soon', agent: 'onboarding' });
  });
  it('passes an error payload through, and treats a missing or invalid payload as an error', () => {
    expect(planHandoff({ query: 'x', error: 'Passcode required.' })).toEqual({ kind: 'error', message: 'Passcode required.' });
    expect(planHandoff(null).kind).toBe('error');
    expect(planHandoff({ query: 'x', decision: d('zzz', 1), urls }).kind).toBe('error');
  });
});
