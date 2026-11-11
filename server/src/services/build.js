import { ProjectWorkspace } from './llm/tools.js';
import { createClient, describeLlm, resolveLlmSettings } from './llm/index.js';
import { runAgent } from './llm/agent.js';
import { createMockResponder } from './generator.js';

/** Thrown when the user has not connected a model yet. */
export class NoModelConfiguredError extends Error {
  constructor(message = 'No model is connected. Add an API endpoint in Settings → AI model to start building.') {
    super(message);
    this.name = 'NoModelConfiguredError';
    this.code = 'no_model_configured';
    this.status = 409;
  }
}

/**
 * Build orchestration.
 *
 * Runs the agent loop against the model the user connected. There is no silent
 * fallback: if no model is configured the caller is told exactly what to do.
 */
export async function buildProject({
  prompt,
  project = null,
  userSettings = {},
  existingFiles = {},
  onEvent = () => {},
}) {
  const settings = resolveLlmSettings(userSettings);

  if (!settings.configured || !settings.provider) {
    throw new NoModelConfiguredError();
  }

  const workspace = new ProjectWorkspace(existingFiles);
  // The scripted provider (hidden from the UI) exists for the test suite.
  const mockResponder = settings.isMock ? createMockResponder() : undefined;
  const client = createClient(settings, { mockResponder });

  try {
    const result = await runAgent({
      prompt,
      project,
      llm: client,
      workspace,
      onEvent,
      maxIterations: settings.maxIterations,
      reviewRounds: settings.reviewRounds,
      allowSubagents: settings.allowSubagents,
      maxTokens: settings.contextTokens,
    });

    if (!Object.keys(result.files).length) {
      throw new Error('The agent finished without writing any files.');
    }

    return {
      ...result,
      llm: describeLlm(settings),
      usedFallback: false,
    };
  } catch (err) {
    if (err instanceof NoModelConfiguredError) throw err;
    onEvent({ type: 'error', message: err.message });
    throw err;
  }
}
