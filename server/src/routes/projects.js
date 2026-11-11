import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { db } from '../db/index.js';
import {
  countProjects,
  createChat,
  createMessage,
  createProject,
  createVersion,
  deleteChat,
  deleteProject,
  getChat,
  getProject,
  listChats,
  listMessages,
  listProjectMessages,
  listProjects,
  listVersions,
  updateProject,
} from '../repositories/projects.js';
import { getUserSettings } from '../repositories/settings.js';
import { buildProject } from '../services/build.js';
import { id, nowIso, titleFromPrompt } from '../lib/util.js';

const router = Router();
router.use(requireAuth);

/* -------------------------------- projects -------------------------------- */

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const search = String(req.query.search || '').slice(0, 120);
    const [projects, total] = await Promise.all([
      listProjects(req.user.id, { limit, offset, search }),
      countProjects(req.user.id),
    ]);
    res.json({ projects, total });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const project = await createProject(req.user.id, {
      name: req.body?.name || (prompt ? titleFromPrompt(prompt) : undefined),
      description: req.body?.description,
      prompt,
      template: req.body?.template,
      status: prompt ? 'building' : 'ready',
    });
    await createChat(req.user.id, project.id, 'Build chat');
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    const [chats, versions] = await Promise.all([
      listChats(req.user.id, project.id),
      listVersions(project.id),
    ]);
    res.json({ project, chats, versions });
  } catch (err) {
    next(err);
  }
});

router.patch('/:projectId', async (req, res, next) => {
  try {
    const project = await updateProject(req.user.id, req.params.projectId, req.body || {});
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.delete('/:projectId', async (req, res, next) => {
  try {
    const removed = await deleteProject(req.user.id, req.params.projectId);
    if (!removed) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/messages', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    const messages = await listProjectMessages(req.user.id, project.id);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

router.get('/:projectId/versions', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    res.json({ versions: await listVersions(project.id) });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- chat ---------------------------------- */

router.post('/:projectId/chat', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });

    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ error: 'invalid_prompt', message: 'Prompt cannot be empty' });
    }

    let chat = req.body?.chatId ? await getChat(req.user.id, req.body.chatId) : null;
    if (!chat) chat = await createChat(req.user.id, project.id, titleFromPrompt(prompt));

    const userMessage = await createMessage(req.user.id, chat.id, project.id, {
      role: 'user',
      content: prompt,
    });

    const settings = await getUserSettings(req.user.id);
    const result = await buildProject({
      prompt,
      project,
      userSettings: settings,
      existingFiles: await latestFiles(project.id),
    });

    const assistantMessage = await createMessage(req.user.id, chat.id, project.id, {
      role: 'assistant',
      content: result.summary,
      meta: {
        plan: result.plan,
        files: Object.keys(result.files),
        agent: {
          iterations: result.iterations,
          usage: result.usage,
          subagents: result.subagentRuns,
          reviews: result.reviews,
          context: result.context,
          provider: result.llm?.provider,
          model: result.llm?.model,
          usedFallback: result.usedFallback,
        },
      },
    });

    const version = await createVersion(
      project.id,
      `v${(await listVersions(project.id)).length + 1}`,
      result.summary,
      result.files
    );

    await updateProject(req.user.id, project.id, {
      name: project.name === 'Untitled project' ? titleFromPrompt(prompt) : project.name,
      description: result.summary,
      prompt: project.prompt || prompt,
      status: 'ready',
    });

    const messages = await listMessages(req.user.id, chat.id);
    res.status(201).json({
      chat,
      messages,
      userMessage,
      assistantMessage,
      version,
      files: result.files,
      plan: result.plan,
      agent: {
        iterations: result.iterations,
        usage: result.usage,
        subagents: result.subagentRuns,
        reviews: result.reviews,
        context: result.context,
        toolLog: result.toolLog,
        durationMs: result.durationMs,
        llm: result.llm,
        usedFallback: result.usedFallback,
        error: result.error,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Streaming variant of the chat endpoint.
 *
 * Emits newline-delimited JSON events as the agent works: plan, tool calls,
 * subagent activity, context compaction and the final result.
 */
router.post('/:projectId/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event) => {
    try {
      res.write(`${JSON.stringify(event)}\n`);
    } catch {
      /* client disconnected */
    }
  };

  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) {
      send({ type: 'error', message: 'Project not found' });
      return res.end();
    }
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      send({ type: 'error', message: 'Prompt cannot be empty' });
      return res.end();
    }

    let chat = req.body?.chatId ? await getChat(req.user.id, req.body.chatId) : null;
    if (!chat) chat = await createChat(req.user.id, project.id, titleFromPrompt(prompt));

    await createMessage(req.user.id, chat.id, project.id, { role: 'user', content: prompt });
    send({ type: 'user_message', chatId: chat.id });

    const settings = await getUserSettings(req.user.id);
    const result = await buildProject({
      prompt,
      project,
      userSettings: settings,
      existingFiles: await latestFiles(project.id),
      onEvent: (event) => send({ type: 'agent_event', event }),
    });

    const assistantMessage = await createMessage(req.user.id, chat.id, project.id, {
      role: 'assistant',
      content: result.summary,
      meta: {
        plan: result.plan,
        files: Object.keys(result.files),
        agent: {
          iterations: result.iterations,
          usage: result.usage,
          subagents: result.subagentRuns,
          reviews: result.reviews,
          provider: result.llm?.provider,
          model: result.llm?.model,
          usedFallback: result.usedFallback,
        },
      },
    });

    const version = await createVersion(
      project.id,
      `v${(await listVersions(project.id)).length + 1}`,
      result.summary,
      result.files
    );

    await updateProject(req.user.id, project.id, {
      name: project.name === 'Untitled project' ? titleFromPrompt(prompt) : project.name,
      description: result.summary,
      status: 'ready',
    });

    send({
      type: 'result',
      chatId: chat.id,
      summary: result.summary,
      plan: result.plan,
      files: result.files,
      version,
      message: assistantMessage,
      agent: {
        iterations: result.iterations,
        usage: result.usage,
        subagents: result.subagentRuns,
        reviews: result.reviews,
        context: result.context,
        llm: result.llm,
        usedFallback: result.usedFallback,
        error: result.error,
      },
    });
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

/** The files of the most recent version, used as the starting point. */
async function latestFiles(projectId) {
  const versions = await listVersions(projectId);
  return versions[0]?.code || {};
}

/* -------------------------------- versions -------------------------------- */

router.get('/:projectId/versions/:versionId', async (req, res, next) => {
  try {
    const project = await getProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    const versions = await listVersions(project.id);
    const version = versions.find((v) => v.id === req.params.versionId);
    if (!version) return res.status(404).json({ error: 'not_found', message: 'Version not found' });
    res.json({ version });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- quick build ------------------------------ */

router.post('/quick-build', async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ error: 'invalid_prompt', message: 'Prompt cannot be empty' });
    }
    const project = await createProject(req.user.id, {
      name: titleFromPrompt(prompt),
      prompt,
      status: 'building',
    });
    const chat = await createChat(req.user.id, project.id, 'Build chat');
    await createMessage(req.user.id, chat.id, project.id, { role: 'user', content: prompt });

    const settings = await getUserSettings(req.user.id);
    const result = await buildProject({
      prompt,
      project,
      userSettings: settings,
    });

    await createMessage(req.user.id, chat.id, project.id, {
      role: 'assistant',
      content: result.summary,
      meta: {
        plan: result.plan,
        files: Object.keys(result.files),
        agent: {
          iterations: result.iterations,
          usage: result.usage,
          subagents: result.subagentRuns,
          reviews: result.reviews,
          provider: result.llm?.provider,
          model: result.llm?.model,
          usedFallback: result.usedFallback,
        },
      },
    });
    await createVersion(project.id, 'v1', result.summary, result.files);
    await updateProject(req.user.id, project.id, {
      description: result.summary,
      status: 'ready',
    });

    const updated = await getProject(req.user.id, project.id);
    res.status(201).json({
      project: updated,
      chat,
      files: result.files,
      plan: result.plan,
      agent: {
        iterations: result.iterations,
        usage: result.usage,
        subagents: result.subagentRuns,
        reviews: result.reviews,
        context: result.context,
        llm: result.llm,
        usedFallback: result.usedFallback,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
