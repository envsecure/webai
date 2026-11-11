#!/usr/bin/env node
/**
 * Post-install / post-deploy verification.
 *
 *   node scripts/verify-install.mjs [baseUrl]
 *
 * Exits non-zero when something is wrong, so it can gate a deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

let failures = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  ✘ ${msg}`);
};

console.log(`\nVerifying webai at ${base}\n`);

// --- 1. runtime -----------------------------------------------------------
const [major, minor] = process.versions.node.split('.').map(Number);
console.log('Runtime');
if (major > 22 || (major === 22 && minor >= 5)) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node} — 22.5+ required for the node:sqlite fallback`);

// --- 2. build artifacts ---------------------------------------------------
console.log('\nBuild');
const dist = path.join(root, 'client', 'dist', 'index.html');
if (fs.existsSync(dist)) ok('client/dist/index.html exists');
else bad('client/dist missing — run: npm run build');

// --- 3. database ----------------------------------------------------------
console.log('\nDatabase');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const dbFile = process.env.SQLITE_FILE || path.join(dataDir, 'app.db');
if (fs.existsSync(dbFile)) ok(`database file at ${dbFile}`);
else bad(`no database at ${dbFile} — run: npm run seed`);
if (fs.existsSync(dataDir)) {
  const mode = fs.statSync(dataDir).mode & 0o777;
  const world = mode & 0o007;
  const groupWrite = mode & 0o020;
  if (world || groupWrite) {
    bad(`data dir permissions are too loose (mode ${mode.toString(8)}) — use chmod 750`);
  } else {
    ok(`data dir permissions are tight (mode ${mode.toString(8)})`);
  }
}

// --- 4. HTTP --------------------------------------------------------------
console.log('\nHTTP');
async function check(pathname, expectType) {
  try {
    const res = await fetch(base + pathname, { signal: AbortSignal.timeout(10000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) return bad(`GET ${pathname} -> ${res.status}`);
    if (expectType && !type.includes(expectType)) {
      return bad(`GET ${pathname} -> ${res.status} (content-type ${type || 'none'})`);
    }
    return ok(`GET ${pathname} -> ${res.status} (${type.split(';')[0]})`);
  } catch (err) {
    return bad(`GET ${pathname} -> ${err.message}`);
  }
}

await check('/api/health', 'application/json');
await check('/api/stats', 'application/json');
await check('/api/templates', 'application/json');
await check('/', 'text/html');
await check('/templates', 'text/html');

try {
  const res = await fetch(`${base}/api/projects`, { signal: AbortSignal.timeout(10000) });
  if (res.status === 401) ok('GET /api/projects without a token -> 401 (auth guard active)');
  else bad(`GET /api/projects without a token -> ${res.status} (expected 401)`);
} catch (err) {
  bad(`GET /api/projects -> ${err.message}`);
}

// --- 5. secrets -----------------------------------------------------------
console.log('\nConfiguration');
let health = null;
try {
  health = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) })).json();
} catch {
  /* already reported above */
}
if (health?.authSecret === 'default') {
  if (health?.env === 'production') {
    bad('server is still using the built-in AUTH_SECRET — set AUTH_SECRET in the environment');
  } else {
    console.log('  ! using the built-in AUTH_SECRET (fine for development)');
  }
} else if (health?.authSecret === 'custom') {
  ok('server is using a custom AUTH_SECRET');
}
if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.includes('change-me')) {
  bad('AUTH_SECRET still contains the placeholder value');
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
