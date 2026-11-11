import { createLlmClient, LlmError } from './client.js';
import { getProvider, listProviders, safeParse } from './providers.js';
import { decryptSecret } from '../../lib/secret.js';
import { SUBAGENTS, listSubagents } from './subagents.js';

export { createLlmClient, LlmError, listProviders, listSubagents };
export { runAgent } from './agent.js';
export { ProjectWorkspace, buildToolSchemas, executeTool } from './tools.js';
export { ContextWindow, estimateTokens } from './context.js';
export { SUBAGENTS } from './subagents.js';
export { detectModel, listModels } from './discover.js';

/** Provider keys we look for in the environment, in priority order. */
const ENV_PROVIDER_KEYS = [
  ['openai', 'OPENAI_API_KEY'],
  ['anthropic', 'ANTHROPIC_API_KEY'],
  ['openrouter', 'OPENROUTER_API_KEY'],
  ['groq', 'GROQ_API_KEY'],
  ['together', 'TOGETHER_API_KEY'],
];

/**
 * Work out which model to use for a user.
 *
 * Precedence: the user's own settings, then the environment. When neither is
 * present the app has no model and says so - it never silently substitutes
 * something else.
 */
export function resolveLlmSettings(userSettings = {}) {
  const envProvider = process.env.LLM_PROVIDER;
  const detected = ENV_PROVIDER_KEYS.find(([, key]) => process.env[key])?.[0] || null;

  const providerId = userSettings.llm_provider || envProvider || detected || null;

  if (!providerId) {
    return {
      provider: null,
      providerLabel: null,
      baseUrl: null,
      model: null,
      apiKey: null,
      configured: false,
      source: 'none',
      isMock: false,
      maxIterations: Number(userSettings.llm_max_iterations || process.env.LLM_MAX_ITERATIONS || 12),
      reviewRounds: Number(userSettings.llm_review_rounds ?? process.env.LLM_REVIEW_ROUNDS ?? 1),
      allowSubagents: String(userSettings.llm_subagents ?? '1') !== '0',
      contextTokens: Number(userSettings.llm_context_tokens || process.env.LLM_CONTEXT_TOKENS || 24000),
      capabilities: safeParse(userSettings.llm_capabilities),
    };
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return {
      provider: null,
      providerLabel: null,
      baseUrl: null,
      model: null,
      apiKey: null,
      configured: false,
      source: 'none',
      isMock: false,
      maxIterations: 12,
      reviewRounds: 1,
      allowSubagents: true,
      contextTokens: 24000,
      capabilities: null,
      error: `Unknown provider "${providerId}"`,
    };
  }

  const userKey = decryptSecret(userSettings.llm_api_key);
  const envKey = provider.envKey ? process.env[provider.envKey] : null;
  const genericEnvKey = process.env.LLM_API_KEY || null;

  const apiKey = userKey || envKey || genericEnvKey || '';
  const baseUrl = userSettings.llm_base_url || process.env.LLM_BASE_URL || provider.defaultBaseUrl;
  const model = userSettings.llm_model || process.env.LLM_MODEL || provider.defaultModel;

  const configured =
    provider.id === 'mock' ? true : provider.keyRequired ? Boolean(apiKey) : true;

  return {
    provider: provider.id,
    providerLabel: provider.label,
    baseUrl,
    model,
    apiKey,
    configured,
    source: userKey ? 'user' : envKey || genericEnvKey ? 'environment' : 'none',
    isMock: provider.id === 'mock',
    maxIterations: Number(userSettings.llm_max_iterations || process.env.LLM_MAX_ITERATIONS || 12),
    reviewRounds: Number(userSettings.llm_review_rounds ?? process.env.LLM_REVIEW_ROUNDS ?? 1),
    allowSubagents: String(userSettings.llm_subagents ?? '1') !== '0',
    contextTokens: Number(userSettings.llm_context_tokens || process.env.LLM_CONTEXT_TOKENS || 24000),
    capabilities: safeParse(userSettings.llm_capabilities),
  };
}

/** Build a client for the resolved settings. */
export function createClient(settings, { mockResponder } = {}) {
  return createLlmClient({
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    mockResponder,
  });
}

/** Safe summary for the settings UI (never returns the key itself). */
export function describeLlm(settings) {
  return {
    provider: settings.provider,
    providerLabel: settings.providerLabel,
    baseUrl: settings.baseUrl,
    model: settings.model,
    configured: settings.configured,
    source: settings.source,
    isMock: settings.isMock,
    maxIterations: settings.maxIterations,
    reviewRounds: settings.reviewRounds,
    allowSubagents: settings.allowSubagents,
    contextTokens: settings.contextTokens,
    capabilities: settings.capabilities || null,
    subagents: listSubagents(),
  };
}
