import { describe, it, expect, vi } from 'vitest';
import { handleRoute } from '../src/server/handleRoute.js';
import { createRateLimiter } from '../src/server/rateLimit.js';

const ok = { agent: 'onboarding', confidence: 0.9, reason: '', alternatives: [], provider: 'anthropic', model: 'm', fallback: false, ms: 1 };
const deps = (over = {}) => ({ orchestrateFn: vi.fn().mockResolvedValue(ok), limiter: createRateLimiter(), ...over });
const req = (over = {}) => ({ method: 'POST', headers: {}, body: { query: 'new catalog' }, ip: '1.1.1.1', ...over });

describe('handleRoute', () => {
  it('returns 200 with the decision and passes the trimmed query', async () => {
    const d = deps();
    const out = await handleRoute(req({ body: { query: '  new catalog  ' } }), {}, d);
    expect(out).toEqual({ status: 200, json: ok });
    expect(d.orchestrateFn).toHaveBeenCalledWith('new catalog', {}, { trace: expect.objectContaining({ enabled: false }) });
  });
  it('rejects non-POST with 405', async () => {
    expect((await handleRoute(req({ method: 'GET' }), {}, deps())).status).toBe(405);
  });
  it.each([[undefined], [null], [{}], [{ query: 42 }], [{ query: '   ' }], [{ query: 'x'.repeat(1001) }]])('rejects bad body %j with 400', async (body) => {
    expect((await handleRoute(req({ body }), {}, deps())).status).toBe(400);
  });
  it('accepts exactly 1000 characters', async () => {
    expect((await handleRoute(req({ body: { query: 'x'.repeat(1000) } }), {}, deps())).status).toBe(200);
  });
  it('requires the passcode when CONCIERGE_PASSCODE is set', async () => {
    const env = { CONCIERGE_PASSCODE: 'secret' };
    expect((await handleRoute(req(), env, deps())).status).toBe(401);
    expect((await handleRoute(req({ headers: { 'x-concierge-passcode': 'nope' } }), env, deps())).status).toBe(401);
    expect((await handleRoute(req({ headers: { 'x-concierge-passcode': 'secret' } }), env, deps())).status).toBe(200);
  });
  it('rate limits per IP with 429', async () => {
    const d = deps({ limiter: createRateLimiter({ limit: 2 }) });
    await handleRoute(req(), {}, d); await handleRoute(req(), {}, d);
    expect((await handleRoute(req(), {}, d)).status).toBe(429);
    expect((await handleRoute(req({ ip: '2.2.2.2' }), {}, d)).status).toBe(200);
  });
});

describe('createRateLimiter', () => {
  it('resets after the window', () => {
    let t = 0;
    const l = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(l.hit('a')).toBe(true);
    expect(l.hit('a')).toBe(false);
    t = 1001;
    expect(l.hit('a')).toBe(true);
  });
});

describe('handleRoute passcode brute force', () => {
  it('counts wrong passcodes against the rate limit', async () => {
    const d = deps({ limiter: createRateLimiter({ limit: 20 }) });
    const env = { CONCIERGE_PASSCODE: 'secret' };
    const statuses = [];
    for (let i = 0; i < 21; i++) statuses.push((await handleRoute(req({ headers: { 'x-concierge-passcode': `guess${i}` } }), env, d)).status);
    expect(statuses.slice(0, 20).every(s => s === 401)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
