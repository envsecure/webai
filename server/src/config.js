import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootDir = path.resolve(__dirname, '..', '..');

/** Built-in fallback secret. Overridden by AUTH_SECRET in any real deployment. */
export const DEFAULT_AUTH_SECRET = 'lovable-clone-dev-secret-change-me';

export const config = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Storage
  dataDir: process.env.DATA_DIR || path.join(rootDir, 'data'),

  // Database. `driver` selects the SQL backend. The repository layer in
  // src/db is driver agnostic so switching to Postgres/MySQL later only
  // requires a new driver + schema file (no route or service changes).
  db: {
    driver: process.env.DB_DRIVER || 'sqlite',
    sqlite: {
      file: process.env.SQLITE_FILE || path.join(process.env.DATA_DIR || path.join(rootDir, 'data'), 'app.db'),
    },
    postgres: {
      url: process.env.DATABASE_URL || 'postgres://localhost:5432/lovable_clone',
    },
  },

  auth: {
    // Demo secret. Override with AUTH_SECRET in production.
    secret: process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET,
    tokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL || 60 * 60 * 24 * 30),
  },

  paths: {
    root: rootDir,
    server: __dirname,
    clientDist: path.join(rootDir, 'client', 'dist'),
  },
};

export default config;
