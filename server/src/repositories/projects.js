import { db } from '../db/index.js';
import { id, nowIso } from '../lib/util.js';

const mapProject = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description,
  prompt: row.prompt,
  template: row.template,
  status: row.status,
  visibility: row.visibility,
  stack: row.stack,
  thumbnail: row.thumbnail,
  messagesCount: row.messages_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listProjects(userId, { limit = 50, offset = 0, search = '' } = {}) {
  const like = `%${search}%`;
  const rows = await db().query(
    `SELECT * FROM projects
      WHERE user_id = ?
        AND (? = '' OR name LIKE ? OR description LIKE ?)
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?`,
    [userId, search, like, like, limit, offset]
  );
  return rows.map(mapProject);
}

export async function countProjects(userId) {
  const row = await db().get('SELECT COUNT(*) AS c FROM projects WHERE user_id = ?', [userId]);
  return row?.c ?? 0;
}

export async function getProject(userId, projectId) {
  const row = await db().get('SELECT * FROM projects WHERE id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  return row ? mapProject(row) : null;
}

export async function createProject(userId, data = {}) {
  const project = {
    id: id('prj'),
    userId,
    name: data.name || 'Untitled project',
    description: data.description || '',
    prompt: data.prompt || '',
    template: data.template || 'react-vite',
    status: data.status || 'building',
    visibility: data.visibility || 'private',
    stack: data.stack || 'react,express,sqlite',
    thumbnail: data.thumbnail || null,
    messagesCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db().run(
    `INSERT INTO projects (id, user_id, name, description, prompt, template, status, visibility, stack, thumbnail, messages_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.userId,
      project.name,
      project.description,
      project.prompt,
      project.template,
      project.status,
      project.visibility,
      project.stack,
      project.thumbnail,
      project.messagesCount,
      project.createdAt,
      project.updatedAt,
    ]
  );
  return project;
}

const PROJECT_FIELDS = {
  name: 'name',
  description: 'description',
  prompt: 'prompt',
  template: 'template',
  status: 'status',
  visibility: 'visibility',
  stack: 'stack',
  thumbnail: 'thumbnail',
};

export async function updateProject(userId, projectId, patch = {}) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(PROJECT_FIELDS)) {
    if (patch[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }
  if (!sets.length) return getProject(userId, projectId);
  sets.push('updated_at = ?');
  params.push(nowIso(), projectId, userId);
  await db().run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
  return getProject(userId, projectId);
}

export async function deleteProject(userId, projectId) {
  const info = await db().run('DELETE FROM projects WHERE id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  return info.changes > 0;
}

/* ---------------------------------- chats --------------------------------- */

const mapChat = (row) => ({
  id: row.id,
  projectId: row.project_id,
  userId: row.user_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function createChat(userId, projectId, title = 'New chat') {
  const chat = {
    id: id('cht'),
    projectId,
    userId,
    title,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db().run(
    'INSERT INTO chats (id, project_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [chat.id, chat.projectId, chat.userId, chat.title, chat.createdAt, chat.updatedAt]
  );
  return chat;
}

export async function listChats(userId, projectId) {
  const rows = await db().query(
    'SELECT * FROM chats WHERE project_id = ? AND user_id = ? ORDER BY created_at ASC',
    [projectId, userId]
  );
  return rows.map(mapChat);
}

export async function getChat(userId, chatId) {
  const row = await db().get('SELECT * FROM chats WHERE id = ? AND user_id = ?', [chatId, userId]);
  return row ? mapChat(row) : null;
}

export async function deleteChat(userId, chatId) {
  const info = await db().run('DELETE FROM chats WHERE id = ? AND user_id = ?', [chatId, userId]);
  return info.changes > 0;
}

/* -------------------------------- messages -------------------------------- */

const mapMessage = (row) => ({
  id: row.id,
  chatId: row.chat_id,
  projectId: row.project_id,
  role: row.role,
  content: row.content,
  status: row.status,
  meta: row.meta ? JSON.parse(row.meta) : null,
  createdAt: row.created_at,
});

export async function createMessage(userId, chatId, projectId, message) {
  const row = {
    id: id('msg'),
    chatId,
    projectId,
    role: message.role,
    content: message.content,
    status: message.status || 'complete',
    meta: message.meta ? JSON.stringify(message.meta) : null,
    createdAt: nowIso(),
  };
  await db().run(
    `INSERT INTO messages (id, chat_id, project_id, role, content, status, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.chatId, row.projectId, row.role, row.content, row.status, row.meta, row.createdAt]
  );
  await db().run('UPDATE projects SET messages_count = messages_count + 1, updated_at = ? WHERE id = ?', [
    row.createdAt,
    projectId,
  ]);
  return mapMessage(row);
}

export async function listMessages(userId, chatId) {
  const rows = await db().query(
    `SELECT m.* FROM messages m
       JOIN chats c ON c.id = m.chat_id
      WHERE m.chat_id = ? AND c.user_id = ?
      ORDER BY m.created_at ASC`,
    [chatId, userId]
  );
  return rows.map(mapMessage);
}

export async function listProjectMessages(userId, projectId) {
  const rows = await db().query(
    `SELECT m.* FROM messages m
       JOIN chats c ON c.id = m.chat_id
      WHERE m.project_id = ? AND c.user_id = ?
      ORDER BY m.created_at ASC`,
    [projectId, userId]
  );
  return rows.map(mapMessage);
}

/* -------------------------------- versions -------------------------------- */

const mapVersion = (row) => ({
  id: row.id,
  projectId: row.project_id,
  label: row.label,
  summary: row.summary,
  code: row.code ? JSON.parse(row.code) : {},
  createdAt: row.created_at,
});

export async function createVersion(projectId, label, summary, code) {
  const row = {
    id: id('ver'),
    projectId,
    label,
    summary,
    code: JSON.stringify(code || {}),
    createdAt: nowIso(),
  };
  await db().run(
    'INSERT INTO versions (id, project_id, label, summary, code, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.projectId, row.label, row.summary, row.code, row.createdAt]
  );
  return mapVersion(row);
}

export async function listVersions(projectId) {
  const rows = await db().query(
    'SELECT * FROM versions WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
  return rows.map(mapVersion);
}

export async function getVersion(projectId, versionId) {
  const row = await db().get('SELECT * FROM versions WHERE id = ? AND project_id = ?', [
    versionId,
    projectId,
  ]);
  return row ? mapVersion(row) : null;
}
