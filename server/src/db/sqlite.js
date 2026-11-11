import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SQLite driver.
 *
 * Uses `better-sqlite3` when available and falls back to the built-in
 * `node:sqlite` module (Node >= 22.5). Both are synchronous, which keeps the
 * repository layer identical to the later Postgres driver.
 */
async function createSqliteDriver() {
  const file = config.db.sqlite.file;
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let Database;
  let flavour = 'better-sqlite3';
  try {
    ({ default: Database } = await import('better-sqlite3'));
  } catch {
    const nodeSqlite = await import('node:sqlite');
    Database = nodeSqlite.DatabaseSync;
    flavour = 'node:sqlite';
  }

  const db = new Database(file);
  db.pragma?.('journal_mode = WAL');
  db.pragma?.('foreign_keys = ON');

  const all = (sql, params = []) =>
    flavour === 'better-sqlite3' ? db.prepare(sql).all(params) : db.prepare(sql).all(...params);
  const get = (sql, params = []) =>
    flavour === 'better-sqlite3' ? db.prepare(sql).get(params) : db.prepare(sql).get(...params);
  const run = (sql, params = []) => {
    if (flavour === 'better-sqlite3') {
      const info = db.prepare(sql).run(params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
    const info = db.prepare(sql).run(...params);
    return { changes: Number(info.changes ?? 0), lastInsertRowid: Number(info.lastInsertRowid ?? 0) };
  };

  return {
    name: 'sqlite',
    flavour,
    file,
    query: async (sql, params) => all(sql, params),
    get: async (sql, params) => get(sql, params) ?? null,
    run: async (sql, params) => run(sql, params),
    exec: async (sql) => db.exec(sql),
    tx: async (fn) => {
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    close: async () => db.close(),
  };
}

export default createSqliteDriver;
export { __dirname };
