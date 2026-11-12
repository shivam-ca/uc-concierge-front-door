import { describe, it, expect, vi, afterEach } from 'vitest';
import { orchestrate } from '../src/server/orchestrate.js';

const provider = (classify) => () => ({ name: 'anthropic', model: 'claude-haiku-5-5', classify });
afterEach(() => vi.restoreAllMocks());

describe('orchestrate', () => {
  it('returns the normalized LLM decision with provider meta', async () => {
    const d = await orchestrate('new catalog', {}, { selectProviderFn: provider(async () => ({ agent: 'onboarding', confidence: 0.9, reason: 'r', alternatives: [] })) });
    expect(d).toMatchObject({ agent: 'onboarding', confidence: 0.9, provider: 'anthropic', model: 'claude-haiku-5-5', fallback: false });
    expect(typeof d.ms).toBe('number');
  });
  it('falls back to keywords when the provider is not configured', async () => {
    const d = await orchestrate('I want to create a new catalog', {}, { selectProviderFn: () => { throw new Error('provider-not-configured'); } });
    expect(d).toMatchObject({ agent: 'onboarding', provider: 'keywords', model: null, fallback: true });
  });
  it('falls back when the provider throws', async () => {
    const d = await orchestrate('Who owns the sales schema?', {}, { selectProviderFn: provider(async () => { throw new Error('500'); }) });
    expect(d).toMatchObject({ agent: 'ownership', fallback: true });
  });
  it('falls back when the LLM returns an invalid agent', async () => {
    const d = await orchestrate('Who owns the sales schema?', {}, { selectProviderFn: provider(async () => ({ agent: 'hr', confidence: 1, reason: '' })) });
    expect(d).toMatchObject({ agent: 'ownership', fallback: true });
  });
  it('falls back after the timeout and aborts the call', async () => {
    let aborted = false;
    const classify = (q, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }));
    const d = await orchestrate('I need read access to finance', {}, { selectProviderFn: provider(classify), timeoutMs: 20 });
    expect(d).toMatchObject({ agent: 'access', fallback: true });
    expect(aborted).toBe(true);
  });
  it('never logs the request text', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const secret = 'Who owns the PAYROLL-SECRET schema?';
    await orchestrate(secret, {}, { selectProviderFn: provider(async () => ({ agent: 'ownership', confidence: 0.9, reason: '', alternatives: [] })) });
    await orchestrate(secret, {}, { selectProviderFn: provider(async () => { throw new Error(secret); }) });
    expect(log.mock.calls.flat().join(' ')).not.toContain('PAYROLL-SECRET');
  });
});
