import { Router } from 'express';
import { requireAuth, optionalAuth } from '../lib/auth.js';
import {
  getTemplate,
  installTemplate,
  likeCommunityProject,
  listCommunity,
  listTemplates,
} from '../repositories/catalog.js';

const router = Router();

router.get('/templates', async (req, res, next) => {
  try {
    const category = String(req.query.category || '');
    const search = String(req.query.search || '');
    const templates = await listTemplates({ category, search });
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

router.get('/templates/:templateId', async (req, res, next) => {
  try {
    const template = await getTemplate(req.params.templateId);
    if (!template) return res.status(404).json({ error: 'not_found', message: 'Template not found' });
    res.json({ template });
  } catch (err) {
    next(err);
  }
});

router.post('/templates/:templateId/install', optionalAuth, async (req, res, next) => {
  try {
    const template = await installTemplate(req.params.templateId);
    if (!template) return res.status(404).json({ error: 'not_found', message: 'Template not found' });
    res.json({ template });
  } catch (err) {
    next(err);
  }
});

router.get('/community', async (req, res, next) => {
  try {
    const search = String(req.query.search || '');
    const projects = await listCommunity({ search });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

router.post('/community/:projectId/like', optionalAuth, async (req, res, next) => {
  try {
    const project = await likeCommunityProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'not_found', message: 'Project not found' });
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

export default router;
