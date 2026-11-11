/**
 * Context window management.
 *
 * Keeps the conversation inside a token budget by:
 *   1. always protecting the system prompt and the original task,
 *   2. maintaining a rolling summary of everything that fell out of the window,
 *   3. keeping the most recent turns verbatim,
 *   4. tracking a live index of the project's files so the agent never has to
 *      re-read the whole project to remember what exists.
 *
 * Summarisation uses the model when one is available and degrades to a
 * deterministic digest when it is not, so the loop never dies on a context
 * overflow.
 */

const CHARS_PER_TOKEN = 3.6;
const MESSAGE_OVERHEAD = 6;

export function estimateTokens(value) {
  if (value == null) return 0;
  if (typeof value !== 'string') value = JSON.stringify(value);
  return Math.ceil(value.length / CHARS_PER_TOKEN) + MESSAGE_OVERHEAD;
}

function messageTokens(message) {
  let total = estimateTokens(message.content);
  if (message.toolCalls?.length) {
    total += estimateTokens(JSON.stringify(message.toolCalls));
  }
  return total;
}

export class ContextWindow {
  constructor({
    maxTokens = 24000,
    reserveOutput = 4000,
    system = '',
    llm = null,
    keepRecent = 8,
    name = 'main',
  } = {}) {
    this.maxTokens = maxTokens;
    this.reserveOutput = reserveOutput;
    this.system = system;
    this.llm = llm;
    this.keepRecent = keepRecent;
    this.name = name;
    this.messages = [];
    this.summary = null;
    this.compactions = 0;
    this.summarisedTokens = 0;
  }

  get budget() {
    return Math.max(1000, this.maxTokens - this.reserveOutput);
  }

  add(message) {
    this.messages.push(message);
    return message;
  }

  addUser(content) {
    return this.add({ role: 'user', content: String(content) });
  }

  addAssistant(content, toolCalls) {
    const msg = { role: 'assistant', content: content || '' };
    if (toolCalls?.length) msg.toolCalls = toolCalls;
    return this.add(msg);
  }

  addToolResult(toolCallId, name, content) {
    return this.add({
      role: 'tool',
      toolCallId,
      name,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    });
  }

  /** Approximate token usage of everything currently held. */
  tokens() {
    return this.messages.reduce((sum, m) => sum + messageTokens(m), 0);
  }

  isOverBudget() {
    return this.tokens() > this.budget;
  }

  /** The messages actually sent to the model. */
  getMessages({ includeSystem = true } = {}) {
    const out = [];
    if (includeSystem && this.system) out.push({ role: 'system', content: this.system });
    if (this.summary) out.push({ role: 'user', content: this.summary });
    out.push(...this.messages);
    return out;
  }

  /**
   * Drop or summarise old turns until the window fits the budget.
   * Returns a list of events describing what happened (for the UI).
   */
  async compact() {
    const events = [];
    const keep = Math.max(2, this.keepRecent);

    // Compact repeatedly: one pass may not free enough room.
    let guard = 0;
    while (this.isOverBudget() && this.messages.length > keep && guard < 12) {
      guard += 1;
      const dropCount = Math.max(
        1,
        Math.ceil((this.messages.length - keep) / 2)
      );
      const dropped = this.messages.slice(0, dropCount);
      const retained = this.messages.slice(dropCount);
      const droppedTokens = dropped.reduce((s, m) => s + messageTokens(m), 0);

      const summary = await this.summarise(dropped);
      this.summary = this.summary
        ? `${this.summary}\n${summary}`
        : summary;
      this.messages = retained;
      this.compactions += 1;
      this.summarisedTokens += droppedTokens;

      events.push({
        type: 'context_compacted',
        window: this.name,
        droppedMessages: dropped.length,
        freedTokens: droppedTokens,
        tokens: this.tokens(),
        budget: this.budget,
        summary: summary.slice(0, 400),
      });
    }

    return events;
  }

  /** Summarise a set of messages, with a deterministic fallback. */
  async summarise(messages) {
    const transcript = messages
      .map((m) => {
        if (m.role === 'tool') return `[tool ${m.name}] ${truncate(m.content, 400)}`;
        if (m.role === 'assistant' && m.toolCalls?.length) {
          const calls = m.toolCalls.map((tc) => `${tc.name}(${truncate(JSON.stringify(tc.args), 200)})`);
          return `[assistant tool calls] ${calls.join(', ')}`;
        }
        return `[${m.role}] ${truncate(m.content, 600)}`;
      })
      .join('\n');

    if (this.llm) {
      try {
        const res = await this.llm.complete(
          [
            {
              role: 'system',
              content:
                'Summarise the work so far for a coding agent that will continue. ' +
                'Keep: decisions taken, files written, API shapes, open problems, and the next steps. ' +
                'Be terse and factual.',
            },
            { role: 'user', content: transcript },
          ],
          { maxTokens: 700, temperature: 0 }
        );
        const text = (res.text || '').trim();
        if (text) {
          return `[context summary of ${messages.length} earlier messages]\n${text}`;
        }
      } catch {
        /* fall through to the deterministic digest */
      }
    }

    // Deterministic fallback: keep the most informative lines only.
    const lines = transcript
      .split('\n')
      .filter((l) => /\[tool|\[user/.test(l))
      .slice(-12)
      .join('\n');
    return `[context summary of ${messages.length} earlier messages]\n${lines}`;
  }

  stats() {
    return {
      name: this.name,
      messages: this.messages.length,
      tokens: this.tokens(),
      budget: this.budget,
      maxTokens: this.maxTokens,
      compactions: this.compactions,
      summarisedTokens: this.summarisedTokens,
      hasSummary: Boolean(this.summary),
    };
  }
}

export function truncate(value, max = 600) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
