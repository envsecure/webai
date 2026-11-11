import { getProvider, safeParse } from './providers.js';

/**
 * Model discovery.
 *
 * Given a base URL, a key and (optionally) a model name, work out:
 *   - which models the endpoint serves,
 *   - the context window of the chosen model,
 *   - whether the endpoint supports tool calling (the agent needs it),
 *   - whether it reports token usage.
 *
 * Everything is best-effort: an endpoint that does not expose /models still
 * works, it just has to be configured by hand.
 */

/** Keys different providers use for the context window size. */
const CONTEXT_KEYS = [
  'context_length',
  'max_context_length',
  'context_window',
  'max_input_tokens',
  'max_model_len',
  'max_sequence_length',
];

function baseUrlFor(providerId, baseUrl) {
  const provider = getProvider(providerId);
  const url = String(baseUrl || provider?.defaultBaseUrl || '').replace(/\/+$/, '');
  return url;
}

function headersFor(providerId, apiKey) {
  const provider = getProvider(providerId);
  const headers = { 'content-type': 'application/json' };
  if (provider?.style === 'anthropic') {
    if (apiKey) headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function endpointFor(providerId, baseUrl) {
  const provider = getProvider(providerId);
  const url = baseUrlFor(providerId, baseUrl);
  if (/\/(chat\/completions|completions|messages)$/.test(url)) return url;
  if (provider?.style === 'anthropic') return `${url}/v1/messages`;
  return `${url}/chat/completions`;
}

/** GET {base}/models - the model catalogue, when the endpoint has one. */
export async function listModels({ provider = 'compatible', baseUrl, apiKey } = {}) {
  const url = baseUrlFor(provider, baseUrl);
  if (!url) return { ok: false, models: [], message: 'No base URL configured' };

  try {
    const res = await fetch(`${url}/models`, {
      headers: headersFor(provider, apiKey),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return {
        ok: false,
        models: [],
        message: `The endpoint does not expose /models (HTTP ${res.status}). Enter the model name by hand.`,
      };
    }
    const json = await res.json();
    const raw = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.models)
        ? json.models
        : [];
    const models = raw
      .map((m) => {
        if (typeof m === 'string') return { id: m };
        const id = m?.id || m?.name || m?.model;
        return id ? { id: String(id), ...m } : null;
      })
      .filter(Boolean);
    return { ok: true, models, message: `${models.length} model(s) available` };
  } catch (err) {
    return { ok: false, models: [], message: `Could not reach the endpoint: ${err.message}` };
  }
}

/** Context window advertised in the model metadata, if any. */
function contextFromMetadata(model) {
  if (!model) return null;
  for (const key of CONTEXT_KEYS) {
    const value = model[key];
    if (typeof value === 'number' && value > 0) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  }
  return null;
}

/**
 * Ask the endpoint for its context limit by requesting an impossible number
 * of output tokens. The error usually states the limit. No tokens are billed.
 */
async function probeContextLimit({ provider, baseUrl, apiKey, model }) {
  const url = endpointFor(provider, baseUrl);
  const body =
    getProvider(provider)?.style === 'anthropic'
      ? { model, max_tokens: 1000000, messages: [{ role: 'user', content: 'hi' }] }
      : { model, max_tokens: 1000000, messages: [{ role: 'user', content: 'hi' }] };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headersFor(provider, apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      // The endpoint accepted it: no useful limit to read.
      return { contextTokens: null, message: 'The endpoint accepted a very large max_tokens request.' };
    }
    const text = await res.text().catch(() => '');
    const match =
      text.match(/maximum context length is (\d+)/i) ||
      text.match(/context (?:length|window)[^0-9]{0,20}(\d+)/i) ||
      text.match(/max(?:imum)?[ _-]?tokens[^0-9]{0,20}(\d+)/i) ||
      text.match(/(\d+)\s*tokens/i);
    if (match) {
      return { contextTokens: Number(match[1]), message: `Context limit reported by the endpoint.` };
    }
    return { contextTokens: null, message: `The endpoint rejected the probe (HTTP ${res.status}).` };
  } catch (err) {
    return { contextTokens: null, message: `Context probe failed: ${err.message}` };
  }
}

/** Does the endpoint support tool calling, and does it report usage? */
async function probeTools({ provider, baseUrl, apiKey, model }) {
  const url = endpointFor(provider, baseUrl);
  const isAnthropic = getProvider(provider)?.style === 'anthropic';
  const body = isAnthropic
    ? {
        model,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Call the probe tool.' }],
        tools: [
          {
            name: 'probe',
            description: 'A tool used to detect tool support.',
            input_schema: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      }
    : {
        model,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'Call the probe tool.' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'probe',
              description: 'A tool used to detect tool support.',
              parameters: { type: 'object', properties: {}, additionalProperties: false },
            },
          },
        ],
      };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headersFor(provider, apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return {
        supportsTools: false,
        reportsUsage: false,
        message: `The endpoint rejected the probe (HTTP ${res.status}): ${text.slice(0, 160)}`,
      };
    }
    const json = safeParse(text);
    const hasToolCall = isAnthropic
      ? (json?.content || []).some((b) => b.type === 'tool_use')
      : Boolean(json?.choices?.[0]?.message?.tool_calls?.length);
    const reportsUsage = Boolean(json?.usage?.total_tokens);
    return {
      supportsTools: hasToolCall,
      reportsUsage,
      message: hasToolCall
        ? 'Tool calling works - the agent can drive this endpoint.'
        : 'The endpoint answered, but ignored the tool definition. The agent needs tool calling.',
    };
  } catch (err) {
    return {
      supportsTools: false,
      reportsUsage: false,
      message: `Tool probe failed: ${err.message}`,
    };
  }
}

/**
 * Full detection pass.
 *
 * @returns {{ok:boolean, provider:string, baseUrl:string, model:string|null,
 *            models:Array, contextTokens:number|null, supportsTools:boolean,
 *            reportsUsage:boolean, messages:string[], error:string|null}}
 */
export async function detectModel({ provider = 'compatible', baseUrl, apiKey, model } = {}) {
  const messages = [];
  const result = {
    ok: false,
    provider,
    baseUrl: baseUrlFor(provider, baseUrl),
    model: model || null,
    models: [],
    contextTokens: null,
    supportsTools: null,
    reportsUsage: null,
    messages,
    error: null,
  };

  if (!result.baseUrl) {
    result.error = 'Enter the base URL of your endpoint.';
    return result;
  }

  // 1. catalogue
  const catalogue = await listModels({ provider, baseUrl: result.baseUrl, apiKey });
  result.models = catalogue.models;
  messages.push(catalogue.message);

  // 2. pick the model
  let chosen = model || null;
  if (!chosen && catalogue.models.length) {
    chosen = catalogue.models[0].id;
    messages.push(`Using the first available model: ${chosen}`);
  }
  if (chosen && catalogue.models.length) {
    const match = catalogue.models.find(
      (m) => m.id === chosen || m.id.endsWith(`/${chosen}`) || m.id.includes(chosen)
    );
    if (!match) {
      messages.push(`The endpoint does not list "${chosen}" - it may still accept it.`);
    } else {
      chosen = match.id;
    }
  }
  result.model = chosen;

  if (!chosen) {
    result.error = 'Could not determine a model. Enter the model name and try again.';
    return result;
  }

  // 3. context window
  const metadata = catalogue.models.find((m) => m.id === chosen);
  const fromMeta = contextFromMetadata(metadata);
  if (fromMeta) {
    result.contextTokens = fromMeta;
    messages.push(`Context window from the endpoint's metadata: ${fromMeta.toLocaleString()} tokens.`);
  } else {
    const probe = await probeContextLimit({ provider, baseUrl: result.baseUrl, apiKey, model: chosen });
    if (probe.contextTokens) {
      result.contextTokens = probe.contextTokens;
      messages.push(`Context window detected: ${probe.contextTokens.toLocaleString()} tokens.`);
    } else {
      messages.push(probe.message);
    }
  }

  // 4. capabilities
  const tools = await probeTools({ provider, baseUrl: result.baseUrl, apiKey, model: chosen });
  result.supportsTools = tools.supportsTools;
  result.reportsUsage = tools.reportsUsage;
  messages.push(tools.message);

  result.ok = tools.supportsTools === true || catalogue.ok;
  if (!result.ok) result.error = 'The endpoint could not be reached or did not accept the request.';
  return result;
}
