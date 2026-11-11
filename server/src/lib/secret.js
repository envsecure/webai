import crypto from 'node:crypto';
import config from '../config.js';

const ALGO = 'aes-256-gcm';

function key() {
  return crypto.scryptSync(config.auth.secret, 'webai-secret-v1', 32);
}

/** Encrypt a user-supplied secret for storage in the database. */
export function encryptSecret(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Decrypt a stored secret. Returns null when absent or tampered with. */
export function decryptSecret(stored) {
  if (!stored) return null;
  if (!String(stored).startsWith('v1:')) return null; // plaintext from an older row
  try {
    const [, iv, tag, data] = String(stored).split(':');
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Mask a key for display: keeps the prefix, hides the rest. */
export function maskSecret(value) {
  if (!value) return null;
  const text = String(value);
  if (text.length <= 10) return `${text.slice(0, 2)}…`;
  return `${text.slice(0, 8)}…${text.slice(-4)}`;
}
