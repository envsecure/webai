import { db } from '../db/index.js';
import { id, nowIso } from '../lib/util.js';

const mapTemplate = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  stack: row.stack,
  prompt: row.prompt,
  tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
  installs: row.installs,
  rating: row.rating,
  creator: row.creator,
  verified: Boolean(row.verified),
  createdAt: row.created_at,
});

export async function listTemplates({ category, search = '', limit = 100 } = {}) {
  const like = `%${search}%`;
  const rows = await db().query(
    `SELECT * FROM templates
      WHERE (? = '' OR category = ?)
        AND (? = '' OR name LIKE ? OR description LIKE ? OR tags LIKE ?)
      ORDER BY installs DESC
      LIMIT ?`,
    [category || '', category || '', search, like, like, like, limit]
  );
  return rows.map(mapTemplate);
}

export async function getTemplate(templateId) {
  const row = await db().get('SELECT * FROM templates WHERE id = ?', [templateId]);
  return row ? mapTemplate(row) : null;
}

export async function installTemplate(templateId) {
  await db().run('UPDATE templates SET installs = installs + 1 WHERE id = ?', [templateId]);
  return getTemplate(templateId);
}

export async function upsertTemplate(template) {
  await db().run(
    `INSERT INTO templates (id, name, description, category, stack, prompt, tags, installs, rating, creator, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       category = excluded.category,
       stack = excluded.stack,
       prompt = excluded.prompt,
       tags = excluded.tags,
       rating = excluded.rating,
       creator = excluded.creator,
       verified = excluded.verified`,
    [
      template.id,
      template.name,
      template.description,
      template.category,
      template.stack,
      template.prompt,
      template.tags,
      template.installs ?? 0,
      template.rating ?? 4.8,
      template.creator ?? 'lovable',
      template.verified ? 1 : 0,
      template.createdAt ?? nowIso(),
    ]
  );
  return getTemplate(template.id);
}

const mapCommunity = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  author: row.author,
  authorAvatar: row.author_avatar,
  likes: row.likes,
  tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
  stack: row.stack,
  demoUrl: row.demo_url,
  createdAt: row.created_at,
});

export async function listCommunity({ search = '', limit = 100 } = {}) {
  const like = `%${search}%`;
  const rows = await db().query(
    `SELECT * FROM community_projects
      WHERE (? = '' OR title LIKE ? OR description LIKE ? OR tags LIKE ?)
      ORDER BY likes DESC
      LIMIT ?`,
    [search, like, like, like, limit]
  );
  return rows.map(mapCommunity);
}

export async function upsertCommunityProject(project) {
  await db().run(
    `INSERT INTO community_projects (id, title, description, author, author_avatar, likes, tags, stack, demo_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       likes = excluded.likes,
       tags = excluded.tags`,
    [
      project.id,
      project.title,
      project.description,
      project.author,
      project.authorAvatar ?? null,
      project.likes ?? 0,
      project.tags ?? '',
      project.stack ?? 'react,express,sqlite',
      project.demoUrl ?? null,
      project.createdAt ?? nowIso(),
    ]
  );
  return listCommunity({});
}

export async function likeCommunityProject(projectId) {
  await db().run('UPDATE community_projects SET likes = likes + 1 WHERE id = ?', [projectId]);
  const row = await db().get('SELECT * FROM community_projects WHERE id = ?', [projectId]);
  return row ? mapCommunity(row) : null;
}

export { id };
