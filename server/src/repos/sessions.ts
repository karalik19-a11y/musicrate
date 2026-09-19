import type { Database } from '../db/index.js';
import { generateSecret, hashSecret } from '../lib/crypto.js';
import type { UserRow } from './users.js';

export interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
  revoked_at: number | null;
}

/** Only bump `last_used_at` this often to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export class SessionsRepo {
  constructor(
    private readonly db: Database,
    private readonly ttlMs: number,
  ) {}

  /** Creates a session and returns the raw bearer token (never stored). */
  async create(userId: string): Promise<string> {
    const token = generateSecret(32);
    const now = Date.now();
    await this.db.run(
      `INSERT INTO sessions (token_hash, user_id, created_at, last_used_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [hashSecret(token), userId, now, now, now + this.ttlMs],
    );
    return token;
  }

  /** Resolves a bearer token to its user, or undefined if invalid/expired/revoked. */
  async resolve(token: string): Promise<UserRow | undefined> {
    const now = Date.now();
    const row = await this.db.get<UserRow & { token_hash: string; last_used_at: number }>(
      `SELECT u.*, s.token_hash, s.last_used_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`,
      [hashSecret(token), now],
    );
    if (!row) return undefined;
    if (now - Number(row.last_used_at) > TOUCH_INTERVAL_MS) {
      // rolling expiry
      await this.db.run('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?', [
        now,
        now + this.ttlMs,
        row.token_hash,
      ]);
      await this.db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [now, row.id]);
    }
    const { token_hash: _t, last_used_at: _l, ...user } = row;
    return user as UserRow;
  }

  async revoke(token: string): Promise<void> {
    await this.db.run('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', [
      Date.now(),
      hashSecret(token),
    ]);
  }
}
