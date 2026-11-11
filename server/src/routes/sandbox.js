import { Router } from 'express';
import express from 'express';
import { Readable } from 'node:stream';
import { requireAuth } from '../lib/auth.js';
import { getProject, listVersions } from '../repositories/projects.js';
import {
  removeSandboxDir,
  restartViaSync,
  sandboxState,
  startSandboxFromProject,
  stopSandbox,
} from '../services/sandbox.js';

const router = Router();

/**
 * The preview proxy.
 *
 * The sandbox runs on its own port; this forwards the browser's requests to
 * it so the preview lives on the same origin as the app (no CORS, cookies and
 * relative API calls just work).
 *
 * The raw body is captured here, so this router must be mounted before the
 * JSON body parser.
 */
router.use(express.raw({ type: '*/*', limit: '4mb' }));

router.all('/:projectId/*', async (req, res) => {
  const projectId = req.params.projectId;

  // Without the trailing slash the relative API calls in the generated client
  // would resolve one directory up, so send the browser to the canonical path.
  if (req.originalUrl === `/api/sandbox/${projectId}`) {
    return res.redirect(302, `/api/sandbox/${projectId}/`);
  }

  const state = sandboxState(projectId);
  if (!state.port) {
    return res.status(503).json({
      error: 'sandbox_not_running',
      message: 'The preview sandbox is not running. Start it from the preview panel.',
    });
  }

  // The path is forwarded unchanged: the sandbox serves itself under the same
  // prefix (its Vite base and its API routes both include it).
  const query = req.originalUrl.includes('?')
    ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
    : '';
  const target = `http://127.0.0.1:${state.port}${req.originalUrl.split('?')[0]}${query}`;

  try {
    const headers = {};
    for (const name of ['content-type', 'accept', 'accept-language', 'user-agent']) {
      const value = req.get(name);
      if (value) headers[name] = value;
    }

    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body)) {
      init.body = req.body;
    }

    const upstream = await fetch(target, init);
    res.status(upstream.status);

    upstream.headers.forEach((value, name) => {
      if (['content-encoding', 'transfer-encoding', 'connection'].includes(name)) return;
      res.setHeader(name, value);
    });

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    res.status(502).json({ error: 'sandbox_unreachable', message: err.message });
  }
});

export default router;

/* --------------------------- management endpoints -------------------------- */

const manage = Router();
manage.use(requireAuth);

manage.get('/projects/:projectId/sandbox', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    res.json({ sandbox: sandboxState(req.params.projectId) });
  } catch (err) {
    next(err);
  }
});

manage.post('/projects/:projectId/sandbox/start', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    const state = await startSandboxFromProject(req.params.projectId);
    res.json({ sandbox: state });
  } catch (err) {
    next(err);
  }
});

manage.post('/projects/:projectId/sandbox/restart', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    const state = await restartViaSync(req.params.projectId);
    res.json({ sandbox: state });
  } catch (err) {
    next(err);
  }
});

manage.post('/projects/:projectId/sandbox/stop', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    const state = await stopSandbox(req.params.projectId);
    res.json({ sandbox: state });
  } catch (err) {
    next(err);
  }
});

export { manage };
