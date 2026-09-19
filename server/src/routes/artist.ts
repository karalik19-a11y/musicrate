import { Router } from 'express';
import type { AppContext } from '../context.js';
import { requireRole } from '../middleware/auth.js';

export function artistRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireRole('artist'));

  /** The artist's own catalogue, with public ratings and play counts. */
  router.get('/tracks', async (req, res) => {
    const viewer = { id: req.user!.id };
    const tracks = await ctx.tracks.list(viewer, { artistId: viewer.id, sort: 'new' });
    res.json({ tracks });
  });

  router.get('/overview', async (req, res) => {
    const overview = await ctx.tracks.artistOverview(req.user!.id);
    res.json({ overview });
  });

  return router;
}
