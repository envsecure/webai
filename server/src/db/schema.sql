-- Lovable clone schema (SQLite dialect).
-- Porting to Postgres/MySQL later: keep column names and types equivalent;
-- the repository layer already normalises placeholders.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  template    TEXT NOT NULL DEFAULT 'react-vite',
  status      TEXT NOT NULL DEFAULT 'building',
  visibility  TEXT NOT NULL DEFAULT 'private',
  stack       TEXT NOT NULL DEFAULT 'react,express,sqlite',
  thumbnail   TEXT,
  messages_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chats (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'complete',
  meta       TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);

CREATE TABLE IF NOT EXISTS versions (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  summary    TEXT NOT NULL DEFAULT '',
  code       TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_project ON versions(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'web',
  stack       TEXT NOT NULL DEFAULT 'react,express,sqlite',
  prompt      TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '',
  installs    INTEGER NOT NULL DEFAULT 0,
  rating      REAL NOT NULL DEFAULT 4.8,
  creator     TEXT NOT NULL DEFAULT 'lovable',
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL,
  author_avatar TEXT,
  likes       INTEGER NOT NULL DEFAULT 0,
  tags        TEXT NOT NULL DEFAULT '',
  stack       TEXT NOT NULL DEFAULT 'react,express,sqlite',
  demo_url    TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  key_hash   TEXT NOT NULL,
  prefix     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme      TEXT NOT NULL DEFAULT 'dark',
  editor_theme TEXT NOT NULL DEFAULT 'dark',
  autoplay   INTEGER NOT NULL DEFAULT 1,
  -- AI model configuration (per user). llm_api_key holds an encrypted value.
  llm_provider TEXT,
  llm_model TEXT,
  llm_base_url TEXT,
  llm_api_key TEXT,
  llm_max_iterations INTEGER NOT NULL DEFAULT 12,
  llm_review_rounds INTEGER NOT NULL DEFAULT 1,
  llm_subagents INTEGER NOT NULL DEFAULT 1,
  llm_context_tokens INTEGER NOT NULL DEFAULT 24000,
  llm_capabilities TEXT,
  updated_at TEXT NOT NULL
);
