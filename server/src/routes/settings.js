import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { db } from '../db/index.js';
import { encryptSecret, maskSecret } from '../lib/secret.js';
import { getUserSettings, publicSettings, updateUserSettings } from '../repositories/settings.js';
import {
  describeLlm,
  detectModel,
  listModels,
  listProviders,
  listSubagents,
  resolveLlmSettings,
} from '../services/llm/index.js';
import { id, nowIso, randomToken, sha256 } from '../lib/util.js';

const router = Router();
router.use(requireAuth);

router.get('/settings', async (req, res, next) => {
  try {
    const row = await getUserSettings(req.user.id);
    const resolved = resolveLlmSettings(row);
    res.json({
      settings: publicSettings(row),
      llm: describeLlm(resolved),
      providers: listProviders(),
      subagents: listSubagents(),
      needsSetup: !resolved.configured || !resolved.provider,
      environment: {
        providerFromEnv: Boolean(process.env.LLM_PROVIDER),
        keyFromEnv: Boolean(
          process.env.OPENAI_API_KEY ||
            process.env.ANTHROPIC_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            process.env.GROQ_API_KEY ||
            process.env.TOGETHER_API_KEY ||
            process.env.LLM_API_KEY
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Detect what an endpoint supports: the model catalogue, the context window
 * and whether tool calling works. Nothing is stored until the user saves.
 */
router.post('/settings/detect-model', async (req, res, next) => {
  try {
    const body = req.body || {};
    const provider = body.provider || 'compatible';
    const baseUrl = body.baseUrl || null;
    const apiKey = body.apiKey || null;
    const model = body.model || null;

    if (!baseUrl) {
      return res.status(400).json({ ok: false, message: 'Enter the base URL of your endpoint.' });
    }

    const result = await detectModel({ provider, baseUrl, apiKey, model });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
});

/** Just the model catalogue, for the dropdown. */
router.post('/settings/list-models', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await listModels({
      provider: body.provider || 'compatible',
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, models: [], message: err.message });
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};

    if (body.theme !== undefined) patch.theme = body.theme;
    if (body.editorTheme !== undefined) patch.editor_theme = body.editorTheme;
    if (body.autoplay !== undefined) patch.autoplay = body.autoplay ? 1 : 0;

    if (body.llm !== undefined && typeof body.llm === 'object') {
      const llm = body.llm;
      if (llm.provider !== undefined) patch.llm_provider = llm.provider || null;
      if (llm.model !== undefined) patch.llm_model = llm.model || null;
      if (llm.baseUrl !== undefined) patch.llm_base_url = llm.baseUrl || null;
      if (llm.maxIterations !== undefined) patch.llm_max_iterations = Number(llm.maxIterations) || 12;
      if (llm.reviewRounds !== undefined) patch.llm_review_rounds = Number(llm.reviewRounds) || 0;
      if (llm.subagents !== undefined) patch.llm_subagents = llm.subagents ? 1 : 0;
      if (llm.contextTokens !== undefined) patch.llm_context_tokens = Number(llm.contextTokens) || 24000;
      if (llm.capabilities !== undefined) {
        patch.llm_capabilities = llm.capabilities ? JSON.stringify(llm.capabilities) : null;
      }
      // An empty string clears the stored key.
      if (llm.apiKey !== undefined) {
        patch.llm_api_key = llm.apiKey ? encryptSecret(llm.apiKey) : null;
      }
    }

    const row = await updateUserSettings(req.user.id, patch);
    const resolved = resolveLlmSettings(row);
    res.json({ settings: publicSettings(row), llm: describeLlm(resolved) });
  } catch (err) {
    next(err);
  }
});

/** Connectivity check for the configured model. */
router.post('/settings/test-llm', async (req, res, next) => {
  try {
    const row = await getUserSettings(req.user.id);
    const resolved = resolveLlmSettings(row);

    if (!resolved.configured || !resolved.provider) {
      return res.status(409).json({
        ok: false,
        code: 'no_model_configured',
        message: 'No model is connected yet. Add your API endpoint first.',
      });
    }

    const { createClient } = await import('../services/llm/index.js');
    const client = createClient(resolved);
    const res2 = await client.complete('Reply with the single word: ok', {
      maxTokens: 16,
      temperature: 0,
    });
    res.json({
      ok: true,
      provider: resolved.provider,
      model: resolved.model,
      reply: (res2.text || '').slice(0, 120),
    });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
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
    res.status(201).json({ id: keyId, label, key: raw, prefix: raw.slice(0, 12), masked: maskSecret(raw) });
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
