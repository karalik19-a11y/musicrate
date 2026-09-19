/**
 * Idempotent schema. Applied on every boot; safe to re-run.
 * Timestamps are unix milliseconds.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL CHECK (role IN ('guest', 'artist')),
  name            TEXT NOT NULL,
  recovery_code   TEXT UNIQUE,
  artist_key_hash TEXT UNIQUE,
  created_at      INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  revoked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS tracks (
  id          TEXT PRIMARY KEY,
  artist_id   TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  file_key    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  file_size   INTEGER NOT NULL,
  duration    REAL NOT NULL DEFAULT 0,
  waveform    TEXT NOT NULL,
  cover_seed  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tracks_active ON tracks(deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id, deleted_at);

CREATE TABLE IF NOT EXISTS ratings (
  track_id      TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality       INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 30),
  listenability INTEGER NOT NULL CHECK (listenability BETWEEN 0 AND 30),
  personal      INTEGER NOT NULL CHECK (personal BETWEEN 0 AND 30),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (track_id, user_id)
);

CREATE TABLE IF NOT EXISTS plays (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plays_track ON plays(track_id);
CREATE INDEX IF NOT EXISTS idx_plays_user_track ON plays(user_id, track_id, created_at DESC);
`;
