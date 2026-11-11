import {
  getProvider,
  toOpenAiMessages,
  toOpenAiTools,
  fromOpenAiResponse,
  toAnthropicMessages,
  toAnthropicTools,
  fromAnthropicResponse,
} from './providers.js';

export class LlmError extends Error {
  constructor(message, { status, provider, retryable = false } = {}) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
    this.provider = provider;
    this.retryable = retryable;
  }
}

/**
 * Provider-agnostic chat client.
 *
 * The same call works for OpenAI, Anthropic, OpenRouter, Groq, Together,
 * Ollama and any OpenAI-compatible gateway. A scripted `mock` provider
 * exercises the full agent loop offline.
 */
export function createLlmClient(config) {
  const {
    provider: providerId,
    baseUrl,
    apiKey,
    model,
    temperature = 0.2,
    maxTokens = 4000,
    timeoutMs = 120000,
    maxRetries = 2,
    mockResponder,
    extraHeaders = {},
  } = config;

  const provider = getProvider(providerId);
  if (!provider) throw new LlmError(`Unknown LLM provider "${providerId}"`);

  /**
   * Build the request URL from the base URL.
   * A base URL that already points at the endpoint is used as-is, so both
   * "https://api.openai.com/v1" and ".../v1/chat/completions" work.
   */
  const endpoint = (() => {
    const url = String(baseUrl || '').replace(/\/+$/, '');
    if (/\/(chat\/completions|completions|messages)$/.test(url)) return url;
    if (provider.style === 'anthropic') return `${url}/v1/messages`;
    return `${url}/chat/completions`;
  })();

  async function request(body, headers) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          const retryable = res.status === 429 || res.status >= 500;
          lastError = new LlmError(
            `${provider.label} error ${res.status}: ${text.slice(0, 300) || res.statusText}`,
            { status: res.status, provider: provider.id, retryable }
          );
          if (!retryable || attempt === maxRetries) throw lastError;
        } else {
          return await res.json();
        }
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof LlmError) {
          lastError = err;
          if (!err.retryable || attempt === maxRetries) throw err;
        } else {
          lastError = new LlmError(
            err.name === 'AbortError' ? 'LLM request timed out' : err.message,
            { provider: provider.id, retryable: true }
          );
          if (attempt === maxRetries) throw lastError;
        }
      }
      // exponential backoff with jitter
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt + Math.random() * 250));
    }
    throw lastError;
  }

  return {
    provider: provider.id,
    providerLabel: provider.label,
    model,

    /** One chat turn. Returns { content, toolCalls, usage, stopReason }. */
    async chat(messages, opts = {}) {
      const useTools = opts.tools?.length && provider.style !== 'mock';

      if (provider.style === 'mock') {
        if (!mockResponder) {
          throw new LlmError('mock provider requires a mockResponder', { provider: 'mock' });
        }
        const result = await mockResponder(messages, {
          tools: opts.tools || [],
          toolsEnabled: Boolean(useTools),
        });
        return { ...result, provider: 'mock', model };
      }

      if (provider.style === 'anthropic') {
        const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
        const body = {
          model,
          max_tokens: opts.maxTokens ?? maxTokens,
          temperature: opts.temperature ?? temperature,
          messages: anthropicMessages,
        };
        if (system) body.system = system;
        if (useTools) body.tools = toAnthropicTools(opts.tools);

        const json = await request(body, {
          'content-type': 'application/json',
          'x-api-key': apiKey || '',
          'anthropic-version': '2023-06-01',
          ...extraHeaders,
        });
        return { ...fromAnthropicResponse(json), provider: provider.id, model };
      }

      const body = {
        model,
        messages: toOpenAiMessages(messages),
        temperature: opts.temperature ?? temperature,
        max_tokens: opts.maxTokens ?? maxTokens,
      };
      if (useTools) {
        body.tools = toOpenAiTools(opts.tools);
        body.tool_choice = 'auto';
      }
      if (opts.stop) body.stop = opts.stop;

      const json = await request(body, {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        ...extraHeaders,
      });
      return { ...fromOpenAiResponse(json), provider: provider.id, model };
    },

    /** Plain completion with no tools — used for planning, summarising, titles. */
    async complete(prompt, opts = {}) {
      const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
      const res = await this.chat(messages, { ...opts, tools: undefined });
      return {
        text: res.content || '',
        usage: res.usage,
        provider: res.provider,
        model: res.model,
      };
    },
  };
}
