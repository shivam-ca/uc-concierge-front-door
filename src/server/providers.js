import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AnthropicFoundry } from '@anthropic-ai/foundry-sdk';
import { AzureOpenAI } from 'openai';
import { SYSTEM_PROMPT, DecisionSchema, DECISION_JSON_SCHEMA } from './prompt.js';

const DEFAULT_FACTORIES = {
  anthropic: (opts) => new Anthropic(opts),
  foundry: (opts) => new AnthropicFoundry(opts),
  azureOpenAI: (opts) => new AzureOpenAI(opts),
};

const need = (...vals) => { if (vals.some(v => !v)) throw new Error('provider-not-configured'); };

// Claude (first-party or on Foundry): structured output at low effort; routing is a classification, not a reasoning task.
// No SDK retries: the caller has an 8s budget and a keyword fallback.
function claudeClassifier(client, model) {
  return async (query, { signal } = {}) => {
    const res = await client.messages.parse({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: query }],
      output_config: { effort: 'low', format: zodOutputFormat(DecisionSchema) },
    }, { signal, maxRetries: 0 });
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('no-decision');
    return res.parsed_output;
  };
}

function azureOpenAIClassifier(client, deployment) {
  return async (query, { signal } = {}) => {
    const res = await client.chat.completions.create({
      model: deployment,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: query }],
      response_format: { type: 'json_schema', json_schema: { name: 'route_decision', strict: true, schema: DECISION_JSON_SCHEMA } },
    }, { signal, maxRetries: 0 });
    const content = res.choices?.[0]?.message?.content;
    if (!content) throw new Error('no-decision');
    try { return JSON.parse(content); } catch { throw new Error('no-decision'); }
  };
}

/** Picks the LLM behind the Orchestrator from env. Moving to Azure is a config change, not a code change. */
export function selectProvider(env, factories = {}) {
  const f = { ...DEFAULT_FACTORIES, ...factories };
  const name = env.ROUTER_PROVIDER || 'anthropic';
  if (name === 'anthropic') {
    need(env.ANTHROPIC_API_KEY);
    const model = env.ROUTER_MODEL || 'claude-haiku-5-5';
    return { name, model, classify: claudeClassifier(f.anthropic({ apiKey: env.ANTHROPIC_API_KEY }), model) };
  }
  if (name === 'azure-foundry') {
    need(env.AZURE_FOUNDRY_RESOURCE, env.AZURE_FOUNDRY_API_KEY);
    const model = env.ROUTER_MODEL || 'claude-haiku-5-5';
    return { name, model, classify: claudeClassifier(f.foundry({ apiKey: env.AZURE_FOUNDRY_API_KEY, resource: env.AZURE_FOUNDRY_RESOURCE }), model) };
  }
  if (name === 'azure-openai') {
    need(env.AZURE_OPENAI_ENDPOINT, env.AZURE_OPENAI_API_KEY, env.AZURE_OPENAI_DEPLOYMENT);
    const deployment = env.AZURE_OPENAI_DEPLOYMENT;
    const client = f.azureOpenAI({
      endpoint: env.AZURE_OPENAI_ENDPOINT, apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION || '2024-10-21', deployment,
    });
    return { name, model: deployment, classify: azureOpenAIClassifier(client, deployment) };
  }
  throw new Error('unknown-provider');
}
