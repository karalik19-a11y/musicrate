import { Router } from 'express';
import type { AppContext } from '../context.js';

/**
 * Telegram bot diagnostics — no secrets, no auth (like /health).
 *
 * Open GET /api/telegram/status when the bot seems silent:
 *   enabled: false  → TELEGRAM_BOT_TOKEN is not set on THIS server
 *   running: false  → the token was rejected or Telegram was unreachable at boot
 *   running: true, but no answers → most likely the same token is being polled
 *                     by another process (409 conflict; check the logs)
 */
export function telegramRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    const bot = ctx.bot;
    const status = bot?.status();
    res.json({
      enabled: Boolean(bot),
      running: status?.running ?? false,
      bot: status?.username ?? null,
      webappUrl: ctx.config.telegramWebappUrl,
      subscribers: await ctx.telegram.count(),
    });
  });

  return router;
}
