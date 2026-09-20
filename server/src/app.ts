import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppContext } from './context.js';
import { errorHandler } from './lib/errors.js';
import { attachUser } from './middleware/auth.js';
import { cors } from './middleware/cors.js';
import { artistRouter } from './routes/artist.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { tracksRouter } from './routes/tracks.js';

export function createApp(ctx: AppContext): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true); // we run behind a reverse proxy in every deployment
  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA with inline styles from the design system
      crossOriginEmbedderPolicy: false,
      // `cross-origin`, not `same-site`: the audio element may be pointed at
      // this API from another origin (the static Pages build), and CORP would
      // block that media fetch before it ever reaches the CORS layer.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(express.json({ limit: '64kb' }));

  /* ---------------------------- API ---------------------------- */
  const api = express.Router();
  api.use(cors(ctx.config.allowedOrigins));
  api.use(attachUser(ctx));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.get('/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
  api.use('/auth', authRouter(ctx));
  api.use('/me', meRouter(ctx));
  api.use('/tracks', tracksRouter(ctx));
  api.use('/artist', artistRouter(ctx));
  api.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Unknown API route' }));
  app.use('/api', api);

  /* ------------------------ static client ----------------------- */
  const indexHtml = path.join(ctx.config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(ctx.config.clientDist, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders(res, filePath) {
          // hashed assets are immutable; everything else must revalidate
          if (!filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  } else if (ctx.config.env !== 'test') {
    console.warn(`[app] client build not found at ${ctx.config.clientDist} — serving API only`);
  }

  app.use(errorHandler);
  return app;
}
