import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const { takeConciergeRequest, fitRequest } = createRequire(import.meta.url)('../agent-patches/prefill/concierge-prefill.js');

describe('takeConciergeRequest', () => {
  it('reads q and returns the address without q/from', () => {
    expect(takeConciergeRequest('http://127.0.0.1:8784/?q=I+want+a+catalog&from=concierge')).toEqual({ q: 'I want a catalog', cleanUrl: '/' });
  });
  it('keeps other params and the hash', () => {
    expect(takeConciergeRequest('http://h/v7?x=1&q=a%26b&from=concierge#log')).toEqual({ q: 'a&b', cleanUrl: '/v7?x=1#log' });
  });
  it('ignores links not from the concierge, blank q, or no q', () => {
    expect(takeConciergeRequest('http://h/?q=hi')).toBeNull();
    expect(takeConciergeRequest('http://h/?q=%20&from=concierge')).toBeNull();
    expect(takeConciergeRequest('http://h/?session=abc')).toBeNull();
  });
  it('round-trips what the front door builds', async () => {
    const { buildAgentUrl } = await import('../src/lib/agentUrl.js');
    const q = 'Who owns "sales" & finance? 100% sure #1';
    expect(takeConciergeRequest(buildAgentUrl('http://127.0.0.1:8765/v7#log', q))).toEqual({ q, cleanUrl: '/v7#log' });
  });
});

describe('fitRequest', () => {
  it('leaves short text alone', () => { expect(fitRequest('abc', 500)).toEqual({ text: 'abc', cut: false }); });
  it('cuts long text to the box limit and flags it', () => {
    const r = fitRequest('x'.repeat(600), 500);
    expect(r.text.length).toBe(500);
    expect(r.cut).toBe(true);
  });
});

describe('takeConciergeRequest with a LangSmith trace', () => {
  it('returns the trace headers and strips them from the address', async () => {
    const { buildAgentUrl } = await import('../src/lib/agentUrl.js');
    const trace = { 'langsmith-trace': '20261113T081013869001Z01a1d3f5-09ed-7000-8000-006ec3bdaaff', baggage: 'langsmith-project=uc-concierge-suite' };
    expect(takeConciergeRequest(buildAgentUrl('http://127.0.0.1:8784/onboarding-agent?x=1', 'new catalog', trace)))
      .toEqual({ q: 'new catalog', cleanUrl: '/onboarding-agent?x=1', trace });
  });
});
