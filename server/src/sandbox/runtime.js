#!/usr/bin/env node
/**
 * Sandbox runtime.
 *
 * Runs one generated project:
 *   - the generated Express routers, mounted at /api/<entity>, with a
 *     per-project SQLite database,
 *   - the generated React app, served by Vite in middleware mode with hot
 *     reloading.
 *
 * Started as a child process by services/sandbox.js. The port and the project
 * directory arrive through the environment.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import Database from 'better-sqlite3';
import { pathToFileURL } from 'node:url';

const DIR = path.resolve(process.env.SANDBOX_DIR || process.cwd());
const PORT = Number(process.env.SANDBOX_PORT || 0);
const ROOT = path.resolve(process.env.SANDBOX_ROOT || path.join(DIR, '..', '..', '..'));
// The prefix the app proxies this sandbox under, e.g. /api/sandbox/prj_x/
const BASE = process.env.SANDBOX_BASE ? `/${process.env.SANDBOX_BASE.replace(/^\/+|\/+$/g, '')}/` : '/';

const log = (...args) => console.log('[sandbox]', ...args);

/* --------------------------------- database -------------------------------- */

const dbDir = path.join(DIR, 'server', 'data');
fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(DIR, 'server', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  try {
    db.exec(fs.readFileSync(schemaPath, 'utf8'));
    log('schema applied');
  } catch (err) {
    console.error('[sandbox] schema failed:', err.message);
  }
}

const seedPath = path.join(DIR, 'server', 'seed.sql');
if (fs.existsSync(seedPath)) {
  try {
    db.exec(fs.readFileSync(seedPath, 'utf8'));
    log('seed applied');
  } catch (err) {
    console.error('[sandbox] seed failed:', err.message);
  }
}

/** The database API the generated routes expect. */
const dbApi = {
  query: (sql, params = []) => db.prepare(sql).all(params),
  get: (sql, params = []) => db.prepare(sql).get(params) ?? null,
  run: (sql, params = []) => {
    const info = db.prepare(sql).run(params);
    return { changes: info.changes };
  },
  /** The columns of a table, so a route can adapt to the schema. */
  columns: (table) => {
    const name = String(table).replace(/[^a-zA-Z0-9_]/g, '');
    try {
      return db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name);
    } catch {
      return [];
    }
  },
};

/* ---------------------------------- server --------------------------------- */

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.db = dbApi;
  next();
});

// A tiny health endpoint for the sandbox itself.
app.get('/__sandbox/health', (_req, res) => {
  res.json({ ok: true, dir: DIR, pid: process.pid });
});

// The generated routers.
const routesDir = path.join(DIR, 'server', 'src', 'routes');
let mounted = [];
if (fs.existsSync(routesDir)) {
  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
    const name = file.replace(/\.js$/, '');
    try {
      const mod = await import(pathToFileURL(path.join(routesDir, file)).href);
      const router = mod.default || mod.router;
      if (router) {
        // Mounted twice on purpose: once under the proxy prefix (what the
        // generated client calls) and once at the root, so the app works
        // whether it is opened through the proxy or on its own.
        app.use(`${BASE}api/${name}`, router);
        app.use(`/api/${name}`, router);
        mounted.push(name);
      }
    } catch (err) {
      console.error(`[sandbox] route ${name} failed to load:`, err.message);
    }
  }
}
log('routes mounted:', mounted.join(', ') || '(none)');

/* ----------------------------------- vite ---------------------------------- */

// The HTTP server is created first so Vite can attach its hot-reload
// websocket to it. The proxy forwards the upgrade to this server, so hot
// reload works through the app origin.
const server = http.createServer(app);

let vite = null;
try {
  const { createServer } = await import('vite');
  vite = await createServer({
    root: DIR,
    // Assets are emitted under the proxy prefix so the browser keeps talking
    // to the app origin instead of escaping to a bare path.
    base: BASE,
    appType: 'spa',
    server: {
      middlewareMode: true,
      host: '127.0.0.1',
      // The hot-reload websocket lives on this server; the proxy forwards the
      // upgrade, so the browser only ever talks to the app origin.
      hmr: { server },
    },
    resolve: {
      alias: {
        react: path.resolve(ROOT, 'node_modules/react'),
        'react-dom': path.resolve(ROOT, 'node_modules/react-dom'),
      },
    },
    // React has to be pre-bundled, otherwise the browser gets the CommonJS
    // build and the named imports fail.
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
    },
    // The automatic JSX runtime, so the generated components do not have to
    // import React themselves.
    esbuild: { jsx: 'automatic' },
    logLevel: 'error',
  });
  app.use(vite.middlewares);
  log('vite dev server ready');
} catch (err) {
  console.error('[sandbox] vite failed to start:', err.message);
  app.use((_req, res) => {
    res.status(503).send('Preview unavailable: ' + err.message);
  });
}

/* ---------------------------------- listen --------------------------------- */

server.listen(PORT, '127.0.0.1', () => {
  const address = server.address();
  log(`listening on ${address.port}`);
  // Tell the parent we are ready.
  if (process.send) process.send({ type: 'ready', port: address.port });
});

// The parent may ask for a graceful shutdown.
process.on('message', (msg) => {
  if (msg?.type === 'shutdown') {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  }
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
