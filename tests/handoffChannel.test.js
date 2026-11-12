import { describe, it, expect, vi } from 'vitest';
import { publishDecision, waitForDecision, openHandoffTab, newNonce } from '../src/lib/handoffChannel.js';

// In-memory BroadcastChannel stand-in: every instance on the bus hears the others (not itself), asynchronously like the real one.
function bus() {
  const subs = new Set();
  return () => {
    const ch = {
      onmessage: null,
      postMessage(data) { for (const s of subs) if (s !== ch) queueMicrotask(() => s.onmessage?.({ data })); },
      close() { subs.delete(ch); },
    };
    subs.add(ch);
    return ch;
  };
}
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), size: () => m.size }; };
const payload = { query: 'q', decision: { agent: 'onboarding' } };

describe('handoff channel', () => {
  it('delivers a decision published after the tab subscribed', async () => {
    const channelFactory = bus(), storage = mem();
    const p = waitForDecision('n1', { channelFactory, storage });
    publishDecision('n1', payload, { channelFactory, storage: mem() });
    await expect(p).resolves.toEqual(payload);
  });
  it('delivers a decision published before the tab subscribed (race) via shared storage', async () => {
    const channelFactory = bus(), storage = mem();
    publishDecision('n2', payload, { channelFactory, storage });
    await expect(waitForDecision('n2', { channelFactory, storage })).resolves.toEqual(payload);
  });
  it('delivers before-subscribe decisions without shared storage via ask/answer', async () => {
    const channelFactory = bus();
    publishDecision('n3', payload, { channelFactory, storage: mem() });
    await expect(waitForDecision('n3', { channelFactory, storage: mem() })).resolves.toEqual(payload);
  });
  it('ignores messages for other nonces', async () => {
    const channelFactory = bus(), storage = mem();
    const spy = vi.fn();
    waitForDecision('mine', { channelFactory, storage }).then(spy);
    publishDecision('other', payload, { channelFactory, storage: mem() });
    await new Promise(r => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });
  it('works when BroadcastChannel is unavailable, using storage only', async () => {
    const storage = mem();
    const none = () => { throw new ReferenceError('BroadcastChannel is not defined'); };
    expect(() => publishDecision('n4', payload, { channelFactory: none, storage })).not.toThrow();
    await expect(waitForDecision('n4', { channelFactory: none, storage })).resolves.toEqual(payload);
  });
  it('reports a blocked popup', () => {
    expect(openHandoffTab('n', () => null)).toEqual({ win: null, blocked: true });
    const win = {}; const open = vi.fn(() => win);
    expect(openHandoffTab('n', open)).toEqual({ win, blocked: false });
    expect(open).toHaveBeenCalledWith('/handoff.html#n', '_blank');
  });
  it('makes url-safe unique nonces', () => {
    const a = newNonce(), b = newNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9]{8,}$/);
  });
});

describe('handoff channel storage events', () => {
  it('resolves from a storage event when the decision lands after subscribing and there is no channel', async () => {
    const storage = mem();
    const target = new EventTarget();
    const none = () => { throw new ReferenceError('no BroadcastChannel'); };
    const p = waitForDecision('n5', { channelFactory: none, storage, eventTarget: target });
    publishDecision('n5', payload, { channelFactory: none, storage });
    const e = new Event('storage'); e.key = 'concierge-handoff:n5'; e.newValue = JSON.stringify({ at: Date.now(), payload });
    target.dispatchEvent(e);
    await expect(p).resolves.toEqual(payload);
  });
});

import { sweepHandoffs, severOpener } from '../src/lib/handoffChannel.js';

function store() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, size: () => m.size, raw: m };
}

describe('handoff channel hygiene', () => {
  it('a reader does not consume the entry, so a second (StrictMode) reader still gets it', async () => {
    const storage = store(), none = () => { throw new Error('no channel'); };
    publishDecision('s1', payload, { channelFactory: none, storage });
    await expect(waitForDecision('s1', { channelFactory: none, storage })).resolves.toEqual(payload);
    await expect(waitForDecision('s1', { channelFactory: none, storage })).resolves.toEqual(payload);
  });
  it('an aborted wait never resolves and stops listening', async () => {
    const target = new EventTarget(), ctrl = new AbortController(), spy = vi.fn();
    waitForDecision('s2', { channelFactory: () => { throw new Error(); }, storage: store(), eventTarget: target, signal: ctrl.signal }).then(spy);
    ctrl.abort();
    const e = new Event('storage'); e.key = 'concierge-handoff:s2'; e.newValue = JSON.stringify({ at: Date.now(), payload });
    target.dispatchEvent(e);
    await new Promise(r => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });
  it('ignores a stale entry', async () => {
    const storage = store(), none = () => { throw new Error(); }, spy = vi.fn();
    storage.setItem('concierge-handoff:s3', JSON.stringify({ at: 0, payload }));
    waitForDecision('s3', { channelFactory: none, storage, now: () => 10 * 60 * 1000 }).then(spy);
    await new Promise(r => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });
  it('the publisher removes its entry after keepMs', async () => {
    const storage = store();
    publishDecision('s4', payload, { channelFactory: () => { throw new Error(); }, storage, keepMs: 5 });
    expect(storage.size()).toBe(1);
    await new Promise(r => setTimeout(r, 20));
    expect(storage.size()).toBe(0);
  });
  it('sweepHandoffs removes stale or broken entries and leaves fresh ones and other keys', () => {
    const storage = store(), now = 1_000_000;
    storage.setItem('concierge-handoff:old', JSON.stringify({ at: now - 10 * 60 * 1000, payload }));
    storage.setItem('concierge-handoff:bad', '{oops');
    storage.setItem('concierge-handoff:new', JSON.stringify({ at: now - 1000, payload }));
    storage.setItem('uc-concierge-settings', '{}');
    sweepHandoffs(storage, () => now);
    expect([...storage.raw.keys()].sort()).toEqual(['concierge-handoff:new', 'uc-concierge-settings']);
    expect(() => sweepHandoffs(undefined)).not.toThrow();
  });
  it('severOpener detaches the opener so the agent page cannot redirect the front door', () => {
    const w = { opener: {} };
    severOpener(w);
    expect(w.opener).toBeNull();
    expect(() => severOpener({ get opener() { return {}; }, set opener(v) { throw new Error('ro'); } })).not.toThrow();
  });
});
