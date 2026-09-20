import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_UPLOAD_BYTES } from '@shared/types';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works both from `src/` (tsx) and from `dist/` (bundled): the repo root is two levels up.
const repoRoot = path.resolve(here, '..', '..');

function int(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  /** Shared artist access code. Checked ONLY on the server. */
  artistPassword: string;
  /** Root directory for the SQLite file and uploaded audio. */
  dataDir: string;
  /** libsql URL. `file:` for embedded SQLite, `libsql://` for Turso. */
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  /** Directory with the built client (served in production). */
  clientDist: string;
  /**
   * Origins allowed to call the API from a browser. The static GitHub Pages
   * build is a different origin from the API, so this is what makes
   * "Pages shell + own backend" work. `*` (default) is safe here because the
   * API is bearer-token authenticated and never reads cookies.
   */
  allowedOrigins: string[];
  maxUploadBytes: number;
  /** Lifetime of a session in ms (rolling). */
  sessionTtlMs: number;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const env = (process.env.NODE_ENV as Config['env']) || 'development';
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(repoRoot, 'data'));
  const artistPassword = process.env.ARTIST_PASSWORD || '00112233';

  if (env === 'production' && artistPassword === '00112233' && !process.env.ALLOW_DEFAULT_ARTIST_PASSWORD) {
    console.warn(
      '[config] ARTIST_PASSWORD is not set — using the default code. Set ARTIST_PASSWORD in production.',
    );
  }

  return {
    env,
    port: int(process.env.PORT, 8080),
    host: process.env.HOST || '0.0.0.0',
    artistPassword,
    dataDir,
    databaseUrl: process.env.DATABASE_URL || `file:${path.join(dataDir, 'musicrate.db')}`,
    databaseAuthToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    clientDist: path.resolve(process.env.CLIENT_DIST || path.join(repoRoot, 'client', 'dist')),
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxUploadBytes: int(process.env.MAX_UPLOAD_MB, 0) * 1024 * 1024 || MAX_UPLOAD_BYTES,
    sessionTtlMs: int(process.env.SESSION_TTL_DAYS, 365) * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}
