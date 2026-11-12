import { describe, it, expect, vi } from 'vitest';
import { selectProvider } from '../src/server/providers.js';
import { buildCatalog, SYSTEM_PROMPT, DECISION_JSON_SCHEMA } from '../src/server/prompt.js';

const decision = { agent: 'onboarding', confidence: 0.9, reason: 'r', alternatives: [] };

function fakeAnthropic() {
  const parse = vi.fn().mockResolvedValue({ parsed_output: decision, stop_reason: 'end_turn' });
  return { client: { messages: { parse } }, parse };
}

describe('prompt', () => {
  it('lists every routable agent and no platform entry', () => {
    const c = buildCatalog();
    for (const id of ['onboarding', 'tracker', 'knowledge', 'ownership', 'access']) expect(c).toContain(`id: ${id}`);
    expect(c).not.toContain('id: orchestrator');
    expect(c).not.toContain('id: validation');
    expect(SYSTEM_PROMPT).toContain(c);
  });
  it('exports a strict JSON schema (no $schema, every object closed) for Azure OpenAI', () => {
    expect(DECISION_JSON_SCHEMA.$schema).toBeUndefined();
    expect(DECISION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(DECISION_JSON_SCHEMA.properties.alternatives.items.additionalProperties).toBe(false);
    expect(DECISION_JSON_SCHEMA.required).toEqual(['agent', 'confidence', 'reason', 'alternatives']);
  });
});

describe('selectProvider', () => {
  it('defaults to anthropic with claude-haiku-5-5 and sends a structured-output request', async () => {
    const { client, parse } = fakeAnthropic();
    const anthropic = vi.fn(() => client);
    const p = selectProvider({ ANTHROPIC_API_KEY: 'k' }, { anthropic });
    expect(p.name).toBe('anthropic');
    expect(p.model).toBe('claude-haiku-5-5');
    expect(anthropic).toHaveBeenCalledWith({ apiKey: 'k' });
    await expect(p.classify('new catalog', {})).resolves.toEqual(decision);
    const [req, opts] = parse.mock.calls[0];
    expect(req.model).toBe('claude-haiku-5-5');
    expect(req.system).toBe(SYSTEM_PROMPT);
    expect(req.output_config.effort).toBe('low');
    expect(req.output_config.format.type).toBe('json_schema');
    expect(req.messages).toEqual([{ role: 'user', content: 'new catalog' }]);
    expect(opts.maxRetries).toBe(0);
  });
  it('honours ROUTER_MODEL', () => {
    const p = selectProvider({ ANTHROPIC_API_KEY: 'k', ROUTER_MODEL: 'claude-sonnet-5-5' }, { anthropic: () => fakeAnthropic().client });
    expect(p.model).toBe('claude-sonnet-5-5');
  });
  it('throws provider-not-configured without the required settings', () => {
    expect(() => selectProvider({})).toThrow('provider-not-configured');
    expect(() => selectProvider({ ROUTER_PROVIDER: 'azure-openai', AZURE_OPENAI_API_KEY: 'k' })).toThrow('provider-not-configured');
    expect(() => selectProvider({ ROUTER_PROVIDER: 'azure-foundry', AZURE_FOUNDRY_API_KEY: 'k' })).toThrow('provider-not-configured');
  });
  it('throws on a refusal or an unparsed response so the caller falls back', async () => {
    for (const res of [{ parsed_output: null, stop_reason: 'refusal' }, { parsed_output: decision, stop_reason: 'refusal' }, { parsed_output: null, stop_reason: 'end_turn' }]) {
      const p = selectProvider({ ANTHROPIC_API_KEY: 'k' }, { anthropic: () => ({ messages: { parse: vi.fn().mockResolvedValue(res) } }) });
      await expect(p.classify('x', {})).rejects.toThrow('no-decision');
    }
  });
  it('passes the abort signal to the SDK call', async () => {
    const { client, parse } = fakeAnthropic();
    const signal = new AbortController().signal;
    await selectProvider({ ANTHROPIC_API_KEY: 'k' }, { anthropic: () => client }).classify('q', { signal });
    expect(parse.mock.calls[0][1].signal).toBe(signal);
  });
  it('azure-foundry uses the Foundry client with the resource and the same request shape', async () => {
    const { client, parse } = fakeAnthropic();
    const foundry = vi.fn(() => client);
    const p = selectProvider({ ROUTER_PROVIDER: 'azure-foundry', AZURE_FOUNDRY_RESOURCE: 'r.azure.anthropic.com', AZURE_FOUNDRY_API_KEY: 'k' }, { foundry });
    expect(p.name).toBe('azure-foundry');
    expect(foundry).toHaveBeenCalledWith({ apiKey: 'k', resource: 'r.azure.anthropic.com' });
    await p.classify('q', {});
    expect(parse.mock.calls[0][0].output_config.format.type).toBe('json_schema');
  });
  it('azure-openai sends a strict json_schema chat completion to the deployment and parses it', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(decision) } }] });
    const azureOpenAI = vi.fn(() => ({ chat: { completions: { create } } }));
    const env = { ROUTER_PROVIDER: 'azure-openai', AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'gpt-router' };
    const p = selectProvider(env, { azureOpenAI });
    expect(p.name).toBe('azure-openai');
    expect(p.model).toBe('gpt-router');
    await expect(p.classify('q', {})).resolves.toEqual(decision);
    expect(azureOpenAI).toHaveBeenCalledWith({ endpoint: 'https://x.openai.azure.com', apiKey: 'k', apiVersion: '2024-10-21', deployment: 'gpt-router' });
    const req = create.mock.calls[0][0];
    expect(req.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'route_decision', strict: true, schema: DECISION_JSON_SCHEMA } });
    expect(req.messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
  });
  it('azure-openai throws no-decision on empty or non-JSON content', async () => {
    const env = { ROUTER_PROVIDER: 'azure-openai', AZURE_OPENAI_ENDPOINT: 'e', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'd' };
    for (const content of [null, 'not json']) {
      const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] });
      const p = selectProvider(env, { azureOpenAI: () => ({ chat: { completions: { create } } }) });
      await expect(p.classify('q', {})).rejects.toThrow('no-decision');
    }
  });
  it('rejects an unknown ROUTER_PROVIDER', () => {
    expect(() => selectProvider({ ROUTER_PROVIDER: 'bedrock' })).toThrow('unknown-provider');
  });
});

describe('selectProvider with the real SDK clients', () => {
  it('constructs each client from env without a network call', () => {
    expect(() => selectProvider({ ANTHROPIC_API_KEY: 'k' })).not.toThrow();
    expect(() => selectProvider({ ROUTER_PROVIDER: 'azure-foundry', AZURE_FOUNDRY_RESOURCE: 'r.azure.anthropic.com', AZURE_FOUNDRY_API_KEY: 'k' })).not.toThrow();
    expect(() => selectProvider({ ROUTER_PROVIDER: 'azure-openai', AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com', AZURE_OPENAI_API_KEY: 'k', AZURE_OPENAI_DEPLOYMENT: 'd' })).not.toThrow();
  });
});
