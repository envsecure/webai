#!/usr/bin/env node
/**
 * Tunnel supervisor.
 *
 * Keeps a Cloudflare quick tunnel alive and records the current public URL so
 * the app can show it. A quick tunnel's hostname changes whenever the tunnel
 * restarts, which is why the URL is written to a file the server reads.
 *
 *   node scripts/tunnel-supervisor.mjs [port]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 3001);
const URL_FILE = path.join(root, 'data', 'tunnel-url.txt');

fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });

let child = null;
let restarts = 0;
let stopping = false;

function writeUrl(url) {
  fs.writeFileSync(URL_FILE, `${url}\n`);
  console.log(`[tunnel] public url: ${url}`);
}

function clearUrl(reason) {
  try {
    if (fs.existsSync(URL_FILE)) fs.unlinkSync(URL_FILE);
  } catch {
    /* ignore */
  }
  console.log(`[tunnel] ${reason}`);
}

function start() {
  child = spawn(
    'cloudflared',
    ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const onLine = (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) writeUrl(match[0]);
  };

  child.stdout.on('data', onLine);
  child.stderr.on('data', onLine);

  child.on('exit', (code) => {
    child = null;
    if (stopping) return;
    restarts += 1;
    clearUrl(`tunnel exited (code ${code}), restarting in 3s`);
    setTimeout(start, 3000);
  });
}

start();

// Print the current URL whenever the file is asked for.
console.log(`[tunnel] supervising http://127.0.0.1:${PORT}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    clearUrl('tunnel stopped');
    if (child) child.kill('SIGTERM');
    process.exit(0);
  });
}
