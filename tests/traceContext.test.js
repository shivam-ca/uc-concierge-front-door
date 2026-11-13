import { describe, it, expect, vi } from 'vitest';
import { cleanTrace } from '../src/lib/traceContext.js';
import { buildAgentUrl } from '../src/lib/agentUrl.js';
import { routeRequest } from '../src/lib/routeClient.js';
import { planHandoff } from '../src/handoff/plan.js';

const ID = '0b8a1e3c-1111-4222-8333-944455556666';
const trace = { 'langsmith-trace': `20261113T080000000000Z${ID}`, baggage: 'langsmith-project=uc-concierge-suite,langsmith-metadata=%7B%7D' };

describe('cleanTrace', () => {
  it('keeps well-formed headers, including nested dotted orders', () => {
    expect(cleanTrace(trace)).toEqual(trace);
    const nested = `${trace['langsmith-trace']}.20261113T080000100000Z${ID}`;
    expect(cleanTrace({ 'langsmith-trace': nested })).toEqual({ 'langsmith-trace': nested, baggage: '' });
  });
  it('drops anything malformed', () => {
    for (const bad of [null, 'x', {}, { 'langsmith-trace': 'abc' }, { 'langsmith-trace': `${trace['langsmith-trace']}<script>` }])
      expect(cleanTrace(bad)).toBeNull();
    expect(cleanTrace({ ...trace, baggage: 'a\nb' }).baggage).toBe('');
  });
});

describe('buildAgentUrl with a trace', () => {
  it('adds lstrace and lsbaggage beside q and from', () => {
    const u = new URL(buildAgentUrl('http://127.0.0.1:8784/onboarding-agent', 'new catalog', trace));
    expect(u.searchParams.get('q')).toBe('new catalog');
    expect(u.searchParams.get('from')).toBe('concierge');
    expect(u.searchParams.get('lstrace')).toBe(trace['langsmith-trace']);
    expect(u.searchParams.get('lsbaggage')).toBe(trace.baggage);
  });
  it('leaves them out without a valid trace, and replaces stale ones in the base URL', () => {
    const u = new URL(buildAgentUrl('http://h/x?lstrace=old&lsbaggage=old', 'q', { 'langsmith-trace': 'bad' }));
    expect(u.searchParams.has('lstrace')).toBe(false);
    expect(u.searchParams.has('lsbaggage')).toBe(false);
  });
});

describe('the trace travels from /api/route to the hand-off URL', () => {
  it('routeRequest keeps a valid trace and drops a bad one', async () => {
    const body = { agent: 'onboarding', confidence: 0.9, reason: '', alternatives: [], provider: 'anthropic', model: 'm', fallback: false, ms: 1 };
    const res = (json) => vi.fn(async () => ({ status: 200, ok: true, json: async () => json }));
    expect((await routeRequest('q', { fetchFn: res({ ...body, trace }) })).decision.trace).toEqual(trace);
    expect((await routeRequest('q', { fetchFn: res({ ...body, trace: { 'langsmith-trace': 'x' } }) })).decision).not.toHaveProperty('trace');
  });
  it('planHandoff redirects with the trace on the agent URL', () => {
    const plan = planHandoff({ query: 'new catalog', decision: { agent: 'onboarding', confidence: 0.9, alternatives: [], trace }, urls: { onboarding: 'http://127.0.0.1:8784/onboarding-agent' } });
    expect(plan.kind).toBe('redirect');
    expect(new URL(plan.url).searchParams.get('lstrace')).toBe(trace['langsmith-trace']);
  });
});
