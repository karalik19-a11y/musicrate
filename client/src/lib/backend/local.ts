/**
 * LOCAL BACKEND — the data source the static GitHub Pages build runs on.
 *
 * It is not a mock: it is a small embedded implementation of the exact same
 * contract the Express API exposes, persisted in IndexedDB:
 *
 *   • sessions and roles (guest / artist) with a persisted token
 *   • the artist code checked against a SHA-256 hash (with lockout), never
 *     compared against a plaintext string in the bundle
 *   • audio bytes stored as Blobs, streamed through object URLs
 *   • one rating row per (track, user), aggregates recomputed on every write
 *     with the shared scoring module — the totals are never taken from the UI
 *   • ownership checks on delete and tombstones so removed tracks stay removed
 *
 * Everything is scoped to this device, which is exactly what a static host can
 * offer. Point the client at the real API (see the in-app "data source" panel)
 * and the identical UI starts reading and writing the shared database instead.
 */

import {
  ACCEPTED_AUDIO_EXTENSIONS,
  AUDIO_TYPES,
  MAX_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_UPLOAD_BYTES,
  RATING_COMPONENT_MAX,
  type ArtistOverview,
  type AuthResponse,
  type RatingInput,
  type Role,
  type Track,
  type TrackSort,
  type User,
} from '@shared/types';
import { averageOfTotals, summarizeRatings, totalOf } from '@shared/scoring';
import { ApiError } from '@/lib/api';
import { idb, wipeLocalDatabase } from '@/lib/idb';
import type { Backend, PublishInput } from './types';

/* ------------------------------------------------------------------ */
/* rows                                                                */
/* ------------------------------------------------------------------ */

interface UserRow {
  id: string;
  role: Role;
  name: string;
  createdAt: number;
  lastSeenAt: number;
  recoveryCode?: string;
  artistKey?: string;
}

interface SessionRow {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface TrackRow {
  id: string;
  artistId: string;
  title: string;
  artistName: string;
  mimeType: string;
  fileSize: number;
  duration: number;
  waveform: number[];
  coverSeed: string;
  fileName: string;
  createdAt: number;
  deletedAt: number | null;
}

interface RatingRow extends RatingInput {
  /** `${trackId}\u0000${userId}` — unique by construction. */
  key: string;
  trackId: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

interface PlayRow {
  key: string;
  trackId: string;
  userId: string;
  count: number;
  lastAt: number;
}

interface AudioRow {
  trackId: string;
  blob: Blob;
  mimeType: string;
}

interface Vault {
  users: Map<string, UserRow>;
  tracks: Map<string, TrackRow>;
  ratings: RatingRow[];
  plays: PlayRow[];
}

/** Access code for the Pages build, stored as a hash so the code itself is
 *  not greppable in the bundle. Override with VITE_ARTIST_CODE_HASH at build
 *  time. NOTE: in this mode the vault is the visitor's own device, so the hash
 *  is obfuscation, not a security boundary — with an API configured the code is
 *  verified by the server and never reaches the client at all. */
const DEFAULT_CODE_HASH = '32b4f576fc607b3ed0a1516e772567e52f31093263c548b9c716725877238b94';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;
/** Tombstones keep old deep links answering "gone" for this long. */
const TOMBSTONE_TTL = 1000 * 60 * 60 * 24 * 90;
const PLAY_DEDUPE_MS = 30_000;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function newId(prefix: string): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)}`;
}

function randomToken(): string {
  return newId('tok') + newId('').slice(0, 8);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const ratingKey = (trackId: string, userId: string): string => `${trackId}\u0000${userId}`;

function toUser(row: UserRow, includeSecrets: boolean): User {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    createdAt: row.createdAt,
    recoveryCode: includeSecrets ? row.recoveryCode : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* backend                                                             */
/* ------------------------------------------------------------------ */

export class LocalBackend implements Backend {
  readonly kind = 'local' as const;

  private token: string | null = null;
  private purged = false;
  private sessions = new Map<string, string>();
  private objectUrls = new Map<string, string>();
  private channel: BroadcastChannel | null = null;
  private onUnauthorized: () => void = () => undefined;

  constructor(onUnauthorized?: () => void) {
    if (onUnauthorized) this.onUnauthorized = onUnauthorized;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('musicrate');
      this.channel.onmessage = () => this.invalidate();
    }
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  /* ------------------------------ vault ------------------------------ */

  /**
   * Reads the vault. Metadata rows only — audio lives in its own store and is
   * never pulled by a list request. A device holds a handful of tracks, so a
   * straight read beats a cache that can go stale between two tabs.
   */
  private async load(): Promise<Vault> {
    try {
      const [users, tracks, ratings, plays, sessions] = await Promise.all([
        idb.all<UserRow>('users'),
        idb.all<TrackRow>('tracks'),
        idb.all<RatingRow>('ratings'),
        idb.all<PlayRow>('plays'),
        idb.all<SessionRow>('sessions'),
      ]);
      this.sessions = new Map(sessions.map((session) => [session.token, session.userId]));
      const vault: Vault = {
        users: new Map(users.map((row) => [row.id, row])),
        tracks: new Map(tracks.map((row) => [row.id, row])),
        ratings,
        plays,
      };
      if (!this.purged) {
        this.purged = true;
        void this.purgeExpired(vault);
      }
      return vault;
    } catch (err) {
      throw new ApiError(0, 'STORAGE', (err as Error)?.message ?? 'Хранилище браузера недоступно');
    }
  }

  /** Drops tombstones and expired sessions — nothing user-facing lingers. */
  private async purgeExpired(vault: Vault): Promise<void> {
    const now = Date.now();
    let dirty = false;
    for (const [id, row] of vault.tracks) {
      if (row.deletedAt && now - row.deletedAt > TOMBSTONE_TTL) {
        vault.tracks.delete(id);
        await idb.del('tracks', id);
        await idb.del('audio', id);
        this.revokeUrl(id);
        dirty = true;
      }
    }
    for (const [token, userId] of [...this.sessions]) {
      const record = await idb.get<SessionRow>('sessions', token);
      if (!record || record.expiresAt < now || !vault.users.has(userId)) {
        this.sessions.delete(token);
        await idb.del('sessions', token);
        dirty = true;
      }
    }
    if (dirty) this.broadcast();
  }

  /** Fired after every write: other tabs refetch, and so does this one. */
  private broadcast(): void {
    this.channel?.postMessage('changed');
    this.invalidate();
  }

  /** Another tab wrote: tell the UI to refetch (data is read through anyway). */
  private invalidate(): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('musicrate:vault'));
  }

  private async currentUserId(): Promise<string> {
    const userId = this.token ? this.sessions.get(this.token) : undefined;
    if (!userId) {
      this.onUnauthorized();
      throw new ApiError(401, 'UNAUTHORIZED', 'Сессия недействительна. Войдите заново.');
    }
    const vault = await this.load();
    if (!vault.users.has(userId)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Профиль не найден на этом устройстве');
    }
    return userId;
  }

  /* ------------------------------ session ---------------------------- */

  async health(): Promise<{ ok: boolean }> {
    await this.load();
    return { ok: true };
  }

  private async createSession(userId: string): Promise<string> {
    const token = randomToken();
    const record: SessionRow = {
      token,
      userId,
      createdAt: Date.now(),
      // rolling 1-year sessions, same policy as the API
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    };
    this.sessions.set(token, userId);
    await idb.put('sessions', record);
    return token;
  }

  async me(): Promise<{ user: User }> {
    const vault = await this.load();
    const userId = await this.currentUserId();
    return { user: toUser(vault.users.get(userId)!, true) };
  }

  async rename(name: string): Promise<{ user: User }> {
    const clean = name.trim();
    if (!clean || clean.length > MAX_NAME_LENGTH) {
      throw new ApiError(400, 'INVALID_NAME', `Имя от 1 до ${MAX_NAME_LENGTH} символов`);
    }
    const vault = await this.load();
    const userId = await this.currentUserId();
    const row = vault.users.get(userId)!;
    const updated = { ...row, name: clean, lastSeenAt: Date.now() };
    vault.users.set(userId, updated);
    await idb.put('users', updated);
    return { user: toUser(updated, true) };
  }

  async loginArtist(password: string, artistKey?: string): Promise<AuthResponse> {
    const vault = await this.load();
    await this.enforceLockout();

    const expected = (import.meta.env.VITE_ARTIST_CODE_HASH as string | undefined) || DEFAULT_CODE_HASH;
    const actual = await sha256Hex(password.trim());
    if (actual !== expected) {
      await this.registerFailedAttempt();
      throw new ApiError(401, 'INVALID_CODE', 'Неверный код доступа');
    }
    await this.resetAttempts();

    const existing = artistKey ? [...vault.users.values()].find((u) => u.role === 'artist' && u.artistKey === artistKey) : undefined;
    let row = existing;
    let issuedKey = artistKey;
    if (!row) {
      issuedKey = newId('key');
      row = {
        id: newId('art'),
        role: 'artist',
        name: 'Artist',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        artistKey: issuedKey,
      };
      vault.users.set(row.id, row);
      await idb.put('users', row);
    } else {
      row.lastSeenAt = Date.now();
      await idb.put('users', row);
    }

    const token = await this.createSession(row.id);
    return { token, user: toUser(row, false), artistKey: issuedKey };
  }

  async createGuest(name: string): Promise<AuthResponse> {
    const clean = name.trim();
    if (!clean || clean.length > MAX_NAME_LENGTH) {
      throw new ApiError(400, 'INVALID_NAME', `Имя от 1 до ${MAX_NAME_LENGTH} символов`);
    }
    const vault = await this.load();
    const row: UserRow = {
      id: newId('gst'),
      role: 'guest',
      name: clean,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      recoveryCode: newId('').slice(1, 9).toUpperCase(),
    };
    vault.users.set(row.id, row);
    await idb.put('users', row);
    const token = await this.createSession(row.id);
    return { token, user: toUser(row, true) };
  }

  async restoreGuest(code: string): Promise<AuthResponse> {
    const vault = await this.load();
    const wanted = code.trim().toUpperCase();
    const row = [...vault.users.values()].find((u) => u.role === 'guest' && u.recoveryCode === wanted);
    if (!row) {
      throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Такого профиля нет на этом устройстве');
    }
    row.lastSeenAt = Date.now();
    await idb.put('users', row);
    const token = await this.createSession(row.id);
    return { token, user: toUser(row, true) };
  }

  async logout(): Promise<void> {
    if (this.token) {
      this.sessions.delete(this.token);
      await idb.del('sessions', this.token);
    }
  }

  private async enforceLockout(): Promise<void> {
    const meta = await idb.get<{ key: string; fails: number; lockedUntil: number }>('meta', 'auth');
    if (meta && meta.lockedUntil > Date.now()) {
      const seconds = Math.ceil((meta.lockedUntil - Date.now()) / 1000);
      throw new ApiError(429, 'TOO_MANY_ATTEMPTS', `Слишком много попыток. Подожди ${seconds} с`);
    }
  }

  private async registerFailedAttempt(): Promise<void> {
    const meta = await idb.get<{ key: string; fails: number; lockedUntil: number }>('meta', 'auth');
    const fails = (meta?.fails ?? 0) + 1;
    await idb.put('meta', {
      key: 'auth',
      fails,
      lockedUntil: fails >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
    });
  }

  private async resetAttempts(): Promise<void> {
    await idb.put('meta', { key: 'auth', fails: 0, lockedUntil: 0 });
  }

  /* ------------------------------ tracks ----------------------------- */

  private async sumsFor(vault: Vault, trackId: string) {
    const rows = vault.ratings.filter((r) => r.trackId === trackId);
    return summarizeRatings(
      rows.reduce(
        (acc, r) => ({
          count: acc.count + 1,
          quality: acc.quality + r.quality,
          listenability: acc.listenability + r.listenability,
          personal: acc.personal + r.personal,
        }),
        { count: 0, quality: 0, listenability: 0, personal: 0 },
      ),
    );
  }

  private playsFor(vault: Vault, trackId: string): number {
    return vault.plays.filter((p) => p.trackId === trackId).reduce((sum, p) => sum + p.count, 0);
  }

  private async view(vault: Vault, row: TrackRow, viewerId: string): Promise<Track> {
    const mine = vault.ratings.find((r) => r.trackId === row.id && r.userId === viewerId);
    return {
      id: row.id,
      title: row.title,
      artistName: row.artistName,
      artistId: row.artistId,
      duration: round(row.duration, 2),
      waveform: row.waveform,
      coverSeed: row.coverSeed,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      createdAt: row.createdAt,
      audioUrl: `local:${row.id}`,
      plays: this.playsFor(vault, row.id),
      rating: await this.sumsFor(vault, row.id),
      myRating: mine
        ? {
            quality: mine.quality,
            listenability: mine.listenability,
            personal: mine.personal,
            total: totalOf(mine),
            updatedAt: mine.updatedAt,
          }
        : null,
      isMine: row.artistId === viewerId,
    };
  }

  async listTracks({ sort, query }: { sort: TrackSort; query?: string }): Promise<{ tracks: Track[] }> {
    const vault = await this.load();
    const viewerId = await this.currentUserId();
    const needle = (query ?? '').trim().toLowerCase();
    const rows = [...vault.tracks.values()].filter(
      (row) =>
        !row.deletedAt &&
        (!needle || `${row.title} ${row.artistName}`.toLowerCase().includes(needle)),
    );
    const tracks = await Promise.all(rows.map((row) => this.view(vault, row, viewerId)));
    return { tracks: sortTracks(tracks, sort) };
  }

  async getTrack(id: string): Promise<{ track: Track }> {
    const vault = await this.load();
    const viewerId = await this.currentUserId();
    const row = vault.tracks.get(id);
    if (!row) throw new ApiError(404, 'TRACK_NOT_FOUND', 'Трек не найден');
    if (row.deletedAt) throw new ApiError(410, 'TRACK_DELETED', 'Трек был удалён артистом');
    return { track: await this.view(vault, row, viewerId) };
  }

  async myTracks(): Promise<{ tracks: Track[] }> {
    const vault = await this.load();
    const viewerId = await this.currentUserId();
    const rows = [...vault.tracks.values()].filter((row) => !row.deletedAt && row.artistId === viewerId);
    return { tracks: sortTracks(await Promise.all(rows.map((row) => this.view(vault, row, viewerId))), 'new') };
  }

  async overview(): Promise<{ overview: ArtistOverview }> {
    const vault = await this.load();
    const artistId = await this.currentUserId();
    const rows = [...vault.tracks.values()].filter((row) => !row.deletedAt && row.artistId === artistId);
    const totals: number[] = [];
    let plays = 0;
    let ratingCount = 0;
    for (const row of rows) {
      plays += this.playsFor(vault, row.id);
      const summary = await this.sumsFor(vault, row.id);
      ratingCount += summary.count;
      if (summary.count > 0) totals.push(summary.total);
    }
    return {
      overview: {
        tracks: rows.length,
        plays,
        ratings: ratingCount,
        averageScore: averageOfTotals(totals),
      },
    };
  }

  async publish(input: PublishInput): Promise<{ track: Track }> {
    const vault = await this.load();
    const userId = await this.currentUserId();
    const me = vault.users.get(userId)!;
    if (me.role !== 'artist') throw new ApiError(403, 'FORBIDDEN', 'Только для артистов');

    const title = input.title.trim();
    const artistName = input.artistName.trim();
    if (!title || title.length > MAX_TITLE_LENGTH) {
      throw new ApiError(400, 'INVALID_TITLE', `Название от 1 до ${MAX_TITLE_LENGTH} символов`);
    }
    if (!artistName || artistName.length > MAX_NAME_LENGTH) {
      throw new ApiError(400, 'INVALID_NAME', `Имя от 1 до ${MAX_NAME_LENGTH} символов`);
    }
    const ext = input.file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_AUDIO_EXTENSIONS.includes(ext)) {
      throw new ApiError(400, 'UNSUPPORTED_FORMAT', 'Поддерживаются MP3, WAV, M4A, AAC и FLAC');
    }
    if (!input.file.size) throw new ApiError(400, 'EMPTY_FILE', 'Файл пустой');
    if (input.file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, 'TOO_LARGE', `Максимум ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`);
    }

    const id = newId('trk');
    const row: TrackRow = {
      id,
      artistId: userId,
      title,
      artistName,
      mimeType: AUDIO_TYPES[ext] ?? (input.file.type || 'application/octet-stream'),
      fileSize: input.file.size,
      duration: round(input.duration ?? 0, 2),
      waveform: sanitizePeaks(input.waveform),
      coverSeed: newId('seed'),
      fileName: input.file.name.slice(0, 120),
      createdAt: Date.now(),
      deletedAt: null,
    };

    // The bytes are copied into IndexedDB here; the two progress beats keep the
    // upload animation honest on a device-local vault (no network round-trip).
    input.onProgress?.(0.45);
    await idb.put('audio', { trackId: id, blob: input.file, mimeType: row.mimeType } satisfies AudioRow);
    input.onProgress?.(0.85);
    vault.tracks.set(id, row);
    await idb.put('tracks', row);
    await new Promise((resolve) => setTimeout(resolve, 180));
    input.onProgress?.(1);
    this.broadcast();

    return { track: await this.view(vault, row, userId) };
  }

  /** Guests only. One row per (track, user): a second submit edits the first. */
  async rateTrack(id: string, rating: RatingInput): Promise<{ track: Track }> {
    const vault = await this.load();
    const userId = await this.currentUserId();
    const me = vault.users.get(userId)!;
    if (me.role !== 'guest') throw new ApiError(403, 'FORBIDDEN', 'Оставлять оценки могут только гости');

    const row = vault.tracks.get(id);
    if (!row) throw new ApiError(404, 'TRACK_NOT_FOUND', 'Трек не найден');
    if (row.deletedAt) throw new ApiError(410, 'TRACK_DELETED', 'Трек больше недоступен');

    for (const value of [rating.quality, rating.listenability, rating.personal]) {
      if (!Number.isInteger(value) || value < 0 || value > RATING_COMPONENT_MAX) {
        throw new ApiError(400, 'INVALID_RATING', `Оценка — целое число от 0 до ${RATING_COMPONENT_MAX}`);
      }
    }

    const key = ratingKey(id, userId);
    const now = Date.now();
    const previous = vault.ratings.find((r) => r.key === key);
    const next: RatingRow = {
      key,
      trackId: id,
      userId,
      quality: rating.quality,
      listenability: rating.listenability,
      personal: rating.personal,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    vault.ratings = previous ? vault.ratings.map((r) => (r.key === key ? next : r)) : [...vault.ratings, next];
    await idb.put('ratings', next);
    this.broadcast();

    return { track: await this.view(vault, row, userId) };
  }

  async deleteTrack(id: string): Promise<void> {
    const vault = await this.load();
    const userId = await this.currentUserId();
    if (vault.users.get(userId)!.role !== 'artist') {
      throw new ApiError(403, 'FORBIDDEN', 'Только для артистов');
    }
    const row = vault.tracks.get(id);
    if (!row || row.deletedAt) throw new ApiError(404, 'TRACK_NOT_FOUND', 'Трек не найден');

    // Same rule as the API: the owner is the only one who can delete.
    if (row.artistId !== userId) throw new ApiError(403, 'NOT_OWNER', 'Можно удалять только свои треки');

    row.deletedAt = Date.now();
    vault.tracks.set(id, row);
    await idb.put('tracks', row);

    // ratings, plays and the audio bytes go with it — no orphaned data left
    const doomedRatings = vault.ratings.filter((r) => r.trackId === id);
    const doomedPlays = vault.plays.filter((pl) => pl.trackId === id);
    vault.ratings = vault.ratings.filter((r) => r.trackId !== id);
    vault.plays = vault.plays.filter((pl) => pl.trackId !== id);
    await Promise.all([
      ...doomedRatings.map((r) => idb.del('ratings', r.key)),
      ...doomedPlays.map((pl) => idb.del('plays', pl.key)),
      idb.del('audio', id),
    ]);
    this.revokeUrl(id);
    this.broadcast();
  }

  async recordPlay(id: string): Promise<{ counted: boolean; plays: number }> {
    const vault = await this.load();
    const userId = await this.currentUserId();
    const row = vault.tracks.get(id);
    if (!row || row.deletedAt) throw new ApiError(410, 'TRACK_DELETED', 'Трек больше недоступен');

    const key = ratingKey(id, userId);
    const now = Date.now();
    const existing = vault.plays.find((p) => p.key === key);
    if (existing && now - existing.lastAt < PLAY_DEDUPE_MS) {
      return { counted: false, plays: this.playsFor(vault, id) };
    }
    const next: PlayRow = existing
      ? { ...existing, count: existing.count + 1, lastAt: now }
      : { key, trackId: id, userId, count: 1, lastAt: now };
    vault.plays = existing ? vault.plays.map((p) => (p.key === key ? next : p)) : [...vault.plays, next];
    await idb.put('plays', next);
    return { counted: true, plays: this.playsFor(vault, id) };
  }

  /* ------------------------------ audio ------------------------------ */

  async resolveAudioUrl(track: Track): Promise<string> {
    if (!track.audioUrl.startsWith('local:')) return track.audioUrl;
    const cached = this.objectUrls.get(track.id);
    if (cached) return cached;

    const row = await idb.get<AudioRow>('audio', track.id);
    if (!row) throw new ApiError(410, 'TRACK_DELETED', 'Файл трека удалён');
    const url = URL.createObjectURL(row.blob);
    this.objectUrls.set(track.id, url);
    return url;
  }

  private revokeUrl(trackId: string): void {
    const url = this.objectUrls.get(trackId);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(trackId);
    }
  }

  /** Danger button in the profile: wipes this device's vault. */
  async resetVault(): Promise<void> {
    await wipeLocalDatabase();
    this.sessions.clear();
    for (const id of [...this.objectUrls.keys()]) this.revokeUrl(id);
    this.broadcast();
  }
}

/* ------------------------------------------------------------------ */
/* pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

const SORTERS: Record<TrackSort, (a: Track, b: Track) => number> = {
  new: (a, b) => b.createdAt - a.createdAt,
  top: (a, b) =>
    b.rating.total - a.rating.total || b.rating.count - a.rating.count || b.createdAt - a.createdAt,
  played: (a, b) => b.plays - a.plays || b.createdAt - a.createdAt,
};

export function sortTracks(tracks: Track[], sort: TrackSort): Track[] {
  return [...tracks].sort(SORTERS[sort] ?? SORTERS.new);
}

/** Keeps the peaks array bounded and normalized, like the server does. */
export function sanitizePeaks(input: number[] | null): number[] {
  if (!Array.isArray(input) || input.length === 0) return fallbackPeaks();
  const clamped = input
    .slice(0, 512)
    .map((value) => (Number.isFinite(value) ? Math.min(1, Math.max(0.02, value)) : 0.1));
  return clamped.length ? clamped : fallbackPeaks();
}

function fallbackPeaks(): number[] {
  return Array.from({ length: 64 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.7)));
}
