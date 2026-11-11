import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { id, nowIso, randomToken, sha256 } from '../lib/util.js';

const router = Router();
router.use(requireAuth);

router.get('/settings', async (req, res, next) => {
  try {
    let row = await db().get('SELECT * FROM settings WHERE user_id = ?', [req.user.id]);
    if (!row) {
      await db().run(
        'INSERT INTO settings (user_id, theme, editor_theme, autoplay, updated_at) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, 'dark', 'dark', 1, nowIso()]
      );
      row = await db().get('SELECT * FROM settings WHERE user_id = ?', [req.user.id]);
    }
    res.json({
      settings: {
        theme: row.theme,
        editorTheme: row.editor_theme,
        autoplay: Boolean(row.autoplay),
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const current =
      (await db().get('SELECT * FROM settings WHERE user_id = ?', [req.user.id])) || {};
    const theme = req.body?.theme ?? current.theme ?? 'dark';
    const editorTheme = req.body?.editorTheme ?? current.editor_theme ?? 'dark';
    const autoplay = req.body?.autoplay === undefined ? current.autoplay ?? 1 : req.body.autoplay ? 1 : 0;
    await db().run(
      `INSERT INTO settings (user_id, theme, editor_theme, autoplay, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         theme = excluded.theme,
         editor_theme = excluded.editor_theme,
         autoplay = excluded.autoplay,
         updated_at = excluded.updated_at`,
      [req.user.id, theme, editorTheme, autoplay, nowIso()]
    );
    res.json({ settings: { theme, editorTheme, autoplay: Boolean(autoplay) } });
  } catch (err) {
    next(err);
  }
});

router.get('/api-keys', async (req, res, next) => {
  try {
    const rows = await db().query(
      'SELECT id, label, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({
      apiKeys: rows.map((r) => ({
        id: r.id,
        label: r.label,
        prefix: r.prefix,
        createdAt: r.created_at,
        lastUsedAt: r.last_used_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api-keys', async (req, res, next) => {
  try {
    const label = String(req.body?.label || 'Default key').slice(0, 80);
    const raw = `lv_live_${randomToken(16)}`;
    const keyId = id('key');
    await db().run(
      'INSERT INTO api_keys (id, user_id, label, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [keyId, req.user.id, label, sha256(raw), raw.slice(0, 12), nowIso()]
    );
    res.status(201).json({ id: keyId, label, key: raw, prefix: raw.slice(0, 12) });
  } catch (err) {
    next(err);
  }
});

router.delete('/api-keys/:keyId', async (req, res, next) => {
  try {
    const info = await db().run('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [
      req.params.keyId,
      req.user.id,
    ]);
    if (!info.changes) return res.status(404).json({ error: 'not_found', message: 'Key not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
