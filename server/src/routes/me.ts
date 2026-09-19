import { Router } from 'express';
import { z } from 'zod';
import { MAX_NAME_LENGTH } from '@shared/types';
import type { AppContext } from '../context.js';
import { parseBody } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { toUser } from '../repos/users.js';

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Введите имя').max(MAX_NAME_LENGTH),
});

export function meRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  /** Restores the profile for a stored session token (auto sign-in on reopen). */
  router.get('/', (req, res) => {
    res.json({ user: toUser(req.user!, { includeSecrets: true }) });
  });

  router.patch('/', async (req, res) => {
    const { name } = parseBody(patchSchema, req.body);
    await ctx.users.rename(req.user!.id, name);
    const fresh = await ctx.users.findById(req.user!.id);
    res.json({ user: toUser(fresh!, { includeSecrets: true }) });
  });

  return router;
}
