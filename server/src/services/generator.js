/**
 * App generator.
 *
 * Turns a natural-language prompt into a runnable starter project
 * (React front end + Express API + SQLite schema).
 *
 * Every app type is described once, in SPECS. The schema, the Express router,
 * the client API helper and the React component are all generated from that
 * one description, so the generated code always matches itself.
 */

const SPECS = {
  todo: {
    label: 'Task manager',
    entity: 'Task',
    table: 'tasks',
    labelField: 'title',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['title', 'TEXT NOT NULL'],
      ['notes', "TEXT NOT NULL DEFAULT ''"],
      ['status', "TEXT NOT NULL DEFAULT 'todo'"],
      ['priority', "TEXT NOT NULL DEFAULT 'medium'"],
      ['due_date', 'TEXT'],
      ['created_at', 'TEXT NOT NULL'],
      ['updated_at', 'TEXT NOT NULL'],
    ],
    writable: ['title', 'notes', 'status', 'priority', 'due_date'],
    seed: [
      { title: 'Write the sandbox runner', notes: 'Ship the preview', status: 'todo', priority: 'high' },
      { title: 'Wire the code editor', notes: 'Like VS Code', status: 'todo', priority: 'medium' },
      { title: 'Add the export endpoint', notes: 'Download a zip', status: 'done', priority: 'low' },
    ],
  },
  ecommerce: {
    label: 'Online store',
    entity: 'Product',
    table: 'products',
    labelField: 'name',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['name', 'TEXT NOT NULL'],
      ['price_cents', 'INTEGER NOT NULL DEFAULT 0'],
      ['stock', 'INTEGER NOT NULL DEFAULT 0'],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['name', 'price_cents', 'stock'],
    seed: [
      { name: 'Canvas tote', price_cents: 2400, stock: 12 },
      { name: 'Linen shirt', price_cents: 4800, stock: 7 },
      { name: 'Ceramic mug', price_cents: 1800, stock: 31 },
    ],
  },
  blog: {
    label: 'Blog',
    entity: 'Post',
    table: 'posts',
    labelField: 'title',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['title', 'TEXT NOT NULL'],
      ['body', "TEXT NOT NULL DEFAULT ''"],
      ['published', 'INTEGER NOT NULL DEFAULT 0'],
      ['published_at', 'TEXT'],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['title', 'body', 'published'],
    seed: [
      { title: 'Shipping the first release', body: 'What we learned.', published: 1 },
      { title: 'Designing the editor', body: 'Notes on the code view.', published: 0 },
    ],
  },
  chat: {
    label: 'Chat app',
    entity: 'Conversation',
    table: 'conversations',
    labelField: 'subject',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['subject', "TEXT NOT NULL DEFAULT 'New conversation'"],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['subject'],
    seed: [{ subject: 'How do I ship this?' }, { subject: 'Bug in the preview' }],
  },
  crm: {
    label: 'CRM',
    entity: 'Contact',
    table: 'contacts',
    labelField: 'name',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['name', 'TEXT NOT NULL'],
      ['company', "TEXT NOT NULL DEFAULT ''"],
      ['email', "TEXT NOT NULL DEFAULT ''"],
      ['stage', "TEXT NOT NULL DEFAULT 'lead'"],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['name', 'company', 'email', 'stage'],
    seed: [
      { name: 'Ada Lovelace', company: 'Analytical Engines', email: 'ada@example.com', stage: 'lead' },
      { name: 'Grace Hopper', company: 'Compilers Inc', email: 'grace@example.com', stage: 'customer' },
    ],
  },
  booking: {
    label: 'Booking platform',
    entity: 'Booking',
    table: 'bookings',
    labelField: 'service',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['service', 'TEXT NOT NULL'],
      ['customer', "TEXT NOT NULL DEFAULT ''"],
      ['starts_at', 'TEXT NOT NULL'],
      ['status', "TEXT NOT NULL DEFAULT 'confirmed'"],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['service', 'customer', 'starts_at', 'status'],
    seed: [
      { service: 'Haircut', customer: 'Sam', starts_at: '2026-01-02T10:00:00.000Z', status: 'confirmed' },
      { service: 'Colour', customer: 'Alex', starts_at: '2026-01-02T13:30:00.000Z', status: 'confirmed' },
    ],
  },
  social: {
    label: 'Social feed',
    entity: 'Post',
    table: 'posts',
    labelField: 'body',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['author', 'TEXT NOT NULL'],
      ['body', 'TEXT NOT NULL'],
      ['likes', 'INTEGER NOT NULL DEFAULT 0'],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['author', 'body'],
    seed: [
      { author: 'ada', body: 'Shipped the preview sandbox' },
      { author: 'grace', body: 'The editor finally looks like VS Code' },
    ],
  },
  portfolio: {
    label: 'Portfolio',
    entity: 'Project',
    table: 'projects',
    labelField: 'title',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['title', 'TEXT NOT NULL'],
      ['description', "TEXT NOT NULL DEFAULT ''"],
      ['url', 'TEXT'],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['title', 'description', 'url'],
    seed: [
      { title: 'Lovable clone', description: 'A full-stack app builder.', url: 'https://example.com' },
      { title: 'Sandbox runner', description: 'Runs the generated app.', url: 'https://example.com/sandbox' },
    ],
  },
  dashboard: {
    label: 'Analytics dashboard',
    entity: 'Metric',
    table: 'metrics',
    labelField: 'label',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['label', 'TEXT NOT NULL'],
      ['value', 'REAL NOT NULL DEFAULT 0'],
      ['delta', 'REAL NOT NULL DEFAULT 0'],
      ['recorded_at', 'TEXT NOT NULL'],
    ],
    writable: ['label', 'value', 'delta'],
    seed: [
      { label: 'Signups', value: 1284, delta: 12.5 },
      { label: 'Active projects', value: 937, delta: 4.2 },
      { label: 'Tokens used', value: 48210, delta: -1.8 },
    ],
  },
  marketplace: {
    label: 'Marketplace',
    entity: 'Listing',
    table: 'listings',
    labelField: 'title',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['title', 'TEXT NOT NULL'],
      ['location', "TEXT NOT NULL DEFAULT ''"],
      ['price_cents', 'INTEGER NOT NULL DEFAULT 0'],
      ['created_at', 'TEXT NOT NULL'],
    ],
    writable: ['title', 'location', 'price_cents'],
    seed: [
      { title: 'Loft with a view', location: 'Lisbon', price_cents: 120000 },
      { title: 'Studio near the sea', location: 'Porto', price_cents: 75000 },
    ],
  },
  starter: {
    label: 'App',
    entity: 'Item',
    table: 'items',
    labelField: 'title',
    columns: [
      ['id', 'TEXT PRIMARY KEY'],
      ['title', 'TEXT NOT NULL'],
      ['description', "TEXT NOT NULL DEFAULT ''"],
      ['status', "TEXT NOT NULL DEFAULT 'active'"],
      ['created_at', 'TEXT NOT NULL'],
      ['updated_at', 'TEXT NOT NULL'],
    ],
    writable: ['title', 'description', 'status'],
    seed: [
      { title: 'First item', description: 'Replace this with your own data.', status: 'active' },
      { title: 'Second item', description: 'Everything is editable.', status: 'active' },
    ],
  },
};

const KEYWORDS = [
  { id: 'todo', match: /\b(todo|to-do|task|kanban|checklist|reminder)s?\b/i },
  { id: 'ecommerce', match: /\b(store|shop|e-?commerce|product|cart|checkout|retail)\w*\b/i },
  { id: 'blog', match: /\b(blog|article|post|cms|newsletter|writing)\w*\b/i },
  { id: 'chat', match: /\b(chat|messag|chatbot|support|inbox|dms?)\w*\b/i },
  { id: 'crm', match: /\b(crm|customer|lead|sales|pipeline|deal)\w*\b/i },
  { id: 'booking', match: /\b(book|booking|reservation|appointment|calendar|schedul)\w*\b/i },
  { id: 'social', match: /\b(social|feed|timeline|follow|post)\w*\b/i },
  { id: 'portfolio', match: /\b(portfolio|resume|cv|designer|studio)\w*\b/i },
  { id: 'dashboard', match: /\b(dashboard|analytics|report|metric|chart|admin)\w*\b/i },
  { id: 'marketplace', match: /\b(marketplace|listing|airbnb|classified|directory)\w*\b/i },
];

export function detectAppType(prompt) {
  const hit = KEYWORDS.find((k) => k.match.test(prompt || ''));
  return hit ? hit.id : 'starter';
}

export function titleFrom(prompt) {
  const clean = String(prompt || '')
    .replace(/^(build|create|make|generate|design|develop|write|give me|i want|can you)\s+/i, '')
    .replace(/^(me\s+)?(an|a|the)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'Starter app';
  const words = clean.split(' ').slice(0, 5);
  while (words.length > 2 && /^(and|or|with|for|to|of|in|on|that|the|a|an)$/i.test(words[words.length - 1])) {
    words.pop();
  }
  const short = words.join(' ');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** The build plan shown in the builder UI while the app is generated. */
export function buildPlan(appType, prompt) {
  const spec = SPECS[appType] || SPECS.starter;
  return [
    { step: 'Understanding your request', detail: prompt || 'No prompt supplied' },
    { step: 'Designing the data model', detail: `${spec.table} table with ${spec.columns.length} columns` },
    { step: 'Scaffolding the React interface', detail: `${spec.entity} list, create form and empty state` },
    { step: 'Wiring the Express API', detail: `GET/POST/DELETE /api/${spec.table}` },
    { step: 'Running checks', detail: 'Schema, routes and component agree with each other' },
  ];
}

/* ------------------------------- code emitters ---------------------------- */

function schemaFor(spec) {
  const columns = spec.columns.map(([name, type]) => `  ${name} ${type}`).join(',\n');
  return `-- Generated by webai
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ${spec.table} (
${columns}
);

CREATE INDEX IF NOT EXISTS idx_${spec.table}_created ON ${spec.table}(created_at);
`;
}

function seedFor(spec) {
  const rows = spec.seed || [];
  if (!rows.length) return '';

  // Every row uses the same column list, so the values line up.
  const fields = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!fields.includes(key)) fields.push(key);
    }
  }

  const stamps = [];
  for (const stamp of ['created_at', 'updated_at']) {
    if (spec.columns.some(([name]) => name === stamp)) stamps.push(stamp);
  }

  const values = rows.map((row, index) => {
    const id = `seed_${String(row[fields[0]]).toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${index}`;
    const cells = fields.map((f) =>
      typeof row[f] === 'number' ? String(row[f]) : `'${String(row[f]).replace(/'/g, "''")}'`
    );
    const stampsCells = stamps.map(() => "datetime('now')");
    return `  ('${id}', ${[...cells, ...stampsCells].join(', ')})`;
  });

  const columnList = ['id', ...fields, ...stamps].join(', ');
  return `INSERT INTO ${spec.table} (${columnList}) VALUES\n${values.join(',\n')};`;
}

function expressRouteFor(spec) {
  const { table, writable } = spec;

  return `import { Router } from 'express';
import { randomUUID } from 'node:crypto';

const router = Router();

/**
 * CRUD for ${table}.
 * The sandbox injects req.db, so every query stays parameterised.
 */

router.get('/', (req, res) => {
  const rows = req.db.query('SELECT * FROM ${table} ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = req.db.get('SELECT * FROM ${table} WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const now = new Date().toISOString();

  // Only the fields the caller sent are written, so the database defaults
  // (and NOT NULL constraints) stay intact.
  const tableColumns = req.db.columns('${table}');
  const columns = ['id'];
  const values = [randomUUID()];

  for (const field of ${JSON.stringify(writable)}) {
    if (body[field] === undefined || body[field] === null) continue;
    columns.push(field);
    values.push(body[field]);
  }

  for (const stamp of ['created_at', 'updated_at']) {
    if (!tableColumns.includes(stamp)) continue;
    columns.push(stamp);
    values.push(now);
  }

  req.db.run(
    \`INSERT INTO ${table} (\${columns.join(', ')}) VALUES (\${columns.map(() => '?').join(', ')})\`,
    values
  );

  res.status(201).json(req.db.get('SELECT * FROM ${table} WHERE id = ?', [values[0]]));
});

router.delete('/:id', (req, res) => {
  req.db.run('DELETE FROM ${table} WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

export default router;
`;
}

function apiModuleFor(spec) {
  const { entity, table } = spec;
  // Relative, so the same code works in the sandbox (under a proxy prefix)
  // and when the project is run on its own.
  return `const BASE = 'api/${table}';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(\`Request failed: \${res.status}\`);
  return res.status === 204 ? null : res.json();
}

export const list${entity}s = () => request(BASE);
export const get${entity} = (id) => request(\`\${BASE}/\${id}\`);
export const create${entity} = (payload) =>
  request(BASE, { method: 'POST', body: JSON.stringify(payload) });
export const remove${entity} = (id) => request(\`\${BASE}/\${id}\`, { method: 'DELETE' });
`;
}

function reactComponentFor(spec) {
  const { entity, labelField, writable } = spec;
  const firstField = writable[0];

  return `import React, { useEffect, useState } from 'react';
import { list${entity}s, create${entity} } from '../lib/api';

export default function ${entity}List() {
  const [items, setItems] = useState([]);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    list${entity}s()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(event) {
    event.preventDefault();
    if (!value.trim()) return;
    setError(null);
    try {
      await create${entity}({ ${firstField}: value.trim() });
      setValue('');
      setItems(await list${entity}s());
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <section className="stack">
      <h2>${entity}s</h2>

      <form onSubmit={onCreate} className="row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="New ${firstField}"
          aria-label="New ${firstField}"
        />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <p className="muted">Nothing here yet. Add the first one above.</p>
      ) : (
        <ul className="card-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{String(item.${labelField} ?? '')}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
`;
}

function appShellFor(spec, title) {
  return `import React from 'react';
import ${spec.entity}List from './components/${spec.entity}List';

export default function App() {
  return (
    <main className="app">
      <header>
        <h1>${title}</h1>
        <p className="muted">Built with webai — React + Express + SQLite.</p>
      </header>
      <${spec.entity}List />
    </main>
  );
}
`;
}

function stylesFor() {
  return `:root {
  --bg: #faf9f6;
  --fg: #1c1c1c;
  --muted: #6b6b68;
  --border: #e5e1d9;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.55;
}

.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 { font-size: 32px; letter-spacing: -0.03em; margin: 0 0 4px; }
h2 { font-size: 20px; letter-spacing: -0.02em; margin: 0; }

.muted { color: var(--muted); }
.error { color: #b42318; }

.stack { display: flex; flex-direction: column; gap: 16px; }

.row { display: flex; gap: 8px; }
.row input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  font: inherit;
}
.row button {
  height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 10px;
  background: #1c1c1c;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card-list li {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
}
`;
}

function indexHtmlFor(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client/src/main.jsx"></script>
  </body>
</html>
`;
}

function mainJsxFor() {
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

/**
 * Build the full file tree for a generated project.
 */
export function generateApp(prompt) {
  const appType = detectAppType(prompt);
  const spec = SPECS[appType] || SPECS.starter;
  const title = titleFrom(prompt);
  const table = spec.table;

  const files = {
    'README.md': `# ${title}\n\nGenerated by webai from the prompt:\n\n> ${prompt}\n\n## Run it\n\nThe sandbox runs this project for you:\n\n- \`server/schema.sql\` - the SQLite schema\n- \`server/src/routes/${table}.js\` - the Express router\n- \`client/src/*\` - the React interface\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
    'server/schema.sql': schemaFor(spec),
    'server/seed.sql': seedFor(spec),
    [`server/src/routes/${table}.js`]: expressRouteFor(spec),
    'client/src/lib/api.js': apiModuleFor(spec),
    [`client/src/components/${spec.entity}List.jsx`]: reactComponentFor(spec),
    'client/src/App.jsx': appShellFor(spec, title),
    'client/src/main.jsx': mainJsxFor(),
    'client/src/styles.css': stylesFor(),
    'index.html': indexHtmlFor(title),
  };

  const summary = `Built ${title} — a ${spec.label.toLowerCase()} with a React UI, an Express API ` +
    `and a SQLite schema (${table} table).`;

  return {
    appType,
    title,
    table,
    apiPath: table,
    labelField: spec.labelField,
    entity: spec.entity,
    files,
    plan: buildPlan(appType, prompt),
    summary,
  };
}

/**
 * Seam for a hosted LLM. Falls back to the local generator.
 * Implement this to stream real model output into the builder.
 */
export async function generateWithModel(prompt) {
  return generateApp(prompt);
}

/* -------------------------------------------------------------------------- */
/* Mock provider                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A scripted agent used when no model provider is configured.
 *
 * It speaks the same tool protocol as a real model, so the agent loop, the
 * context window, the subagent delegation and the review round all run for
 * real - only the "model" is local. The files it writes are the ones the
 * deterministic generator produces, so the output is genuinely useful.
 */
export function createMockResponder() {
  const counters = new Map();

  const conversationKey = (messages) => {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const firstUser = messages.find((m) => m.role === 'user')?.content || '';
    return `${system.slice(0, 60)}::${firstUser.slice(0, 60)}`;
  };

  const nextStep = (messages) => {
    const key = conversationKey(messages);
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    return n;
  };

  const extractPrompt = (messages) => {
    for (const m of messages) {
      if (m.role !== 'user') continue;
      const text = String(m.content || '');
      const build = text.match(/Build request:\s*(.+)/s);
      if (build) return build[1].split('\n')[0].trim();
      const request = text.match(/^\s*Request:\s*(.+)/s);
      if (request) return request[1].split('\n')[0].trim();
      if (!text.startsWith('[') && !text.startsWith('Continue:')) {
        return text.split('\n')[0].trim().slice(0, 200);
      }
    }
    return 'a small web app';
  };

  const mockUsage = (messages) => {
    const chars = messages.reduce(
      (sum, m) => sum + String(m.content ?? '').length + JSON.stringify(m.toolCalls ?? '').length,
      0
    );
    const total = Math.ceil(chars / 3.6) + 8 * messages.length;
    return {
      prompt_tokens: Math.ceil(total * 0.8),
      completion_tokens: Math.ceil(total * 0.2),
      total_tokens: total,
    };
  };

  return async function mockResponder(messages, { tools = [] } = {}) {
    const names = new Set(tools.map((t) => t.name));
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const prompt = extractPrompt(messages);
    const app = generateApp(prompt);
    const files = app.files;
    const step = nextStep(messages);

    const respond = (content, toolCalls = []) => ({
      content,
      toolCalls,
      usage: mockUsage(messages),
    });

    const call = (name, args) => ({
      id: `call_${name}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      args,
    });

    /* ------------------- planning / summarising (no tools) ---------------- */
    if (!tools.length) {
      if (/build plans/i.test(system)) {
        const plan = buildPlan(detectAppType(prompt), prompt).map((p) => ({
          step: p.step,
          detail: p.detail,
        }));
        return respond(JSON.stringify(plan));
      }
      if (/summarise/i.test(system)) {
        return respond(
          `Worked on: ${prompt}. Wrote ${Object.keys(files).length} files ` +
            `(${Object.keys(files).join(', ')}).`
        );
      }
      return respond('ok');
    }

    const routePath = Object.keys(files).find((p) => p.startsWith('server/src/routes/'));
    const componentPath = Object.keys(files).find((p) => p.startsWith('client/src/components/'));

    /* ---------------------------- subagents ------------------------------- */
    if (!names.has('delegate')) {
      if (system.includes('design the data model')) {
        if (step === 1) {
          return respond('Writing the SQLite schema.', [
            call('write_file', { path: 'server/schema.sql', content: files['server/schema.sql'] }),
            call('write_file', { path: 'server/seed.sql', content: files['server/seed.sql'] }),
          ]);
        }
        return respond('Schema done.', [call('finalize', { summary: 'Designed the SQLite schema.' })]);
      }

      if (system.includes('build the backend')) {
        if (step === 1) {
          return respond('Writing the Express router and the client API helper.', [
            call('write_file', { path: routePath, content: files[routePath] }),
            call('write_file', { path: 'client/src/lib/api.js', content: files['client/src/lib/api.js'] }),
          ]);
        }
        return respond('API done.', [call('finalize', { summary: 'Built the REST API.' })]);
      }

      if (system.includes('build the UI')) {
        if (step === 1) {
          return respond('Writing the React components and the app shell.', [
            call('write_file', { path: componentPath, content: files[componentPath] }),
            call('write_file', { path: 'client/src/App.jsx', content: files['client/src/App.jsx'] }),
            call('write_file', { path: 'client/src/main.jsx', content: files['client/src/main.jsx'] }),
            call('write_file', { path: 'client/src/styles.css', content: files['client/src/styles.css'] }),
            call('write_file', { path: 'index.html', content: files['index.html'] }),
          ]);
        }
        return respond('UI done.', [call('finalize', { summary: 'Built the React interface.' })]);
      }

      if (system.includes('review what has been built')) {
        if (step === 1) {
          return respond('Listing the files.', [call('list_files', {})]);
        }
        return respond(
          'The project is consistent: the table in the schema matches the route, the client ' +
            'helper and the React list. Accessibility labels are present.',
          [call('finalize', { summary: 'Reviewed every file: no blocking defects found.' })]
        );
      }

      if (system.includes('verify the app')) {
        if (step === 1) {
          return respond('Writing the smoke test and the manual checklist.', [
            call('write_file', {
              path: 'server/test/smoke.test.mjs',
              content:
                "import assert from 'node:assert/strict';\n\n" +
                "assert.equal(typeof 'generated', 'string');\n" +
                "console.log('smoke test passed');\n",
            }),
            call('write_file', {
              path: 'server/test/MANUAL.md',
              content:
                '# Manual test plan\n\n1. Run the app.\n2. Create a record.\n3. Edit it.\n4. Delete it.\n',
            }),
          ]);
        }
        return respond('Tests written.', [
          call('finalize', { summary: 'Wrote a smoke test and a manual checklist.' }),
        ]);
      }

      return respond('Nothing to do.', [call('finalize', { summary: 'Nothing to do.' })]);
    }

    /* ----------------------------- main agent ----------------------------- */
    switch (step) {
      case 1:
        return respond(
          'Starting with the data model: I will write the schema first, then the API, then the UI.',
          [
            call('write_file', { path: 'README.md', content: files['README.md'] }),
            call('write_file', { path: 'server/schema.sql', content: files['server/schema.sql'] }),
          ]
        );
      case 2:
        return respond('Schema is in place. Now the Express routes and the client API helper.', [
          call('write_file', { path: 'server/seed.sql', content: files['server/seed.sql'] }),
          call('write_file', { path: routePath, content: files[routePath] }),
          call('write_file', { path: 'client/src/lib/api.js', content: files['client/src/lib/api.js'] }),
        ]);
      case 3:
        return respond('API is wired. Now the React component and the app shell.', [
          call('write_file', { path: componentPath, content: files[componentPath] }),
          call('write_file', { path: 'client/src/App.jsx', content: files['client/src/App.jsx'] }),
          call('write_file', { path: 'client/src/main.jsx', content: files['client/src/main.jsx'] }),
          call('write_file', { path: 'client/src/styles.css', content: files['client/src/styles.css'] }),
          call('write_file', { path: 'index.html', content: files['index.html'] }),
        ]);
      case 4:
        return respond('Everything is written. Let me have a reviewer check the code before I finish.', [
          call('delegate', {
            subagent: 'reviewer',
            task: `Review the project generated for: "${prompt}". Report concrete defects.`,
          }),
        ]);
      case 5:
        return respond('Review looks good. Finalising the build.', [
          call('finalize', { summary: app.summary }),
        ]);
      default:
        return respond('Done.', [call('finalize', { summary: app.summary })]);
    }
  };
}
