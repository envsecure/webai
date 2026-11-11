import config from '../config.js';

/**
 * Postgres driver seam (used when `DB_DRIVER=postgres`).
 *
 * The repository/route layer never talks to a concrete driver: it only uses
 * `query` / `get` / `run` / `tx` and `?` placeholders. Switching SQLite ->
 * Postgres is therefore a config change plus `npm i pg`.
 *
 * Placeholder translation: `?` -> `$1, $2, ...` (Postgres) or `:name` (MySQL).
 */
async function createPostgresDriver() {
  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    throw new Error(
      'DB_DRIVER=postgres requires the "pg" package. Run: npm --workspace server install pg'
    );
  }

  const client = new pg.Client({ connectionString: config.db.postgres.url });
  await client.connect();

  const toDollar = (sql) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  };

  return {
    name: 'postgres',
    flavour: 'pg',
    query: async (sql, params = []) => (await client.query(toDollar(sql), params)).rows,
    get: async (sql, params = []) => (await client.query(toDollar(sql), params)).rows[0] ?? null,
    run: async (sql, params = []) => {
      const res = await client.query(toDollar(sql), params);
      return { changes: res.rowCount, lastInsertRowid: res.rowCount };
    },
    exec: async (sql) => client.query(sql),
    tx: async (fn) => {
      await client.query('BEGIN');
      try {
        const result = await fn();
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    },
    close: async () => client.end(),
  };
}

export default createPostgresDriver;
