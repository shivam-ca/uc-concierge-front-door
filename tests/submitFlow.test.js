import { describe, it, expect, vi } from 'vitest';
import { runSubmit, agentUrls } from '../src/lib/submitFlow.js';

const decision = { agent: 'onboarding', confidence: 0.9, reason: '', alternatives: [], provider: 'anthropic', model: 'm', fallback: false, ms: 1 };

function deps(over = {}) {
  const order = [];
  let resolveRoute;
  const d = {
    order,
    newNonce: () => 'abc123',
    openTab: vi.fn(() => { order.push('open'); return { win: {}, blocked: false }; }),
    route: vi.fn(() => { order.push('route'); return new Promise(r => { resolveRoute = r; }); }),
    publish: vi.fn(() => order.push('publish')),
    urls: () => ({ onboarding: 'http://127.0.0.1:8784/' }),
    resolveRoute: (v) => resolveRoute(v),
    ...over,
  };
  return d;
}

describe('runSubmit', () => {
  it('opens the handoff tab synchronously, before routing starts', () => {
    const d = deps();
    runSubmit('new catalog', d);
    expect(d.order).toEqual(['open', 'route']); // nothing awaited before open: popup blockers allow it
    expect(d.openTab).toHaveBeenCalledWith('abc123');
  });
  it('publishes the decision with the agent URLs and returns it', async () => {
    const d = deps();
    const p = runSubmit('new catalog', d);
    d.resolveRoute({ decision });
    await expect(p).resolves.toEqual({ decision, blocked: false, copied: false });
    expect(d.publish).toHaveBeenCalledWith('abc123', { query: 'new catalog', decision, urls: { onboarding: 'http://127.0.0.1:8784/' } });
  });
  it('reports a blocked popup but still routes', async () => {
    const d = deps({ openTab: vi.fn(() => ({ win: null, blocked: true })) });
    const p = runSubmit('q', d);
    d.resolveRoute({ decision });
    await expect(p).resolves.toEqual({ decision, blocked: true, copied: false });
  });
  it('publishes the error to the handoff tab so it does not wait forever', async () => {
    const d = deps();
    const p = runSubmit('q', d);
    d.resolveRoute({ error: 'passcode', message: 'Passcode required.' });
    await expect(p).resolves.toEqual({ error: 'passcode', message: 'Passcode required.', blocked: false });
    expect(d.publish).toHaveBeenCalledWith('abc123', { query: 'q', error: 'Passcode required.' });
  });
});

describe('agentUrls', () => {
  it('resolves a URL (or null) for every routable agent', () => {
    expect(agentUrls({ settings: { urls: { tracker: 'http://t/' } }, env: {} })).toEqual({
      onboarding: 'http://127.0.0.1:8784/onboarding-agent', tracker: 'http://t/', knowledge: 'http://127.0.0.1:8765/chat',
      ownership: 'http://127.0.0.1:8766/stale-owners', access: null,
    });
  });
});

describe('runSubmit clipboard and closed tab', () => {
  it('copies the request synchronously before opening the tab, while the page still has focus', () => {
    const d = deps();
    d.copy = vi.fn(() => { d.order.push('copy'); return Promise.resolve(); });
    runSubmit('new catalog', d);
    expect(d.order.slice(0, 2)).toEqual(['copy', 'open']);
    expect(d.copy).toHaveBeenCalledWith('new catalog');
  });
  it('reports copied only when the clipboard write succeeded', async () => {
    for (const [copy, expected] of [[() => Promise.resolve(), true], [() => Promise.reject(new Error('not focused')), false], [() => { throw new Error('no clipboard'); }, false]]) {
      const d = deps({ copy });
      const p = runSubmit('q', d);
      d.resolveRoute({ decision });
      expect((await p).copied).toBe(expected);
    }
  });
  it('treats a handoff tab the user closed before the decision as blocked', async () => {
    const win = { closed: false };
    const d = deps({ openTab: vi.fn(() => ({ win, blocked: false })) });
    const p = runSubmit('q', d);
    win.closed = true;
    d.resolveRoute({ decision });
    expect((await p).blocked).toBe(true);
  });
});
