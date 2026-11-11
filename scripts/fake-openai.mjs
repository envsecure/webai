#!/usr/bin/env node
/**
 * A tiny OpenAI-compatible server used to test the provider path without a
 * real API key.
 *
 * It speaks the chat-completions protocol, including tool calls:
 *   POST /v1/chat/completions  ->  { choices: [{ message: { content, tool_calls } }] }
 *
 * Run:  node scripts/fake-openai.mjs [port]
 */
import http from 'node:http';

const PORT = Number(process.argv[2] || 3998);

let counter = 0;

function toolCall(name, args) {
  return {
    id: `call_${++counter}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

function decide(messages, hasTools) {
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const hasToolResult = messages.some((m) => m.role === 'tool');

  // Planning / summarising calls have no tools: answer with plain text.
  if (!hasTools) {
    if (/build plans/i.test(system)) {
      return {
        content: JSON.stringify([
          { step: 'Design the data model', detail: 'A products table with a stock index' },
          { step: 'Build the REST API', detail: 'CRUD routes for products' },
          { step: 'Build the interface', detail: 'A React list with a create form' },
        ]),
      };
    }
    if (/summarise/i.test(system)) {
      return { content: 'The agent wrote the schema, the API router and the React component.' };
    }
    return { content: 'ok' };
  }

  const assistantTurns = messages.filter((m) => m.role === 'assistant').length;
  const written = messages.filter((m) => m.role === 'tool').length;

  if (!hasToolResult && assistantTurns === 0) {
    return {
      content: 'Writing the schema first.',
      tool_calls: [
        toolCall('write_file', {
          path: 'server/schema.sql',
          content: 'CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL);\n',
        }),
      ],
    };
  }

  if (written === 1) {
    return {
      content: 'Now the API route.',
      tool_calls: [
        toolCall('write_file', {
          path: 'server/src/routes/products.js',
          content: "import { Router } from 'express';\nconst router = Router();\nexport default router;\n",
        }),
      ],
    };
  }

  if (written === 2) {
    return {
      content: 'Now the UI.',
      tool_calls: [
        toolCall('write_file', {
          path: 'client/src/App.jsx',
          content: 'export default function App() {\n  return <div>Products</div>;\n}\n',
        }),
      ],
    };
  }

  if (written === 3) {
    return {
      content: 'Let me delegate a review.',
      tool_calls: [
        toolCall('delegate', {
          subagent: 'reviewer',
          task: 'Review the files that were just written.',
        }),
      ],
    };
  }

  return {
    content: 'Everything is in place.',
    tool_calls: [toolCall('finalize', { summary: 'Built a small products app over HTTP.' })],
  };
}

const server = http.createServer((req, res) => {
  if (req.url.endsWith('/models')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        object: 'list',
        data: [
          { id: 'fake-model', context_length: 32768, owned_by: 'local' },
          { id: 'fake-model-large', context_length: 131072, owned_by: 'local' },
          { id: 'fake-model-tiny', context_length: 4096, owned_by: 'local' },
        ],
      })
    );
    return;
  }

  if (!req.url.endsWith('/chat/completions')) {
    res.writeHead(404).end('not found');
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let payload = {};
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      /* ignore */
    }
    const messages = payload.messages || [];
    const hasTools = Array.isArray(payload.tools) && payload.tools.length > 0;
    const decision = decide(messages, hasTools);

    const message = { role: 'assistant', content: decision.content ?? '' };
    if (decision.tool_calls) message.tool_calls = decision.tool_calls;

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        model: payload.model || 'fake-model',
        choices: [{ index: 0, message, finish_reason: decision.tool_calls ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
      })
    );
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake openai-compatible server on http://127.0.0.1:${PORT}/v1`);
});
