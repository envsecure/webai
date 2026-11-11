/**
 * LLM provider adapters.
 *
 * Every provider is normalised to one internal shape:
 *
 *   request  -> { model, messages, tools, maxTokens, temperature, stop }
 *   response -> { content, toolCalls: [{ id, name, args }], usage, stopReason }
 *
 * Internal messages use the OpenAI-ish shape:
 *   { role: 'system' | 'user' | 'assistant' | 'tool', content, toolCalls?, toolCallId?, name? }
 */

export const PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    style: 'openai',
    keyRequired: true,
    envKey: 'OPENAI_API_KEY',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-latest',
    style: 'anthropic',
    keyRequired: true,
    envKey: 'ANTHROPIC_API_KEY',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    style: 'openai',
    keyRequired: true,
    envKey: 'OPENROUTER_API_KEY',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    style: 'openai',
    keyRequired: true,
    envKey: 'GROQ_API_KEY',
  },
  together: {
    id: 'together',
    label: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    style: 'openai',
    keyRequired: true,
    envKey: 'TOGETHER_API_KEY',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (local)',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5-coder',
    style: 'openai',
    keyRequired: false,
    envKey: 'OLLAMA_API_KEY',
  },
  // Any OpenAI-compatible gateway (vLLM, LM Studio, Together-compatible proxies…)
  compatible: {
    id: 'compatible',
    label: 'OpenAI-compatible endpoint',
    defaultBaseUrl: 'http://127.0.0.1:8000/v1',
    defaultModel: 'local-model',
    style: 'openai',
    keyRequired: false,
    envKey: 'LLM_API_KEY',
  },
  // Offline scripted provider: exercises the whole agent loop with no network.
  mock: {
    id: 'mock',
    label: 'Local mock (no network)',
    defaultBaseUrl: 'local://mock',
    defaultModel: 'mock-agent-v1',
    style: 'mock',
    keyRequired: false,
    envKey: null,
  },
};

export function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    defaultBaseUrl: p.defaultBaseUrl,
    defaultModel: p.defaultModel,
    keyRequired: p.keyRequired,
  }));
}

export function getProvider(id) {
  return PROVIDERS[id] || null;
}

/* -------------------------------------------------------------------------- */
/* OpenAI-style wire format                                                   */
/* -------------------------------------------------------------------------- */

export function toOpenAiMessages(messages) {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: String(m.content ?? '') };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
        })),
      };
    }
    return { role: m.role, content: String(m.content ?? '') };
  });
}

export function toOpenAiTools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function fromOpenAiResponse(json) {
  const message = json?.choices?.[0]?.message ?? {};
  const toolCalls = (message.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function?.name,
    args: safeParse(tc.function?.arguments),
  }));
  return {
    content: message.content ?? '',
    toolCalls,
    usage: json?.usage ?? null,
    stopReason: json?.choices?.[0]?.finish_reason ?? null,
    raw: json,
  };
}

/* -------------------------------------------------------------------------- */
/* Anthropic wire format                                                      */
/* -------------------------------------------------------------------------- */

export function toAnthropicMessages(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: String(m.content ?? ''),
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        const blocks = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args ?? {} });
        }
        return { role: 'assistant', content: blocks };
      }
      return { role: m.role, content: String(m.content ?? '') };
    });

  return { system, messages: rest };
}

export function toAnthropicTools(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export function fromAnthropicResponse(json) {
  const blocks = json?.content ?? [];
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const toolCalls = blocks
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} }));
  return {
    content: text,
    toolCalls,
    usage: json?.usage ?? null,
    stopReason: json?.stop_reason ?? null,
    raw: json,
  };
}

/* -------------------------------------------------------------------------- */

export function safeParse(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
