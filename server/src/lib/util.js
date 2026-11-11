import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Generate a short, sortable, unique id: `pfx_<base36 time><random>`. */
export function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Derive a readable project name from a natural-language prompt. */
export function titleFromPrompt(prompt) {
  const cleaned = String(prompt || '')
    .replace(/^(build|create|make|generate|design|develop|write)\s+(me\s+)?(an|a|the)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Untitled project';
  const words = cleaned.split(' ').slice(0, 6);
  // Drop dangling connectors so the title reads naturally.
  while (words.length > 2 && /^(and|or|with|for|to|of|in|on|that|the|a|an)$/i.test(words[words.length - 1])) {
    words.pop();
  }
  const title = words.join(' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

export { __dirname };
