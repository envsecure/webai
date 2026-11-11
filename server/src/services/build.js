import { createMockResponder, generateApp } from './generator.js';
import { ProjectWorkspace } from './llm/tools.js';
import { createClient, describeLlm, resolveLlmSettings } from './llm/index.js';
import { runAgent } from './llm/agent.js';

/**
 * Build orchestration.
 *
 * Runs the agent loop when a model is configured, and degrades to the local
 * deterministic generator when it is not, so the app always produces something.
 */
export async function buildProject({
  prompt,
  project = null,
  userSettings = {},
  existingFiles = {},
  onEvent = () => {},
}) {
  const settings = resolveLlmSettings(userSettings);
  const workspace = new ProjectWorkspace(existingFiles);

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
      throw new Error('the agent finished without writing any files');
    }

    return {
      ...result,
      llm: describeLlm(settings),
      usedFallback: false,
    };
  } catch (err) {
    onEvent({ type: 'fallback', message: err.message });

    // Deterministic fallback: always produce a working starter.
    const fallback = generateApp(prompt);
    const fallbackWorkspace = new ProjectWorkspace(existingFiles);
    for (const [path, content] of Object.entries(fallback.files)) {
      fallbackWorkspace.set(path, content);
    }

    return {
      files: fallbackWorkspace.toObject(),
      plan: fallback.plan,
      planSource: 'heuristic',
      summary: fallback.summary,
      iterations: 0,
      usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 },
      toolLog: [],
      subagentRuns: [],
      reviews: [],
      context: null,
      finished: true,
      durationMs: 0,
      llm: describeLlm(settings),
      usedFallback: true,
      error: err.message,
    };
  }
}
