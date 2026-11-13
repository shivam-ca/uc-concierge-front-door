import { describe, it, expect, vi } from 'vitest';
import { tracingSettings, usageMetadata, startTrace, NOOP_TRACE, DEFAULT_PROJECT } from '../src/server/tracing.js';
import { cleanTrace } from '../src/lib/traceContext.js';
import { selectProvider } from '../src/server/providers.js';
import { handleRoute } from '../src/server/handleRoute.js';
import { createRateLimiter } from '../src/server/rateLimit.js';

const ON = { LANGSMITH_TRACING: 'true', LANGSMITH_API_KEY: 'lsv2_test' };

function fakeClient() {
  return {
    createRun: vi.fn().mockResolvedValue(undefined),
    updateRun: vi.fn().mockResolvedValue(undefined),
    awaitPendingTraceBatches: vi.fn().mockResolvedValue(undefined),
  };
}

describe('tracingSettings', () => {
  it('is off unless both the flag and a key are set', () => {
    expect(tracingSettings({})).toBeNull();
    expect(tracingSettings({ LANGSMITH_TRACING: 'true' })).toBeNull();
    expect(tracingSettings({ LANGSMITH_API_KEY: 'k' })).toBeNull();
    expect(tracingSettings({ LANGSMITH_TRACING: 'false', LANGSMITH_API_KEY: 'k' })).toBeNull();
  });
  it('defaults the project and honours LANGSMITH_PROJECT and LANGSMITH_ENDPOINT', () => {
    expect(tracingSettings(ON)).toEqual({ apiKey: 'lsv2_test', apiUrl: undefined, project: DEFAULT_PROJECT });
    expect(tracingSettings({ ...ON, LANGSMITH_PROJECT: 'p', LANGSMITH_ENDPOINT: 'https://eu.api.smith.langchain.com' }))
      .toEqual({ apiKey: 'lsv2_test', apiUrl: 'https://eu.api.smith.langchain.com', project: 'p' });
  });
  it('accepts the older LANGCHAIN_ names', () => {
    expect(tracingSettings({ LANGCHAIN_TRACING_V2: 'true', LANGCHAIN_API_KEY: 'k' })?.apiKey).toBe('k');
  });
});

describe('usageMetadata', () => {
  it('maps Anthropic usage, counting cache tokens into input', () => {
    expect(usageMetadata({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 }))
      .toEqual({ input_tokens: 150, output_tokens: 20, total_tokens: 170, input_token_details: { cache_read: 50, cache_creation: 0 } });
  });
  it('maps OpenAI usage', () => {
    expect(usageMetadata({ prompt_tokens: 80, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 64 } }))
      .toEqual({ input_tokens: 80, output_tokens: 10, total_tokens: 90, input_token_details: { cache_read: 64 } });
  });
  it('is undefined without numbers', () => {
    expect(usageMetadata(undefined)).toBeUndefined();
    expect(usageMetadata({ input_tokens: 'x' })).toBeUndefined();
  });
});

describe('startTrace', () => {
  it('is the no-op trace when tracing is off', () => {
    expect(startTrace({ name: 'x', inputs: {} }, {})).toBe(NOOP_TRACE);
    expect(NOOP_TRACE.headers()).toBeNull();
  });
  it('posts a root run and an LLM child with tokens, and hands out headers an agent can nest under', async () => {
    const client = fakeClient();
    const trace = startTrace({ name: 'UC Concierge', inputs: { query: 'new catalog' }, metadata: { app: 'fd' } }, ON, { makeClient: () => client });
    expect(trace.enabled).toBe(true);
    const llm = trace.llm({ name: 'ChatAnthropic', provider: 'anthropic', model: 'claude-haiku-5-5', inputs: { messages: [] } });
    llm.end({ choices: [] }, { input_tokens: 10, output_tokens: 5 });
    trace.end({ agent: 'onboarding' });
    await trace.flush();

    const created = client.createRun.mock.calls.map(([r]) => r);
    const root = created.find(r => r.name === 'UC Concierge');
    const child = created.find(r => r.name === 'ChatAnthropic');
    expect(root.session_name).toBe(DEFAULT_PROJECT);
    expect(root.inputs).toEqual({ query: 'new catalog' });
    expect(child.run_type).toBe('llm');
    expect(child.parent_run_id).toBe(root.id);
    expect(child.trace_id).toBe(root.id);
    expect(child.extra.metadata).toMatchObject({ ls_provider: 'anthropic', ls_model_name: 'claude-haiku-5-5' });
    const childUpdate = client.updateRun.mock.calls.find(([id]) => id === child.id)[1];
    expect(childUpdate.outputs.usage_metadata).toEqual({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
    const rootUpdate = client.updateRun.mock.calls.find(([id]) => id === root.id)[1];
    expect(rootUpdate.outputs).toEqual({ agent: 'onboarding' });
    expect(client.awaitPendingTraceBatches).toHaveBeenCalled();

    const headers = cleanTrace(trace.headers());
    expect(headers['langsmith-trace']).toContain(root.id);
    expect(headers.baggage).toContain(`langsmith-project=${DEFAULT_PROJECT}`);
  });
  it('never throws when LangSmith is down, and flush gives up after its time cap', async () => {
    const client = fakeClient();
    client.createRun.mockRejectedValue(new Error('down'));
    client.updateRun.mockRejectedValue(new Error('down'));
    client.awaitPendingTraceBatches.mockReturnValue(new Promise(() => {}));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const trace = startTrace({ name: 'x', inputs: {} }, ON, { makeClient: () => client });
    trace.llm({ name: 'l', provider: 'anthropic', model: 'm', inputs: {} }).fail(new Error('boom'));
    trace.end({});
    await expect(trace.flush(20)).resolves.toBeUndefined();
    log.mockRestore();
  });
  it('falls back to the no-op trace when the client cannot be made', () => {
    expect(startTrace({ name: 'x', inputs: {} }, ON, { makeClient: () => { throw new Error('bad'); } })).toBe(NOOP_TRACE);
  });
});

describe('providers record each call under the trace', () => {
  it('Claude: one LLM run with the prompt, the answer and the usage', async () => {
    const decision = { agent: 'onboarding', confidence: 0.9, reason: 'r', alternatives: [] };
    const parse = vi.fn().mockResolvedValue({ parsed_output: decision, stop_reason: 'end_turn', usage: { input_tokens: 7, output_tokens: 3 } });
    const run = { end: vi.fn(), fail: vi.fn() };
    const trace = { llm: vi.fn(() => run) };
    const p = selectProvider({ ANTHROPIC_API_KEY: 'k' }, { anthropic: () => ({ messages: { parse } }) });
    await expect(p.classify('new catalog', { trace })).resolves.toEqual(decision);
    expect(trace.llm.mock.calls[0][0]).toMatchObject({ name: 'ChatAnthropic', provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(trace.llm.mock.calls[0][0].inputs.messages[1]).toEqual({ role: 'user', content: 'new catalog' });
    const [outputs, usage] = run.end.mock.calls[0];
    expect(JSON.parse(outputs.choices[0].message.content)).toEqual(decision);
    expect(usage).toEqual({ input_tokens: 7, output_tokens: 3 });
  });
  it('a failed call is recorded as a failed run and still throws', async () => {
    const run = { end: vi.fn(), fail: vi.fn() };
    const p = selectProvider({ ANTHROPIC_API_KEY: 'k' }, { anthropic: () => ({ messages: { parse: vi.fn().mockRejectedValue(new Error('500')) } }) });
    await expect(p.classify('x', { trace: { llm: () => run } })).rejects.toThrow('500');
    expect(run.fail).toHaveBeenCalled();
    expect(run.end).not.toHaveBeenCalled();
  });
});

describe('handleRoute tracing', () => {
  const ok = { agent: 'onboarding', confidence: 0.9, reason: '', alternatives: [], provider: 'anthropic', model: 'm', fallback: false, ms: 1 };
  const req = { method: 'POST', headers: {}, body: { query: 'new catalog' }, ip: '1.1.1.1' };
  const headers = { 'langsmith-trace': '20261113T080000000000Z0b8a1e3c-1111-4222-8333-944455556666', baggage: 'langsmith-project=uc-concierge-suite' };

  it('returns the trace headers with the decision, after ending and flushing the trace', async () => {
    const order = [];
    const trace = { enabled: true, headers: () => headers, llm: vi.fn(), end: vi.fn(() => order.push('end')), fail: vi.fn(), flush: vi.fn(async () => order.push('flush')) };
    const startTraceFn = vi.fn(() => trace);
    const orchestrateFn = vi.fn().mockResolvedValue(ok);
    const out = await handleRoute(req, ON, { orchestrateFn, limiter: createRateLimiter(), startTraceFn });
    expect(out.json).toEqual({ ...ok, trace: headers });
    expect(startTraceFn.mock.calls[0][0]).toMatchObject({ name: 'UC Concierge', inputs: { query: 'new catalog' } });
    expect(orchestrateFn).toHaveBeenCalledWith('new catalog', ON, { trace });
    expect(trace.end).toHaveBeenCalledWith(ok, { routed_to: 'onboarding', fallback: false });
    expect(order).toEqual(['end', 'flush']);
  });
  it('adds no trace field when tracing is off', async () => {
    const out = await handleRoute(req, {}, { orchestrateFn: vi.fn().mockResolvedValue(ok), limiter: createRateLimiter() });
    expect(out.json).toEqual(ok);
  });
});
