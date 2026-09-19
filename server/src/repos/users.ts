import type { Role, User } from '@shared/types';
import type { Database } from '../db/index.js';
import { generateRecoveryCode, generateSecret, hashSecret, publicId } from '../lib/crypto.js';

export interface UserRow {
  id: string;
  role: Role;
  name: string;
  recovery_code: string | null;
  artist_key_hash: string | null;
  created_at: number;
  last_seen_at: number;
}

export function toUser(row: UserRow, { includeSecrets = false } = {}): User {
  const user: User = {
    id: row.id,
    role: row.role,
    name: row.name,
    createdAt: Number(row.created_at),
  };
  if (includeSecrets && row.role === 'guest' && row.recovery_code) user.recoveryCode = row.recovery_code;
  return user;
}

export class UsersRepo {
  constructor(private readonly db: Database) {}

  async createGuest(name: string): Promise<UserRow> {
    const now = Date.now();
    // Retry on the (astronomically unlikely) recovery code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const row: UserRow = {
        id: publicId(),
        role: 'guest',
        name,
        recovery_code: generateRecoveryCode(),
        artist_key_hash: null,
        created_at: now,
        last_seen_at: now,
      };
      try {
        await this.db.run(
          `INSERT INTO users (id, role, name, recovery_code, artist_key_hash, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          [row.id, row.role, row.name, row.recovery_code, row.created_at, row.last_seen_at],
        );
        return row;
      } catch (err) {
        if (attempt === 4 || !/UNIQUE/i.test(String(err))) throw err;
      }
    }
    throw new Error('unreachable');
  }

  /** Creates a new artist identity and returns the raw device key (shown once). */
  async createArtist(name: string): Promise<{ row: UserRow; artistKey: string }> {
    const now = Date.now();
    const artistKey = generateSecret(32);
    const row: UserRow = {
      id: publicId(),
      role: 'artist',
      name,
      recovery_code: null,
      artist_key_hash: hashSecret(artistKey),
      created_at: now,
      last_seen_at: now,
    };
    await this.db.run(
      `INSERT INTO users (id, role, name, recovery_code, artist_key_hash, created_at, last_seen_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
      [row.id, row.role, row.name, row.artist_key_hash, row.created_at, row.last_seen_at],
    );
    return { row, artistKey };
  }

  findById(id: string): Promise<UserRow | undefined> {
    return this.db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  }

  findByRecoveryCode(code: string): Promise<UserRow | undefined> {
    return this.db.get<UserRow>(`SELECT * FROM users WHERE role = 'guest' AND recovery_code = ?`, [code]);
  }

  findArtistByKey(artistKey: string): Promise<UserRow | undefined> {
    return this.db.get<UserRow>(`SELECT * FROM users WHERE role = 'artist' AND artist_key_hash = ?`, [
      hashSecret(artistKey),
    ]);
  }

  async rename(id: string, name: string): Promise<void> {
    await this.db.run('UPDATE users SET name = ? WHERE id = ?', [name, id]);
  }

  async touch(id: string): Promise<void> {
    await this.db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [Date.now(), id]);
  }
}
