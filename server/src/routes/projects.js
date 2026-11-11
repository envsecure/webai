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
import { generateApp, buildPlan, detectAppType, titleFrom } from '../services/generator.js';
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
    const project = await createProject(req.user.id, {
      name: req.body?.name,
      description: req.body?.description,
      prompt: req.body?.prompt,
      template: req.body?.template,
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

    const appType = detectAppType(prompt);
    const plan = buildPlan(appType, prompt);
    const generated = generateApp(prompt);

    const assistantMessage = await createMessage(req.user.id, chat.id, project.id, {
      role: 'assistant',
      content: generated.summary,
      meta: { plan, files: Object.keys(generated.files), appType: generated.appType },
    });

    const version = await createVersion(
      project.id,
      `v${(await listVersions(project.id)).length + 1}`,
      generated.summary,
      generated.files
    );

    await updateProject(req.user.id, project.id, {
      name: project.name === 'Untitled project' ? titleFromPrompt(prompt) : project.name,
      description: generated.summary,
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
      files: generated.files,
      plan,
    });
  } catch (err) {
    next(err);
  }
});

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

    const generated = generateApp(prompt);
    await createMessage(req.user.id, chat.id, project.id, {
      role: 'assistant',
      content: generated.summary,
      meta: { plan: generated.plan, files: Object.keys(generated.files), appType: generated.appType },
    });
    await createVersion(project.id, 'v1', generated.summary, generated.files);
    await updateProject(req.user.id, project.id, {
      description: generated.summary,
      status: 'ready',
    });

    const updated = await getProject(req.user.id, project.id);
    res.status(201).json({ project: updated, chat, files: generated.files, plan: generated.plan });
  } catch (err) {
    next(err);
  }
});

export default router;
