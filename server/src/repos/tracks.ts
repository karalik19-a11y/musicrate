import type { ArtistOverview, RatingInput, Track, TrackSort } from '@shared/types';
import { averageOfTotals, summarizeRatings, totalOf } from '@shared/scoring';
import type { Database } from '../db/index.js';
import { publicId } from '../lib/crypto.js';

interface TrackRow {
  id: string;
  artist_id: string;
  title: string;
  artist_name: string;
  file_key: string;
  mime_type: string;
  file_size: number;
  duration: number;
  waveform: string;
  cover_seed: string;
  created_at: number;
  deleted_at: number | null;
  // aggregates (raw sums; averaging happens in @shared/scoring)
  rating_count: number;
  sum_quality: number;
  sum_listenability: number;
  sum_personal: number;
  play_count: number;
  // viewer's own rating
  my_quality: number | null;
  my_listenability: number | null;
  my_personal: number | null;
  my_updated_at: number | null;
}

export interface NewTrack {
  artistId: string;
  title: string;
  artistName: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  duration: number;
  waveform: number[];
}

export interface Viewer {
  id: string;
}

/**
 * Aggregates are computed in SQL from the raw ratings/plays tables on every
 * read. Nothing is ever cached or hand-edited, so the public score is always
 * the exact function of real user ratings. SQLite only produces SUMs; the
 * averaging/rounding itself lives in `@shared/scoring` so that the browser
 * fallback engine produces byte-identical numbers.
 */
const SELECT_TRACK = `
  SELECT t.*,
         (SELECT COUNT(*)                   FROM ratings r WHERE r.track_id = t.id) AS rating_count,
         (SELECT COALESCE(SUM(quality), 0)       FROM ratings r WHERE r.track_id = t.id) AS sum_quality,
         (SELECT COALESCE(SUM(listenability), 0) FROM ratings r WHERE r.track_id = t.id) AS sum_listenability,
         (SELECT COALESCE(SUM(personal), 0)      FROM ratings r WHERE r.track_id = t.id) AS sum_personal,
         (SELECT COUNT(*)            FROM plays   p WHERE p.track_id = t.id) AS play_count,
         my.quality       AS my_quality,
         my.listenability AS my_listenability,
         my.personal      AS my_personal,
         my.updated_at    AS my_updated_at
    FROM tracks t
    LEFT JOIN ratings my ON my.track_id = t.id AND my.user_id = ?
`;

const ORDER_BY: Record<TrackSort, string> = {
  new: 't.created_at DESC',
  top: '(COALESCE(sum_quality,0) + COALESCE(sum_listenability,0) + COALESCE(sum_personal,0)) DESC, rating_count DESC, t.created_at DESC',
  played: 'play_count DESC, t.created_at DESC',
};

function toTrack(row: TrackRow, viewer: Viewer): Track {
  const summary = summarizeRatings({
    count: Number(row.rating_count),
    quality: Number(row.sum_quality),
    listenability: Number(row.sum_listenability),
    personal: Number(row.sum_personal),
  });
  const hasMine = row.my_quality != null;

  return {
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    artistId: row.artist_id,
    duration: Number(row.duration),
    waveform: JSON.parse(row.waveform) as number[],
    coverSeed: row.cover_seed,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    createdAt: Number(row.created_at),
    audioUrl: `/api/tracks/${row.id}/audio`,
    plays: Number(row.play_count),
    rating: summary,
    myRating: hasMine
      ? {
          quality: Number(row.my_quality),
          listenability: Number(row.my_listenability),
          personal: Number(row.my_personal),
          total: totalOf({
            quality: Number(row.my_quality),
            listenability: Number(row.my_listenability),
            personal: Number(row.my_personal),
          }),
          updatedAt: Number(row.my_updated_at),
        }
      : null,
    isMine: row.artist_id === viewer.id,
  };
}

export class TracksRepo {
  constructor(private readonly db: Database) {}

  async list(viewer: Viewer, options: { sort?: TrackSort; query?: string; artistId?: string } = {}): Promise<Track[]> {
    const where = ['t.deleted_at IS NULL'];
    const args: (string | number)[] = [viewer.id];
    if (options.artistId) {
      where.push('t.artist_id = ?');
      args.push(options.artistId);
    }
    if (options.query) {
      where.push('(t.title LIKE ? OR t.artist_name LIKE ?)');
      const like = `%${options.query.replace(/[%_]/g, '')}%`;
      args.push(like, like);
    }
    const rows = await this.db.all<TrackRow>(
      `${SELECT_TRACK} WHERE ${where.join(' AND ')} ORDER BY ${ORDER_BY[options.sort ?? 'new']} LIMIT 500`,
      args,
    );
    return rows.map((row) => toTrack(row, viewer));
  }

  /** Returns the track (even if soft-deleted, so callers can answer 410). */
  async findAny(id: string, viewer: Viewer): Promise<{ track: Track; deleted: boolean; fileKey: string } | undefined> {
    const row = await this.db.get<TrackRow>(`${SELECT_TRACK} WHERE t.id = ?`, [viewer.id, id]);
    if (!row) return undefined;
    return { track: toTrack(row, viewer), deleted: row.deleted_at != null, fileKey: row.file_key };
  }

  /** Minimal lookup used by the audio streaming endpoint. */
  fileInfo(id: string): Promise<{ file_key: string; mime_type: string; deleted_at: number | null } | undefined> {
    return this.db.get('SELECT file_key, mime_type, deleted_at FROM tracks WHERE id = ?', [id]);
  }

  async create(input: NewTrack, viewer: Viewer): Promise<Track> {
    const id = publicId();
    await this.db.run(
      `INSERT INTO tracks (id, artist_id, title, artist_name, file_key, mime_type, file_size, duration, waveform, cover_seed, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.artistId,
        input.title,
        input.artistName,
        input.fileKey,
        input.mimeType,
        input.fileSize,
        input.duration,
        JSON.stringify(input.waveform),
        publicId(),
        Date.now(),
      ],
    );
    const created = await this.findAny(id, viewer);
    if (!created) throw new Error('Track vanished after insert');
    return created.track;
  }

  /**
   * Soft-deletes the track row (keeps the id reserved so old links answer 410)
   * and hard-deletes its ratings and plays. Returns false if it was already gone.
   */
  async softDelete(id: string): Promise<boolean> {
    const now = Date.now();
    await this.db.batch([
      { sql: 'DELETE FROM ratings WHERE track_id = ?', args: [id] },
      { sql: 'DELETE FROM plays WHERE track_id = ?', args: [id] },
      { sql: 'UPDATE tracks SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', args: [now, id] },
    ]);
    const row = await this.db.get<{ deleted_at: number | null }>('SELECT deleted_at FROM tracks WHERE id = ?', [id]);
    return row?.deleted_at === now;
  }

  /** One rating per (track, user): a repeat submission updates the existing row. */
  async upsertRating(trackId: string, userId: string, rating: RatingInput): Promise<void> {
    const now = Date.now();
    await this.db.run(
      `INSERT INTO ratings (track_id, user_id, quality, listenability, personal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(track_id, user_id) DO UPDATE SET
         quality = excluded.quality,
         listenability = excluded.listenability,
         personal = excluded.personal,
         updated_at = excluded.updated_at`,
      [trackId, userId, rating.quality, rating.listenability, rating.personal, now, now],
    );
  }

  /** Records a play unless the same user played the same track very recently. */
  async recordPlay(trackId: string, userId: string, dedupeWindowMs = 30_000): Promise<boolean> {
    const now = Date.now();
    const recent = await this.db.get<{ created_at: number }>(
      'SELECT created_at FROM plays WHERE track_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      [trackId, userId],
    );
    if (recent && now - Number(recent.created_at) < dedupeWindowMs) return false;
    await this.db.run('INSERT INTO plays (track_id, user_id, created_at) VALUES (?, ?, ?)', [trackId, userId, now]);
    return true;
  }

  /**
   * Studio stats. The average score is derived from the same shared scoring
   * helper as every public rating, so the studio and the guest feed can never
   * disagree.
   */
  async artistOverview(artistId: string): Promise<ArtistOverview> {
    const row = await this.db.get<{ tracks: number; plays: number; ratings: number }>(
      `SELECT COUNT(*) AS tracks,
              COALESCE(SUM((SELECT COUNT(*) FROM plays p WHERE p.track_id = t.id)), 0)   AS plays,
              COALESCE(SUM((SELECT COUNT(*) FROM ratings r WHERE r.track_id = t.id)), 0) AS ratings
         FROM tracks t
        WHERE t.artist_id = ? AND t.deleted_at IS NULL`,
      [artistId],
    );
    const sums = await this.db.all<{
      rating_count: number;
      sum_quality: number;
      sum_listenability: number;
      sum_personal: number;
    }>(
      `SELECT (SELECT COUNT(*) FROM ratings r WHERE r.track_id = t.id)                  AS rating_count,
              (SELECT COALESCE(SUM(quality), 0)       FROM ratings r WHERE r.track_id = t.id) AS sum_quality,
              (SELECT COALESCE(SUM(listenability), 0) FROM ratings r WHERE r.track_id = t.id) AS sum_listenability,
              (SELECT COALESCE(SUM(personal), 0)      FROM ratings r WHERE r.track_id = t.id) AS sum_personal
         FROM tracks t
        WHERE t.artist_id = ? AND t.deleted_at IS NULL`,
      [artistId],
    );
    const totals = sums
      .filter((s) => Number(s.rating_count) > 0)
      .map((s) => summarizeRatings({
        count: Number(s.rating_count),
        quality: Number(s.sum_quality),
        listenability: Number(s.sum_listenability),
        personal: Number(s.sum_personal),
      }).total);

    return {
      tracks: Number(row?.tracks ?? 0),
      plays: Number(row?.plays ?? 0),
      ratings: Number(row?.ratings ?? 0),
      averageScore: averageOfTotals(totals),
    };
  }
}
