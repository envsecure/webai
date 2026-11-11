import { ContextWindow, estimateTokens } from './context.js';
import { buildToolSchemas, executeTool, summariseToolResult } from './tools.js';
import { SUBAGENTS, runSubagent } from './subagents.js';
import { buildPlan, detectAppType, titleFrom } from '../generator.js';

/**
 * The agent loop.
 *
 * plan -> act (tool calls) -> observe -> refine, with:
 *   - a bounded iteration budget,
 *   - context compaction between turns,
 *   - delegation to specialist subagents,
 *   - an optional review round that feeds findings back for a fix pass.
 */

const SYSTEM_PROMPT = `You are the build agent for "webai", an AI app builder.

You build complete, runnable, full-stack applications from a plain-language request.

The stack is fixed:
- Frontend: React 18 + Vite, plain JSX, plain CSS. Entry: client/src/App.jsx
- Backend: Node.js + Express, ES modules. Routes live in server/src/routes/
- Database: SQLite. Schema lives in server/schema.sql

How to work:
1. Read the request carefully. Decide the data model first, then the API, then the UI.
2. Write real files with the tools. Every file must be complete and consistent with
   the others: the table names in the schema, the columns the API selects and the
   fields the UI reads must match exactly.
3. Keep the UI dependency-free - no UI kits, no state libraries, no CSS frameworks.
   Use inline styles or a className with plain CSS.
4. Write the files a developer would actually ship: a README, the schema, the API
   routes, the client API helper, the components and the app shell.
5. When the project is complete, call finalize with a one or two sentence summary.

You may delegate focused work to a subagent when a task is self-contained. Use the
delegate tool for that; the subagent returns a report you then use.`;

export async function runAgent({
  prompt,
  project = null,
  llm,
  workspace,
  onEvent = () => {},
  maxIterations = 12,
  reviewRounds = 1,
  allowSubagents = true,
  maxTokens = 24000,
}) {
  const emit = (event) => {
    try {
      onEvent(event);
    } catch {
      /* a broken listener must not kill the loop */
    }
  };

  const startedAt = Date.now();
  let iterations = 0;
  let usage = { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 };
  const subagentRuns = [];

  /* ------------------------------ 1. planning ------------------------------ */

  const appType = detectAppType(prompt);
  const fallbackPlan = buildPlan(appType, prompt);
  let plan = fallbackPlan;
  let planSource = 'heuristic';

  emit({ type: 'phase', phase: 'plan' });

  try {
    const res = await llm.complete(
      [
        { role: 'system', content: 'You write build plans for an AI app builder.' },
        {
          role: 'user',
          content:
            `Request: ${prompt}\n\n` +
            'Return ONLY a JSON array of 3-6 steps. Each step is an object with ' +
            '"step" (short imperative label) and "detail" (one sentence). ' +
            'Example: [{"step":"Design the data model","detail":"Products and orders tables with indexes"}]',
        },
      ],
      { maxTokens: 600, temperature: 0.1 }
    );
    const parsed = parsePlan(res.text);
    if (parsed?.length) {
      plan = parsed;
      planSource = 'model';
    }
  } catch (err) {
    emit({ type: 'plan_fallback', message: err.message });
  }

  emit({ type: 'plan', plan, source: planSource });

  /* --------------------------- 2. the build loop --------------------------- */

  const context = new ContextWindow({
    name: 'main',
    system: SYSTEM_PROMPT,
    maxTokens,
    reserveOutput: 6000,
    llm,
    keepRecent: 10,
  });

  const existingIndex = workspace.index();
  context.addUser(
    `Build request: ${prompt}` +
      (existingIndex ? `\n\nThe project already contains:\n${existingIndex}` : '') +
      `\n\nProject name: ${project?.name || titleFrom(prompt)}`
  );

  const schemas = buildToolSchemas({
    includeDelegate: allowSubagents,
    includeDelegateTarget: allowSubagents ? Object.keys(SUBAGENTS) : null,
  });

  let summary = '';
  let finished = false;
  const toolLog = [];

  emit({ type: 'phase', phase: 'build' });

  while (iterations < maxIterations && !finished) {
    iterations += 1;
    emit({ type: 'iteration', iteration: iterations, max: maxIterations });

    for (const event of await context.compact()) emit(event);

    let response;
    try {
      response = await llm.chat(context.getMessages(), { tools: schemas });
    } catch (err) {
      emit({ type: 'error', message: err.message });
      break;
    }

    if (response.usage) {
      usage.total_tokens += response.usage.total_tokens || 0;
      usage.prompt_tokens += response.usage.prompt_tokens || 0;
      usage.completion_tokens += response.usage.completion_tokens || 0;
    }

    if (response.content) {
      context.addAssistant(response.content);
      emit({ type: 'message', text: response.content });
    }

    const calls = response.toolCalls || [];
    if (!calls.length) {
      // A turn with no tool call: nudge the agent back to work.
      context.addUser(
        'Continue: keep using the tools to write the project files, then call finalize.'
      );
      continue;
    }

    context.addAssistant(response.content, calls);

    for (const call of calls) {
      const started = Date.now();
      emit({ type: 'tool_start', tool: call.name, args: previewArgs(call.args) });

      if (call.name === 'finalize') {
        summary = String(call.args?.summary || response.content || '').trim();
        finished = true;
        emit({ type: 'finalize', summary });
        break;
      }

      if (call.name === 'delegate') {
        const target = SUBAGENTS[call.args?.subagent];
        if (!target) {
          context.addToolResult(call.id, call.name, `Unknown subagent. Available: ${Object.keys(SUBAGENTS).join(', ')}`);
          continue;
        }
        const run = await runSubagent({
          definition: target,
          task: String(call.args?.task || prompt),
          workspace,
          llm,
          onEvent: emit,
          parentContext: context,
        });
        subagentRuns.push({
          id: target.id,
          label: target.label,
          iterations: run.iterations,
          tokens: run.tokens,
          report: run.report,
        });
        context.addToolResult(
          call.id,
          call.name,
          `${target.label} finished after ${run.iterations} iteration(s).\n\n${run.report}`
        );
        toolLog.push({ tool: 'delegate', target: target.id, ms: Date.now() - started });
        continue;
      }

      const result = await executeTool(call.name, call.args, { workspace, onEvent: emit });
      context.addToolResult(call.id, call.name, summariseToolResult(result));
      toolLog.push({ tool: call.name, ok: result.ok, ms: Date.now() - started });
    }
  }

  /* --------------------------- 3. the review loop -------------------------- */

  const reviews = [];
  if (allowSubagents && reviewRounds > 0 && workspace.list().length) {
    emit({ type: 'phase', phase: 'review' });
    const reviewer = SUBAGENTS.reviewer;
    const run = await runSubagent({
      definition: reviewer,
      task: `Review the project that was just built from this request: "${prompt}". ` +
        `List every concrete defect with its file path.`,
      workspace,
      llm,
      onEvent: emit,
      parentContext: context,
    });
    subagentRuns.push({
      id: reviewer.id,
      label: reviewer.label,
      iterations: run.iterations,
      tokens: run.tokens,
      report: run.report,
    });
    reviews.push(run.report);

    const needsWork = reviewNeedsWork(run.report);
    if (needsWork && iterations < maxIterations) {
      emit({ type: 'review_rework', report: run.report.slice(0, 400) });
      context.addUser(
        `The reviewer reported:\n${run.report}\n\n` +
          'Fix the concrete issues with the tools, then call finalize again.'
      );

      let fixIterations = 0;
      while (fixIterations < Math.min(4, maxIterations - iterations) && !finished) {
        fixIterations += 1;
        iterations += 1;
        emit({ type: 'iteration', iteration: iterations, max: maxIterations });

        for (const event of await context.compact()) emit(event);

        let response;
        try {
          response = await llm.chat(context.getMessages(), { tools: schemas });
        } catch (err) {
          emit({ type: 'error', message: err.message });
          break;
        }
        if (response.usage) {
          usage.total_tokens += response.usage.total_tokens || 0;
          usage.prompt_tokens += response.usage.prompt_tokens || 0;
          usage.completion_tokens += response.usage.completion_tokens || 0;
        }
        if (response.content) {
          context.addAssistant(response.content);
          emit({ type: 'message', text: response.content });
        }
        const calls = response.toolCalls || [];
        if (!calls.length) continue;
        context.addAssistant(response.content, calls);
        for (const call of calls) {
          if (call.name === 'finalize') {
            summary = String(call.args?.summary || '').trim() || summary;
            finished = true;
            emit({ type: 'finalize', summary });
            break;
          }
          const result = await executeTool(call.name, call.args, { workspace, onEvent: emit });
          context.addToolResult(call.id, call.name, summariseToolResult(result));
        }
      }
    }
  }

  const files = workspace.toObject();
  if (!summary) {
    summary = `Built ${project?.name || titleFrom(prompt)} — ${Object.keys(files).length} files ` +
      `generated from: "${prompt.slice(0, 160)}"`;
  }

  emit({
    type: 'done',
    files: Object.keys(files).length,
    iterations,
    subagents: subagentRuns.length,
    ms: Date.now() - startedAt,
  });

  return {
    files,
    plan,
    planSource,
    summary,
    iterations,
    usage,
    toolLog,
    subagentRuns,
    reviews,
    context: context.stats(),
    finished: finished && Object.keys(files).length > 0,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Decide whether a review report asks for changes.
 *
 * A report that says "no defects found" must not trigger a rework round, so
 * the negative phrasing is stripped before the check.
 */
export function reviewNeedsWork(report) {
  if (!report) return false;
  const text = String(report)
    .replace(/no\s+(blocking\s+)?(defects?|issues?|bugs?)\s+(were\s+)?found/gi, '')
    .replace(/\bis\s+sound\b/gi, '')
    .replace(/\bnothing\s+to\s+fix\b/gi, '');
  return /\b(defect|issue|bug|missing|mismatch|should|fix|correct|wrong|error)\b/i.test(text);
}

function parsePlan(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((s) => s && (s.step || s.title))
      .map((s) => ({ step: String(s.step || s.title).slice(0, 120), detail: String(s.detail || '').slice(0, 240) }))
      .slice(0, 8);
  } catch {
    return null;
  }
}

function previewArgs(args) {
  if (!args || typeof args !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string') out[k] = v.length > 120 ? `${v.slice(0, 120)}…` : v;
    else out[k] = v;
  }
  return out;
}

export { estimateTokens };
