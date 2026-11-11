import { Router } from 'express';
import { db } from '../db/index.js';
import { createSession, destroySession, publicUser, requireAuth } from '../lib/auth.js';
import { hashPassword, id, nowIso, verifyPassword } from '../lib/util.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || email.split('@')[0];

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'invalid_email', message: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: 'weak_password', message: 'Password must be at least 8 characters' });
    }

    const existing = await db().get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res
        .status(409)
        .json({ error: 'email_taken', message: 'An account with that email already exists' });
    }

    const user = {
      id: id('usr'),
      email,
      name,
      passwordHash: hashPassword(password),
      plan: 'free',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db().run(
      `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.email, user.name, user.passwordHash, user.plan, user.createdAt, user.updatedAt]
    );
    await db().run(
      'INSERT INTO settings (user_id, theme, editor_theme, autoplay, updated_at) VALUES (?, ?, ?, ?, ?)',
      [user.id, 'dark', 'dark', 1, nowIso()]
    );

    const session = await createSession(user.id, req.get('user-agent'));
    res.status(201).json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await db().get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Wrong email or password' });
    }

    const session = await createSession(user.id, req.get('user-agent'));
    res.json({ token: session.token, expiresAt: session.expiresAt, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await destroySession(req.sessionToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const name = req.body?.name !== undefined ? String(req.body.name).slice(0, 120) : req.user.name;
    const avatarUrl =
      req.body?.avatarUrl !== undefined ? String(req.body.avatarUrl).slice(0, 500) : req.user.avatar_url;
    await db().run('UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?', [
      name,
      avatarUrl,
      nowIso(),
      req.user.id,
    ]);
    const user = await db().get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
