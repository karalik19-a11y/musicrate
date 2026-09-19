import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContext } from './context.js';

async function main() {
  const config = loadConfig();
  const ctx = await createContext(config);
  const app = createApp(ctx);

  const server = app.listen(config.port, config.host, () => {
    console.log(`[musicrate] ${config.env} server listening on http://${config.host}:${config.port}`);
    console.log(`[musicrate] data dir: ${config.dataDir}`);
    console.log(`[musicrate] database: ${config.databaseUrl.replace(/\?.*$/, '')}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[musicrate] ${signal} received, shutting down`);
    server.close(() => {
      ctx.db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[musicrate] failed to start', err);
  process.exit(1);
});
