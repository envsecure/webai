import config from './config.js';
import { initDatabase } from './db/index.js';
import { createApp } from './app.js';

async function main() {
  await initDatabase();

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`[server] listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
