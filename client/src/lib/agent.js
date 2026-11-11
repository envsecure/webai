/**
 * Streaming helper for the agent chat endpoint.
 *
 * The server emits newline-delimited JSON: one event per line.
 */
export async function streamChat(projectId, prompt, { onEvent, signal, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const stored = token || localStorage.getItem('webai.token');
  if (stored) headers.Authorization = `Bearer ${stored}`;

  const res = await fetch(`/api/projects/${projectId}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed (${res.status})`;
    try {
      message = JSON.parse(text).message || message;
    } catch {
      /* keep the default */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'result') result = event;
      if (typeof onEvent === 'function') onEvent(event);
    }
  }

  return result;
}

/** Human-readable label for an agent event. */
export function describeEvent(event) {
  switch (event.type) {
    case 'phase':
      return { kind: 'phase', text: `Phase: ${event.phase}` };
    case 'plan':
      return {
        kind: 'plan',
        text: event.source === 'model' ? 'Plan from the model' : 'Plan (heuristic)',
      };
    case 'plan_fallback':
      return { kind: 'warn', text: `Plan fell back: ${event.message}` };
    case 'iteration':
      return { kind: 'iteration', text: `Iteration ${event.iteration}/${event.max}` };
    case 'message':
      return { kind: 'message', text: event.text };
    case 'tool_progress':
      return { kind: 'tool', text: event.message || event.tool };
    case 'tool_start':
      return { kind: 'tool', text: `${event.tool}(${summarizeArgs(event.args)})` };
    case 'tool_call':
      return { kind: 'tool', text: `${event.tool}${event.path ? ` → ${event.path}` : ''}` };
    case 'context_compacted':
      return {
        kind: 'compact',
        text: `Context compacted: dropped ${event.droppedMessages} message(s), freed ~${event.freedTokens} tokens (${event.tokens}/${event.budget})`,
      };
    case 'subagent_start':
      return { kind: 'subagent', text: `↳ ${event.label} started` };
    case 'subagent_message':
      return { kind: 'subagent', text: `↳ ${event.text}` };
    case 'subagent_finalize':
      return { kind: 'subagent', text: `↳ ${event.summary}` };
    case 'subagent_end':
      return {
        kind: 'subagent',
        text: `↳ ${event.label} finished (${event.iterations} iteration(s), ${event.tokens} tokens)`,
      };
    case 'subagent_error':
      return { kind: 'warn', text: `Subagent error: ${event.message}` };
    case 'review_rework':
      return { kind: 'warn', text: 'Reworking after the review' };
    case 'finalize':
      return { kind: 'done', text: event.summary };
    case 'fallback':
      return { kind: 'warn', text: `Falling back to the local generator: ${event.message}` };
    case 'error':
      return { kind: 'warn', text: event.message };
    case 'done':
      return {
        kind: 'done',
        text: `Done: ${event.files} files, ${event.iterations} iteration(s), ${event.subagents} subagent run(s) in ${Math.round(event.ms / 100) / 10}s`,
      };
    default:
      return null;
  }
}

function summarizeArgs(args) {
  if (!args || typeof args !== 'object') return '';
  const parts = Object.entries(args)
    .filter(([key]) => key !== 'content')
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}=${v.length > 40 ? `${v.slice(0, 40)}…` : v}`;
      if (v && typeof v === 'object') return `${k}=${JSON.stringify(v).slice(0, 40)}`;
      return `${k}=${v}`;
    })
    .slice(0, 3);
  return parts.join(', ');
}
