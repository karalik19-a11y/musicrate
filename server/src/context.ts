import path from 'node:path';
import type { Config } from './config.js';
import { Database } from './db/index.js';
import { SessionsRepo } from './repos/sessions.js';
import { TelegramRepo } from './repos/telegram.js';
import { TracksRepo } from './repos/tracks.js';
import { UsersRepo } from './repos/users.js';
import { createStorage, type AudioStorage } from './storage/index.js';
import { TelegramBot } from './telegram/bot.js';
import type { NewTrackNotifier } from './telegram/notifier.js';

export interface AppContext {
  config: Config;
  db: Database;
  users: UsersRepo;
  sessions: SessionsRepo;
  tracks: TracksRepo;
  storage: AudioStorage;
  uploadTmpDir: string;
  /** Telegram chat subscriptions (kept even when the bot is off). */
  telegram: TelegramRepo;
  /** Live bot instance when TELEGRAM_BOT_TOKEN is set; started by index.ts. */
  bot: TelegramBot | null;
  /** Receives every freshly published track. The bot, or a test fake. */
  notifier: NewTrackNotifier | null;
}

export interface ContextDeps {
  /** Test seam: replaces the bot as the new-track notifier. */
  notifier?: NewTrackNotifier;
}

export async function createContext(config: Config, deps: ContextDeps = {}): Promise<AppContext> {
  const db = await Database.open(config.databaseUrl, config.databaseAuthToken);
  const telegram = new TelegramRepo(db);
  const bot =
    config.telegramBotToken && config.env !== 'test'
      ? new TelegramBot({
          token: config.telegramBotToken,
          webappUrl: config.telegramWebappUrl,
          apiUrl: config.telegramApiUrl,
          repo: telegram,
        })
      : null;
  return {
    config,
    db,
    users: new UsersRepo(db),
    sessions: new SessionsRepo(db, config.sessionTtlMs),
    tracks: new TracksRepo(db),
    storage: createStorage(path.join(config.dataDir, 'uploads')),
    uploadTmpDir: path.join(config.dataDir, 'tmp'),
    telegram,
    bot,
    notifier: deps.notifier ?? bot,
  };
}
