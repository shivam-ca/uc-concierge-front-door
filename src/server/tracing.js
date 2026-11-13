import { Client } from 'langsmith';
import { RunTree } from 'langsmith/run_trees';

export const DEFAULT_PROJECT = 'uc-concierge-suite';
const truthy = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());

/** LangSmith settings from env, or null when tracing is off. On needs LANGSMITH_TRACING=true and LANGSMITH_API_KEY. */
export function tracingSettings(env = {}) {
  if (!(truthy(env.LANGSMITH_TRACING) || truthy(env.LANGCHAIN_TRACING_V2))) return null;
  const apiKey = env.LANGSMITH_API_KEY || env.LANGCHAIN_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    apiUrl: env.LANGSMITH_ENDPOINT || env.LANGCHAIN_ENDPOINT || undefined,
    project: env.LANGSMITH_PROJECT || env.LANGCHAIN_PROJECT || DEFAULT_PROJECT,
  };
}

// One client per key and endpoint, so a warm serverless instance reuses its connection.
const clients = new Map();
function sharedClient({ apiKey, apiUrl }) {
  const key = `${apiUrl || ''}|${apiKey}`;
  if (!clients.has(key)) clients.set(key, new Client({ apiKey, apiUrl, autoBatchTracing: true }));
  return clients.get(key);
}

/** A tracer is never allowed to break routing: every call is guarded and failures are logged coarsely. */
const guard = (fn, fallback) => { try { return fn(); } catch (err) { warn(err); return fallback; } };
const warn = (err) => console.log(JSON.stringify({ tracing: 'error', cause: err?.name || 'error' }));

const NOOP_LLM = { end() {}, fail() {} };
export const NOOP_TRACE = Object.freeze({
  enabled: false,
  headers: () => null,
  llm: () => NOOP_LLM,
  end() {},
  fail() {},
  flush: async () => {},
});

/** Token counts in the shape LangSmith reads for cost (`usage_metadata`), from an Anthropic or OpenAI usage block. */
export function usageMetadata(usage) {
  if (!usage || typeof usage !== 'object') return undefined;
  const input = usage.input_tokens ?? usage.prompt_tokens;
  const output = usage.output_tokens ?? usage.completion_tokens;
  if (typeof input !== 'number' || typeof output !== 'number') return undefined;
  const cacheRead = usage.cache_read_input_tokens ?? usage.prompt_tokens_details?.cached_tokens;
  const cacheWrite = usage.cache_creation_input_tokens;
  const details = {
    ...(typeof cacheRead === 'number' ? { cache_read: cacheRead } : {}),
    ...(typeof cacheWrite === 'number' ? { cache_creation: cacheWrite } : {}),
  };
  // Anthropic reports cache tokens apart from input_tokens; LangSmith's input_tokens is the total.
  const total = usage.prompt_tokens !== undefined ? input : input + (cacheRead || 0) + (cacheWrite || 0);
  return {
    input_tokens: total, output_tokens: output, total_tokens: total + output,
    ...(Object.keys(details).length ? { input_token_details: details } : {}),
  };
}

/**
 * Starts the root run of one UC Concierge request. The returned trace hands out child LLM runs, the distributed
 * tracing headers an agent can nest its own runs under, and flush() to send everything before the function freezes.
 */
export function startTrace({ name, inputs, metadata = {}, tags = [] }, env, { makeClient = sharedClient, now = Date.now } = {}) {
  const settings = tracingSettings(env);
  if (!settings) return NOOP_TRACE;
  return guard(() => {
    const client = makeClient(settings);
    const root = new RunTree({
      name, run_type: 'chain', inputs, project_name: settings.project, client, tracingEnabled: true,
      metadata, tags, start_time: now(),
    });
    const pending = [];
    const send = (p) => { if (p && typeof p.catch === 'function') pending.push(p.catch(warn)); };
    send(guard(() => root.postRun(), null));

    return {
      enabled: true,
      runId: root.id,
      headers: () => guard(() => root.toHeaders(), null),
      llm({ name: llmName, provider, model, inputs: llmInputs, invocation = {} }) {
        return guard(() => {
          const child = root.createChild({
            name: llmName, run_type: 'llm', inputs: llmInputs, start_time: now(),
            metadata: { ls_provider: provider, ls_model_name: model, ls_model_type: 'chat', ...invocation },
          });
          send(guard(() => child.postRun(), null));
          let done = false;
          const finish = (outputs, error) => {
            if (done) return;
            done = true;
            guard(() => { send(child.end(outputs, error, now())); send(child.patchRun()); });
          };
          return {
            end: (outputs, usage) => finish({ ...outputs, ...(usageMetadata(usage) ? { usage_metadata: usageMetadata(usage) } : {}) }),
            fail: (err) => finish(undefined, String(err?.message || err || 'error').slice(0, 200)),
          };
        }, NOOP_LLM);
      },
      end(outputs, extraMetadata) { guard(() => { send(root.end(outputs, undefined, now(), extraMetadata)); send(root.patchRun()); }); },
      fail(err) { guard(() => { send(root.end(undefined, String(err?.message || err).slice(0, 200), now())); send(root.patchRun()); }); },
      /** Waits (at most timeoutMs) for the runs to reach LangSmith; serverless functions freeze once they reply. */
      async flush(timeoutMs = 2500) {
        let timer;
        const capped = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
        const drained = Promise.allSettled(pending).then(() => guard(() => client.awaitPendingTraceBatches(), null)).catch(warn);
        try { await Promise.race([drained, capped]); } finally { clearTimeout(timer); }
      },
    };
  }, NOOP_TRACE);
}
