import { Router } from 'express';
import { z } from 'zod';
import { MAX_NAME_LENGTH, type AuthResponse } from '@shared/types';
import type { AppContext } from '../context.js';
import { normalizeRecoveryCode, safeEqual } from '../lib/crypto.js';
import { notFound, unauthorized } from '../lib/errors.js';
import { rateLimit } from '../lib/ratelimit.js';
import { parseBody } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { toUser } from '../repos/users.js';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Введите имя')
  .max(MAX_NAME_LENGTH, `Не длиннее ${MAX_NAME_LENGTH} символов`)
  .regex(/^[^\p{C}<>]+$/u, 'Недопустимые символы');

const guestSchema = z.object({ name: nameSchema });
const restoreSchema = z.object({ code: z.string().trim().min(6).max(16) });
const artistSchema = z.object({
  password: z.string().min(1).max(128),
  artistKey: z.string().min(16).max(128).optional(),
  name: nameSchema.optional(),
});

export function authRouter(ctx: AppContext): Router {
  const router = Router();
  const sensitive = rateLimit({ windowMs: 15 * 60 * 1000, max: 12 });

  /** Guest sign-up: a name is all we ask for. */
  router.post('/guest', rateLimit({ windowMs: 60 * 60 * 1000, max: 60 }), async (req, res) => {
    const { name } = parseBody(guestSchema, req.body);
    const row = await ctx.users.createGuest(name);
    const token = await ctx.sessions.create(row.id);
    const body: AuthResponse = { token, user: toUser(row, { includeSecrets: true }) };
    res.status(201).json(body);
  });

  /** Restore a guest profile on a new device using its recovery code. */
  router.post('/guest/restore', sensitive, async (req, res) => {
    const { code } = parseBody(restoreSchema, req.body);
    const row = await ctx.users.findByRecoveryCode(normalizeRecoveryCode(code));
    if (!row) throw notFound('PROFILE_NOT_FOUND', 'Профиль с таким кодом не найден');
    await ctx.users.touch(row.id);
    const token = await ctx.sessions.create(row.id);
    const body: AuthResponse = { token, user: toUser(row, { includeSecrets: true }) };
    res.json(body);
  });

  /**
   * Artist access. The shared code is verified here and only here — the client
   * never receives it. A successful login binds the session to an artist
   * identity: the one referenced by `artistKey` (same device logging in again)
   * or a brand-new one.
   */
  router.post('/artist', sensitive, async (req, res) => {
    const { password, artistKey, name } = parseBody(artistSchema, req.body);
    if (!safeEqual(password, ctx.config.artistPassword)) {
      throw unauthorized('INVALID_CODE', 'Неверный код доступа');
    }

    let row = artistKey ? await ctx.users.findArtistByKey(artistKey) : undefined;
    let issuedKey: string | undefined;
    if (!row) {
      const created = await ctx.users.createArtist(name ?? 'Artist');
      row = created.row;
      issuedKey = created.artistKey;
    } else {
      await ctx.users.touch(row.id);
    }

    const token = await ctx.sessions.create(row.id);
    const body: AuthResponse = { token, user: toUser(row), artistKey: issuedKey ?? artistKey };
    res.json(body);
  });

  router.post('/logout', requireAuth, async (req, res) => {
    if (req.token) await ctx.sessions.revoke(req.token);
    res.status(204).end();
  });

  return router;
}
