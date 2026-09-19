import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request } from 'express';
import multer from 'multer';
import { parseFile } from 'music-metadata';
import { z } from 'zod';
import {
  ACCEPTED_AUDIO_EXTENSIONS,
  AUDIO_TYPES,
  MAX_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  RATING_COMPONENT_MAX,
  type TrackSort,
} from '@shared/types';
import type { AppContext } from '../context.js';
import { publicId } from '../lib/crypto.js';
import { badRequest, forbidden, gone, notFound } from '../lib/errors.js';
import { param, parseBody } from '../lib/validate.js';
import { fallbackWaveform, sanitizeWaveform } from '../lib/waveform.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const score = z.number().int().min(0).max(RATING_COMPONENT_MAX);
const ratingSchema = z.object({ quality: score, listenability: score, personal: score });

const uploadSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(MAX_TITLE_LENGTH),
  artistName: z.string().trim().min(1, 'Введите имя музыканта').max(MAX_NAME_LENGTH),
  duration: z.coerce.number().min(0).max(24 * 60 * 60).optional(),
  waveform: z.string().max(8192).optional(),
});

const SORTS: TrackSort[] = ['new', 'top', 'played'];

function extensionOf(filename: string): string {
  return path.extname(filename).slice(1).toLowerCase();
}

export function tracksRouter(ctx: AppContext): Router {
  const router = Router();

  fs.mkdirSync(ctx.uploadTmpDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        // re-create on every upload: temp dirs get wiped by ops/cron more often than you'd think
        fs.mkdirSync(ctx.uploadTmpDir, { recursive: true });
        cb(null, ctx.uploadTmpDir);
      },
      filename: (_req, file, cb) => cb(null, `${publicId()}.${extensionOf(file.originalname) || 'bin'}`),
    }),
    limits: { fileSize: ctx.config.maxUploadBytes, files: 1, fields: 8 },
    fileFilter: (_req, file, cb) => {
      const ext = extensionOf(file.originalname);
      if (!ACCEPTED_AUDIO_EXTENSIONS.includes(ext)) {
        cb(badRequest('UNSUPPORTED_FORMAT', 'Поддерживаются MP3, WAV, M4A, AAC и FLAC'));
        return;
      }
      cb(null, true);
    },
  });

  /* ------------------------------------------------------------------ */
  /* Public (inside the app): anybody with a valid session               */
  /* ------------------------------------------------------------------ */

  router.get('/', requireAuth, async (req, res) => {
    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : 'new';
    const sort = (SORTS as string[]).includes(sortParam) ? (sortParam as TrackSort) : 'new';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    const tracks = await ctx.tracks.list({ id: req.user!.id }, { sort, query: query || undefined });
    res.json({ tracks });
  });

  router.get('/:id', requireAuth, async (req, res) => {
    const found = await ctx.tracks.findAny(param(req, 'id'), { id: req.user!.id });
    if (!found) throw notFound('TRACK_NOT_FOUND', 'Трек не найден');
    if (found.deleted) throw gone('TRACK_DELETED', 'Трек был удалён артистом');
    res.json({ track: found.track });
  });

  /**
   * Audio stream. Intentionally does not require the bearer header: the
   * <audio> element cannot send one. Track ids are unguessable, and deleted
   * tracks stop streaming immediately (410).
   */
  router.get('/:id/audio', async (req, res) => {
    const info = await ctx.tracks.fileInfo(param(req, 'id'));
    if (!info) throw notFound('TRACK_NOT_FOUND', 'Трек не найден');
    if (info.deleted_at != null) throw gone('TRACK_DELETED', 'Трек был удалён артистом');
    await ctx.storage.send(info.file_key, info.mime_type, res);
  });

  router.post('/:id/play', requireAuth, async (req, res) => {
    const found = await ctx.tracks.findAny(param(req, 'id'), { id: req.user!.id });
    if (!found || found.deleted) throw gone('TRACK_DELETED', 'Трек больше недоступен');
    const counted = await ctx.tracks.recordPlay(found.track.id, req.user!.id);
    res.json({ counted, plays: found.track.plays + (counted ? 1 : 0) });
  });

  /* ------------------------------------------------------------------ */
  /* Guests: rating                                                      */
  /* ------------------------------------------------------------------ */

  router.put('/:id/rating', requireRole('guest'), async (req, res) => {
    const rating = parseBody(ratingSchema, req.body);
    const viewer = { id: req.user!.id };
    const found = await ctx.tracks.findAny(param(req, 'id'), viewer);
    if (!found || found.deleted) throw gone('TRACK_DELETED', 'Трек больше недоступен');
    await ctx.tracks.upsertRating(found.track.id, viewer.id, rating);
    const updated = await ctx.tracks.findAny(found.track.id, viewer);
    res.json({ track: updated!.track });
  });

  /* ------------------------------------------------------------------ */
  /* Artists: publish & delete                                           */
  /* ------------------------------------------------------------------ */

  router.post('/', requireRole('artist'), upload.single('audio'), async (req: Request, res) => {
    const file = req.file;
    if (!file) throw badRequest('NO_FILE', 'Прикрепите аудиофайл');

    const cleanup = () => fsp.rm(file.path, { force: true });
    try {
      const fields = parseBody(uploadSchema, req.body);
      const ext = extensionOf(file.originalname);
      const mimeType = AUDIO_TYPES[ext];
      if (!mimeType) throw badRequest('UNSUPPORTED_FORMAT', 'Неподдерживаемый формат');

      // Verify the payload really is decodable audio and measure it server-side.
      let duration = 0;
      try {
        const meta = await parseFile(file.path, { duration: true, skipCovers: true });
        if (!meta.format.container || !meta.format.duration || meta.format.duration <= 0) {
          throw new Error('undecodable');
        }
        duration = meta.format.duration;
      } catch {
        throw badRequest('INVALID_AUDIO', 'Файл повреждён или не является аудио');
      }

      let waveform: number[] | null = null;
      if (fields.waveform) {
        try {
          waveform = sanitizeWaveform(JSON.parse(fields.waveform));
        } catch {
          waveform = null;
        }
      }

      const fileKey = `${publicId()}.${ext}`;
      await ctx.storage.save(fileKey, file.path);
      try {
        const track = await ctx.tracks.create(
          {
            artistId: req.user!.id,
            title: fields.title,
            artistName: fields.artistName,
            fileKey,
            mimeType,
            fileSize: file.size,
            duration: Math.round(duration * 100) / 100,
            waveform: waveform ?? fallbackWaveform(fileKey),
          },
          { id: req.user!.id },
        );
        res.status(201).json({ track });
      } catch (err) {
        await ctx.storage.delete(fileKey);
        throw err;
      }
    } catch (err) {
      await cleanup();
      throw err;
    }
  });

  router.delete('/:id', requireRole('artist'), async (req, res) => {
    const viewer = { id: req.user!.id };
    const found = await ctx.tracks.findAny(param(req, 'id'), viewer);
    if (!found || found.deleted) throw notFound('TRACK_NOT_FOUND', 'Трек не найден');

    // Ownership is enforced here, on the server. The client's opinion is irrelevant.
    if (found.track.artistId !== viewer.id) {
      throw forbidden('NOT_OWNER', 'Можно удалять только свои треки');
    }

    const deleted = await ctx.tracks.softDelete(found.track.id);
    if (deleted) await ctx.storage.delete(found.fileKey);
    res.status(204).end();
  });

  return router;
}
