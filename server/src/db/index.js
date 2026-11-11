import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import createSqliteDriver from './sqlite.js';
import createPostgresDriver from './postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const drivers = {
  sqlite: createSqliteDriver,
  postgres: createPostgresDriver,
};

/** Thin, driver-agnostic database facade used by every repository. */
class Database {
  constructor(driver) {
    this.driver = driver;
    this.name = driver.name;
  }

  /** Run a SELECT that returns many rows. */
  query(sql, params = []) {
    return this.driver.query(sql, params);
  }

  /** Run a SELECT that returns at most one row. */
  async get(sql, params = []) {
    return this.driver.get(sql, params);
  }

  /** Run an INSERT/UPDATE/DELETE. */
  run(sql, params = []) {
    return this.driver.run(sql, params);
  }

  /** Run raw DDL / multi-statement scripts. */
  exec(sql) {
    return this.driver.exec(sql);
  }

  /** Execute `fn` inside a transaction. */
  tx(fn) {
    return this.driver.tx(fn);
  }

  close() {
    return this.driver.close();
  }
}

let instance = null;

/**
 * Additive column migrations for SQLite.
 *
 * `CREATE TABLE IF NOT EXISTS` does not touch existing tables, so new columns
 * are added here. Each entry is applied once and is safe to re-run.
 */
const COLUMN_MIGRATIONS = [
  {
    table: 'settings',
    columns: {
      llm_provider: 'TEXT',
      llm_model: 'TEXT',
      llm_base_url: 'TEXT',
      llm_api_key: 'TEXT',
      llm_max_iterations: 'INTEGER NOT NULL DEFAULT 12',
      llm_review_rounds: 'INTEGER NOT NULL DEFAULT 1',
      llm_subagents: 'INTEGER NOT NULL DEFAULT 1',
      llm_context_tokens: 'INTEGER NOT NULL DEFAULT 24000',
      llm_capabilities: 'TEXT',
    },
  },
];

async function applyMigrations(driver) {
  if (driver.name !== 'sqlite') return;
  for (const migration of COLUMN_MIGRATIONS) {
    let existing = [];
    try {
      existing = await driver.query(`PRAGMA table_info(${migration.table})`);
    } catch {
      continue; // table does not exist yet
    }
    const names = new Set(existing.map((c) => c.name));
    for (const [column, type] of Object.entries(migration.columns)) {
      if (names.has(column)) continue;
      await driver.exec(
        `ALTER TABLE ${migration.table} ADD COLUMN ${column} ${type}`
      );
    }
  }
}

export async function initDatabase({ silent = false } = {}) {
  if (instance) return instance;

  const driverName = config.db.driver;
  const factory = drivers[driverName];
  if (!factory) {
    throw new Error(`Unknown DB_DRIVER "${driverName}". Available: ${Object.keys(drivers).join(', ')}`);
  }

  const driver = await factory();
  instance = new Database(driver);

  if (driverName === 'sqlite') {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await driver.exec(schema);
  }
  await applyMigrations(driver);

  if (!silent) {
    console.log(`[db] driver=${driver.name} (${driver.flavour}) ready`);
  }
  return instance;
}

export function db() {
  if (!instance) throw new Error('Database not initialised. Call initDatabase() first.');
  return instance;
}

export default db;
