import type { Database } from '../db/index.js';

export interface TelegramSubscriberRow {
  chat_id: number;
  first_name: string | null;
  username: string | null;
  created_at: number;
}

/**
 * Chats that pressed /start and want to hear about every new track.
 * `chat_id` is the primary key: one subscription per Telegram chat, and in a
 * private chat the id doubles as the user id.
 */
export class TelegramRepo {
  constructor(private readonly db: Database) {}

  async subscribe(chatId: number, info: { firstName?: string; username?: string } = {}): Promise<void> {
    await this.db.run(
      `INSERT INTO telegram_subscribers (chat_id, first_name, username, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (chat_id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username`,
      [chatId, info.firstName ?? null, info.username ?? null, Date.now()],
    );
  }

  /** @returns true when a subscription was actually removed. */
  async unsubscribe(chatId: number): Promise<boolean> {
    const res = await this.db.run('DELETE FROM telegram_subscribers WHERE chat_id = ?', [chatId]);
    return res.changes > 0;
  }

  async listChatIds(): Promise<number[]> {
    const rows = await this.db.all<{ chat_id: number }>('SELECT chat_id FROM telegram_subscribers ORDER BY created_at');
    return rows.map((r) => Number(r.chat_id));
  }

  async count(): Promise<number> {
    const row = await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM telegram_subscribers');
    return Number(row?.n ?? 0);
  }
}
