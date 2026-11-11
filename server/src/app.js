import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { db } from './db/index.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import catalogRoutes from './routes/catalog.js';
import settingsRoutes from './routes/settings.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: db().name, env: config.nodeEnv, uptime: process.uptime() });
  });

  app.get('/api/stats', async (_req, res, next) => {
    try {
      const projects = await db().get('SELECT COUNT(*) AS c FROM projects');
      const users = await db().get('SELECT COUNT(*) AS c FROM users');
      res.json({
        projectsBuilt: 1200000,
        monthlyVisits: 60000000,
        agentsConnected: 900000000,
        database: { projects: projects?.c ?? 0, users: users?.c ?? 0 },
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', settingsRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Unknown API endpoint' });
  });

  // Static client build (production). In dev, Vite serves the client.
  const distDir = config.paths.clientDist;
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[api] error:', err);
    res.status(err.status || 500).json({
      error: err.code || 'internal_error',
      message: err.message || 'Something went wrong',
    });
  });

  return app;
}

export default createApp;
