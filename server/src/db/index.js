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
