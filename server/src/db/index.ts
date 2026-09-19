import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client, type InArgs, type InValue } from '@libsql/client';
import { SCHEMA } from './schema.js';

export type SqlValue = InValue;

/**
 * Thin typed wrapper around a libsql client.
 * libsql gives us embedded SQLite by default (a single file on disk) and a
 * drop-in path to a hosted database (Turso) by changing DATABASE_URL.
 */
export class Database {
  private constructor(private readonly client: Client) {}

  static async open(url: string, authToken?: string): Promise<Database> {
    if (url.startsWith('file:')) {
      const file = url.slice('file:'.length);
      if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    const client = createClient({ url, authToken });
    const db = new Database(client);
    await db.migrate();
    return db;
  }

  private async migrate(): Promise<void> {
    if (!this.client.protocol.startsWith('http') && !this.client.protocol.startsWith('ws')) {
      await this.client.execute('PRAGMA journal_mode = WAL');
    }
    await this.client.execute('PRAGMA foreign_keys = ON');
    await this.client.executeMultiple(SCHEMA);
  }

  async all<T extends object = Record<string, SqlValue>>(sql: string, args: InArgs = []): Promise<T[]> {
    const result = await this.client.execute({ sql, args });
    return result.rows as unknown as T[];
  }

  async get<T extends object = Record<string, SqlValue>>(sql: string, args: InArgs = []): Promise<T | undefined> {
    const rows = await this.all<T>(sql, args);
    return rows[0];
  }

  async run(sql: string, args: InArgs = []): Promise<{ changes: number }> {
    const result = await this.client.execute({ sql, args });
    return { changes: result.rowsAffected };
  }

  /** Runs several statements atomically. */
  async batch(statements: Array<{ sql: string; args?: InArgs }>): Promise<void> {
    await this.client.batch(
      statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
      'write',
    );
  }

  close(): void {
    this.client.close();
  }
}
