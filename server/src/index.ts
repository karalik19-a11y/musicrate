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
    if (ctx.bot) {
      // Long-polls Telegram in the background. Never fatal: a bad token or an
      // unreachable api.telegram.org only disables the bot, not the API.
      void ctx.bot.start().catch((err) => console.error('[telegram] failed to start:', err));
    }
  });

  const shutdown = (signal: string) => {
    console.log(`[musicrate] ${signal} received, shutting down`);
    void (async () => {
      try {
        await ctx.bot?.stop();
      } catch {
        /* best effort */
      }
      server.close(() => {
        ctx.db.close();
        process.exit(0);
      });
    })();
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[musicrate] failed to start', err);
  process.exit(1);
});
