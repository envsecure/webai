import { db } from '../db/index.js';
import { nowIso } from '../lib/util.js';

/** Columns of the per-user settings row that the app understands. */
const FIELDS = [
  'theme',
  'editor_theme',
  'autoplay',
  'llm_provider',
  'llm_model',
  'llm_base_url',
  'llm_api_key',
  'llm_max_iterations',
  'llm_review_rounds',
  'llm_subagents',
  'llm_context_tokens',
];

export async function getUserSettings(userId) {
  let row = await db().get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  if (!row) {
    await db().run(
      `INSERT INTO settings (user_id, theme, editor_theme, autoplay, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, 'light', 'dark', 1, nowIso()]
    );
    row = await db().get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  }
  return row;
}

export async function updateUserSettings(userId, patch = {}) {
  const current = await getUserSettings(userId);
  const next = { ...current };

  for (const field of FIELDS) {
    if (patch[field] === undefined) continue;
    next[field] = patch[field];
  }

  const columnList = ['user_id', ...FIELDS, 'updated_at'].join(', ');
  const placeholders = ['?', ...FIELDS.map(() => '?'), '?'].join(', ');
  const values = [userId, ...FIELDS.map((f) => next[f]), nowIso()];

  await db().run(
    `INSERT INTO settings (${columnList})
     VALUES (${placeholders})
     ON CONFLICT(user_id) DO UPDATE SET
       ${FIELDS.map((f) => `${f} = excluded.${f}`).join(', ')},
       updated_at = excluded.updated_at`,
    values
  );

  return getUserSettings(userId);
}

/** Shape sent to the client: no secrets, everything camel-cased. */
export function publicSettings(row) {
  return {
    theme: row.theme,
    editorTheme: row.editor_theme,
    autoplay: Boolean(row.autoplay),
    llm: {
      provider: row.llm_provider,
      model: row.llm_model,
      baseUrl: row.llm_base_url,
      hasApiKey: Boolean(row.llm_api_key),
      maxIterations: row.llm_max_iterations,
      reviewRounds: row.llm_review_rounds,
      subagents: Boolean(row.llm_subagents),
      contextTokens: row.llm_context_tokens,
    },
    updatedAt: row.updated_at,
  };
}
