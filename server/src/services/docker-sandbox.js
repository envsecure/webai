import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Docker backend for the preview sandbox.
 *
 * Runs one container per project, with the generated project bind-mounted at
 * /app. The image is built from deploy/sandbox.Dockerfile.
 *
 * The service falls back to the local runtime when no Docker daemon is
 * reachable, so the preview works everywhere.
 */
export const IMAGE = 'webai-sandbox:latest';

let available = null;

export async function dockerAvailable() {
  if (available !== null) return available;
  try {
    await exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 8000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export async function ensureImage(logger = console) {
  try {
    await exec('docker', ['image', 'inspect', IMAGE], { timeout: 15000 });
    return true;
  } catch {
    logger.log('[sandbox] building the docker image, this takes a minute...');
    try {
      await exec(
        'docker',
        ['build', '-t', IMAGE, '-f', 'deploy/sandbox.Dockerfile', '.'],
        { timeout: 600000 }
      );
      return true;
    } catch (err) {
      logger.error('[sandbox] docker image build failed:', err.message);
      return false;
    }
  }
}

export async function startContainer({ projectId, dir, port, runtimeDir, logger = console }) {
  const name = `webai-sandbox-${projectId}`;
  await exec('docker', ['rm', '-f', name], { timeout: 20000 }).catch(() => {});

  const args = [
    'run',
    '-d',
    '--name',
    name,
    '-p',
    `127.0.0.1:${port}:5173`,
    '-v',
    `${dir}:/app`,
    '-v',
    `${runtimeDir}:/sandbox:ro`,
    '-e',
    'SANDBOX_DIR=/app',
    '-e',
    'SANDBOX_PORT=5173',
    '-e',
    'SANDBOX_ROOT=/opt',
    '-w',
    '/app',
    IMAGE,
    'node',
    '/sandbox/runtime.js',
  ];

  const { stdout } = await exec('docker', args, { timeout: 60000 });
  logger.log('[sandbox] container started:', stdout.trim().slice(0, 12));
  return { name, cleanup: async () => exec('docker', ['rm', '-f', name], { timeout: 20000 }).catch(() => {}) };
}

export async function stopContainer(name) {
  await exec('docker', ['rm', '-f', name], { timeout: 20000 }).catch(() => {});
}
