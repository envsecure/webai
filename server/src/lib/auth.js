import crypto from 'node:crypto';
import config from '../config.js';
import { db } from '../db/index.js';
import { id, nowIso, randomToken, sha256 } from './util.js';

/** Create a session token for a user and persist it. */
export async function createSession(userId, userAgent = null) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + config.auth.tokenTtlSeconds * 1000).toISOString();
  await db().run(
    `INSERT INTO sessions (id, user_id, token, user_agent, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id('ses'), userId, token, userAgent, nowIso(), expiresAt]
  );
  return { token, expiresAt };
}

export async function findUserByToken(token) {
  if (!token) return null;
  const row = await db().get(
    `SELECT u.*, s.id AS session_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    [token]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db().run('DELETE FROM sessions WHERE id = ?', [row.session_id]);
    return null;
  }
  return row;
}

export async function destroySession(token) {
  await db().run('DELETE FROM sessions WHERE token = ?', [token]);
}

/** Sign a short-lived stateless token (used for API keys / share links). */
export function signValue(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', config.auth.secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyValue(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', config.auth.secret).update(body).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** Express middleware: requires a valid `Authorization: Bearer <token>`. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : req.query?.token;
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing bearer token' });
  }
  findUserByToken(token)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session' });
      }
      req.user = user;
      req.sessionToken = token;
      return next();
    })
    .catch(next);
}

/** Express middleware: optional auth, never rejects. */
export function optionalAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next();
  findUserByToken(token)
    .then((user) => {
      req.user = user;
      req.sessionToken = token;
      next();
    })
    .catch(() => next());
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    plan: user.plan,
    createdAt: user.created_at,
  };
}

export { sha256 };
