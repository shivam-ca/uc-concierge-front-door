import { describe, it, expect, vi } from 'vitest';
import handler from '../api/route.js';

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('api/route (Vercel adapter)', () => {
  it('routes a POST with the keyword fallback when no key is configured, with no-store', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('CONCIERGE_PASSCODE', '');
    const res = fakeRes();
    await handler({ method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }, body: { query: 'I want to create a new catalog' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ agent: 'onboarding', fallback: true });
    expect(res.headers['cache-control']).toBe('no-store');
    vi.unstubAllEnvs();
  });
  it('returns 405 for GET', async () => {
    const res = fakeRes();
    await handler({ method: 'GET', headers: {}, body: undefined }, res);
    expect(res.statusCode).toBe(405);
  });
});
