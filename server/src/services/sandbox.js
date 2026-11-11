import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import { materialize } from '../sandbox/materialize.js';
import {
  dockerAvailable,
  ensureImage,
  startContainer,
  stopContainer,
} from './docker-sandbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '..', 'sandbox', 'runtime.js');

/**
 * Preview sandboxes.
 *
 * Every project gets its own runtime that serves the generated app:
 *   - the generated Express routers on /api/<entity>, with their own SQLite file,
 *   - the generated React app through Vite, with hot reloading.
 *
 * Docker is used when a daemon is reachable; otherwise the same runtime runs
 * as a local child process. The preview URL is the same either way.
 */

/** projectId -> { status, port, mode, proc, container, error, startedAt } */
const sandboxes = new Map();

function sandboxDir(projectId) {
  return path.join(config.dataDir, 'sandboxes', projectId);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export function sandboxState(projectId) {
  const entry = sandboxes.get(projectId);
  if (!entry) {
    return { status: 'stopped', mode: null, port: null, error: null, url: null };
  }
  return {
    status: entry.status,
    mode: entry.mode,
    port: entry.port,
    error: entry.error,
    startedAt: entry.startedAt,
    url: entry.port ? `/api/sandbox/${projectId}/` : null,
  };
}

export async function stopSandbox(projectId) {
  const entry = sandboxes.get(projectId);
  if (!entry) return sandboxState(projectId);

  if (entry.proc && !entry.proc.killed) {
    entry.proc.kill('SIGTERM');
    setTimeout(() => {
      if (entry.proc && !entry.proc.killed) entry.proc.kill('SIGKILL');
    }, 2000).unref();
  }
  if (entry.container) await stopContainer(entry.container).catch(() => {});

  sandboxes.delete(projectId);
  return sandboxState(projectId);
}

/**
 * Write the files to disk and (re)start the runtime.
 *
 * The runtime is always restarted: Vite hot-reloads the client, but the
 * generated Express routes are imported once, so they need a fresh process.
 */
export async function syncSandbox(projectId, files, { restart = true } = {}) {
  const dir = sandboxDir(projectId);
  materialize(dir, files);
  return startSandbox(projectId, files, { reuse: restart });
}

async function startSandbox(projectId, files, { reuse = false } = {}) {
  const dir = sandboxDir(projectId);

  if (reuse) {
    const entry = sandboxes.get(projectId);
    if (entry?.proc && !entry.proc.killed) {
      entry.proc.kill('SIGTERM');
      setTimeout(() => {
        if (entry.proc && !entry.proc.killed) entry.proc.kill('SIGKILL');
      }, 1500).unref();
    }
    if (entry?.container) await stopContainer(entry.container).catch(() => {});
  }

  const port = await freePort();
  const entry = {
    status: 'starting',
    mode: 'local',
    port,
    proc: null,
    container: null,
    error: null,
    startedAt: new Date().toISOString(),
  };
  sandboxes.set(projectId, entry);

  // Docker first, if a daemon is there.
  const hasDocker = await dockerAvailable();
  if (hasDocker) {
    const built = await ensureImage();
    if (built) {
      try {
        const { name } = await startContainer({
          projectId,
          dir,
          port,
          runtimeDir: path.dirname(RUNTIME),
        });
        entry.mode = 'docker';
        entry.container = name;
        entry.status = 'running';
        return sandboxState(projectId);
      } catch (err) {
        entry.error = `docker failed: ${err.message}`;
        console.warn('[sandbox] docker start failed, using the local runtime:', err.message);
      }
    }
  }

  // Local runtime.
  try {
    const proc = spawn(process.execPath, [RUNTIME], {
      env: {
        ...process.env,
        SANDBOX_DIR: dir,
        SANDBOX_PORT: String(port),
        SANDBOX_ROOT: config.paths.root,
        SANDBOX_BASE: `/api/sandbox/${projectId}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    entry.proc = proc;
    entry.mode = 'local';

    proc.stdout.on('data', (chunk) => {
      const text = String(chunk);
      if (text.includes('listening on')) entry.status = 'running';
      console.log(`[sandbox:${projectId}] ${text.trim()}`);
    });
    proc.stderr.on('data', (chunk) => {
      const text = String(chunk);
      entry.error = text.slice(0, 400);
      console.warn(`[sandbox:${projectId}] ${text.trim()}`);
    });
    proc.on('exit', (code) => {
      const current = sandboxes.get(projectId);
      if (current?.proc === proc) {
        current.status = code === 0 ? 'stopped' : 'crashed';
        if (code !== 0) current.error = current.error || `runtime exited with code ${code}`;
      }
    });

    // Wait for the runtime to report that it is listening.
    const ready = await waitForReady(port, 20000);
    if (ready) entry.status = 'running';
    else entry.status = 'crashed';
  } catch (err) {
    entry.status = 'crashed';
    entry.error = err.message;
  }

  return sandboxState(projectId);
}

async function waitForReady(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/__sandbox/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** Remove the sandbox directory of a project. */
export function removeSandboxDir(projectId) {
  const dir = sandboxDir(projectId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** How many sandboxes may run at the same time. */
const MAX_SANDBOXES = 5;

/** Stop the oldest sandboxes when there are too many. */
async function enforceLimit() {
  const running = [...sandboxes.entries()].filter(([, s]) => s.status === 'running' || s.status === 'starting');
  if (running.length <= MAX_SANDBOXES) return;
  const excess = running
    .sort((a, b) => String(a[1].startedAt).localeCompare(String(b[1].startedAt)))
    .slice(0, running.length - MAX_SANDBOXES);
  for (const [projectId] of excess) {
    await stopSandbox(projectId).catch(() => {});
  }
}

/** Start (or restart) the sandbox for a project, using its latest version. */
export async function startSandboxFromProject(projectId) {
  const { listVersions } = await import('../repositories/projects.js');
  const versions = await listVersions(projectId);
  const files = versions[0]?.code || {};
  if (!Object.keys(files).length) {
    throw new Error('This project has no generated files yet.');
  }
  const state = await syncSandbox(projectId, files, { restart: true });
  await enforceLimit();
  return state;
}

/** Restart the sandbox so it picks up new routes. */
export async function restartViaSync(projectId) {
  return startSandboxFromProject(projectId);
}

export { sandboxDir };
