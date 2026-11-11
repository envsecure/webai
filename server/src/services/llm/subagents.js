import { ContextWindow } from './context.js';
import { buildToolSchemas, executeTool, summariseToolResult } from './tools.js';

/**
 * Specialist subagents.
 *
 * Each one runs its own bounded loop with its own context window, so the
 * parent agent's context stays small. A subagent returns a short report that
 * is handed back to the parent as a tool result.
 */

const BASE_RULES = `
You are a focused specialist working inside an agent that is building a real
project. Follow these rules:
- Do exactly the task you were given. Do not expand the scope.
- Use the tools to write real, complete files. Never describe code without
  writing it.
- Keep every file self-contained and runnable.
- When the task is done, call finalize with a short report of what you produced.
`.trim();

export const SUBAGENTS = {
  db_designer: {
    id: 'db_designer',
    label: 'Database designer',
    description: 'Designs the SQLite schema and seed data for the app.',
    system: `${BASE_RULES}

Your task: design the data model.
- Write a schema file at "server/schema.sql" using plain SQLite DDL
  (CREATE TABLE IF NOT EXISTS, TEXT ids, ISO timestamps).
- Include an index for every foreign key and for the columns you filter on.
- Keep it to the entities the task actually needs.`,
    tools: ['write_file', 'read_file', 'list_files', 'finalize'],
    maxIterations: 5,
    maxTokens: 8000,
  },

  api_builder: {
    id: 'api_builder',
    label: 'API engineer',
    description: 'Writes the Express REST routes and the client API helper.',
    system: `${BASE_RULES}

Your task: build the backend.
- Write an Express router under "server/src/routes/" for the entities in the task.
- Use a plain module that exports a Router; the app mounts it for you.
- Write the client-side fetch helper to "client/src/lib/api.js".
- Keep the SQL parameterised (never interpolate user input into SQL).`,
    tools: ['write_file', 'read_file', 'list_files', 'finalize'],
    maxIterations: 6,
    maxTokens: 10000,
  },

  ui_builder: {
    id: 'ui_builder',
    label: 'Frontend engineer',
    description: 'Builds the React components and the app shell.',
    system: `${BASE_RULES}

Your task: build the UI.
- Write React components under "client/src/components/" as .jsx files.
- Write the app shell to "client/src/App.jsx".
- Use function components with hooks. No TypeScript, no external UI libraries.
- Make it accessible: label every input, use semantic elements.`,
    tools: ['write_file', 'read_file', 'list_files', 'finalize'],
    maxIterations: 6,
    maxTokens: 10000,
  },

  reviewer: {
    id: 'reviewer',
    label: 'Code reviewer',
    description: 'Reviews the generated code and reports concrete defects.',
    system: `${BASE_RULES}

Your task: review what has been built.
- Read the files that exist (list_files first).
- Look for: missing imports, mismatched entity names between the API and the UI,
  SQL that does not match the schema, unhandled errors, missing accessibility.
- Do NOT modify files. Report the concrete defects you found, each with the file
  path and the fix. If the code is sound, say so plainly.`,
    tools: ['read_file', 'list_files', 'finalize'],
    maxIterations: 5,
    maxTokens: 8000,
  },

  tester: {
    id: 'tester',
    label: 'QA engineer',
    description: 'Writes a smoke test and a manual test plan for the app.',
    system: `${BASE_RULES}

Your task: verify the app.
- Read the API routes and the schema.
- Write a Node smoke test to "server/test/smoke.test.mjs" that starts nothing but
  exercises the pure logic and asserts the expected shapes.
- Write "server/test/MANUAL.md" with a short numbered checklist a human can run.
- Report anything that looks broken.`,
    tools: ['read_file', 'list_files', 'write_file', 'finalize'],
    maxIterations: 5,
    maxTokens: 8000,
  },
};

export function listSubagents() {
  return Object.values(SUBAGENTS).map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    tools: s.tools,
  }));
}

/**
 * Run one subagent to completion.
 *
 * @returns {Promise<{report:string, iterations:number, tokens:number, events:Array}>}
 */
export async function runSubagent({
  definition,
  task,
  workspace,
  llm,
  onEvent,
  parentContext = null,
}) {
  const emit = (event) => {
    if (typeof onEvent === 'function') onEvent({ ...event, subagent: definition.id });
  };

  const context = new ContextWindow({
    name: definition.id,
    system: definition.system,
    maxTokens: definition.maxTokens,
    reserveOutput: 2000,
    llm,
    keepRecent: 6,
  });

  context.addUser(task);

  const schemas = buildToolSchemas({
    includeDelegate: false,
  }).filter((t) => definition.tools.includes(t.name));

  let iterations = 0;
  let report = '';
  let tokens = 0;

  emit({ type: 'subagent_start', label: definition.label, task: task.slice(0, 300) });

  while (iterations < definition.maxIterations) {
    iterations += 1;
    const compaction = await context.compact();
    compaction.forEach((event) => emit(event));

    let response;
    try {
      response = await llm.chat(context.getMessages(), { tools: schemas });
    } catch (err) {
      emit({ type: 'subagent_error', message: err.message });
      report = `Subagent failed: ${err.message}`;
      break;
    }

    if (response.usage?.total_tokens) tokens += response.usage.total_tokens;
    if (response.content) {
      context.addAssistant(response.content);
      emit({ type: 'subagent_message', text: response.content.slice(0, 600) });
    }

    const calls = response.toolCalls || [];
    if (!calls.length) {
      report = response.content || 'Subagent finished without a report.';
      break;
    }

    context.addAssistant(response.content, calls);

    for (const call of calls) {
      if (call.name === 'finalize') {
        report = String(call.args?.summary || response.content || 'done');
        emit({ type: 'subagent_finalize', summary: report.slice(0, 600) });
        iterations = definition.maxIterations; // break out
        break;
      }
      const result = await executeTool(call.name, call.args, { workspace, onEvent: emit });
      context.addToolResult(call.id, call.name, summariseToolResult(result));
    }
    if (report) break;
  }

  if (!report) report = 'Subagent reached its iteration limit before reporting.';

  emit({
    type: 'subagent_end',
    label: definition.label,
    iterations,
    tokens,
    report: report.slice(0, 600),
  });

  return { report, iterations, tokens, context: context.stats() };
}
