import { describe, it, expect, vi } from 'vitest';
import { routeRequest } from '../src/lib/routeClient.js';

const res = (status, json) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(json) });
const decision = { agent: 'tracker', confidence: 0.8, reason: '', alternatives: [], provider: 'anthropic', model: 'm', fallback: false, ms: 3 };

describe('routeRequest', () => {
  it('posts the query and returns the decision', async () => {
    const fetchFn = vi.fn(() => res(200, decision));
    expect(await routeRequest('find email', { fetchFn, passcode: 'p' })).toEqual({ decision });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/route');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ query: 'find email' });
    expect(init.headers['x-concierge-passcode']).toBe('p');
  });
  it('sends no passcode header when none is set', async () => {
    const fetchFn = vi.fn(() => res(200, decision));
    await routeRequest('x', { fetchFn });
    expect(fetchFn.mock.calls[0][1].headers['x-concierge-passcode']).toBeUndefined();
  });
  it('maps 401, 429 and 400 to typed errors', async () => {
    expect((await routeRequest('x', { fetchFn: () => res(401, { error: 'Passcode required.' }) })).error).toBe('passcode');
    expect((await routeRequest('x', { fetchFn: () => res(429, { error: 'slow' }) })).error).toBe('rate');
    expect((await routeRequest('x', { fetchFn: () => res(400, { error: 'bad' }) })).error).toBe('input');
  });
  it('falls back to local keywords on network error, 5xx or a malformed body', async () => {
    for (const fetchFn of [() => Promise.reject(new TypeError('offline')), () => res(500, {}), () => res(200, { agent: 'zzz' }), () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('html')) })]) {
      const out = await routeRequest('I want to create a new catalog', { fetchFn });
      expect(out.decision).toMatchObject({ agent: 'onboarding', provider: 'keywords-local', fallback: true });
    }
  });
});
