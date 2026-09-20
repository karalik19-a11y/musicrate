import type { Track } from '@shared/types';
import type { TelegramRepo } from '../repos/telegram.js';
import { TelegramApi, TelegramApiError } from './api.js';
import { appButtonUrl, helpMessage, newTrackMessage, trackButtonUrl, welcomeMessage } from './messages.js';
import type { NewTrackNotifier } from './notifier.js';

/* ------------------------- Bot API wire types ------------------------- */

interface TgUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  username?: string;
}

interface TgChat {
  id: number;
  type: string;
}

interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  my_chat_member?: {
    chat: TgChat;
    from: TgUser;
    new_chat_member: { status: string };
  };
}

/** One keyboard: a single wide button that opens the web app. */
type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>> };

const POLL_SECONDS = 25;
const SEND_PAUSE_MS = 50; // ≤ 20 msg/s: safely under Telegram's 30 msg/s global limit

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The MUSICRATE Telegram bot.
 *
 * • Long-polls getUpdates — no public HTTPS URL or webhook registration is
 *   needed, so it works from localhost, Docker, Render, anywhere.
 * • /start subscribes the chat and answers with an "open the app" button.
 * • Every published track is announced to all subscribers with a button that
 *   deep-links straight to that track inside the mini app.
 *
 * Created only when TELEGRAM_BOT_TOKEN is set; without a token the server
 * behaves exactly as before.
 */
export class TelegramBot implements NewTrackNotifier {
  private readonly api: TelegramApi;
  private readonly webappUrl: string;
  private readonly repo: TelegramRepo;
  private readonly stopController = new AbortController();
  private running = false;
  private offset = 0;
  private username = '';

  constructor(options: { token: string; webappUrl: string; repo: TelegramRepo; apiUrl?: string }) {
    this.api = new TelegramApi(options.token, this.stopController.signal, options.apiUrl);
    this.webappUrl = options.webappUrl;
    this.repo = options.repo;
  }

  /** Validates the token, clears any webhook, then starts polling forever. */
  async start(): Promise<void> {
    if (this.running) return;
    try {
      const me = await this.api.call<{ username: string }>('getMe');
      this.username = me.username;
    } catch (err) {
      if (err instanceof TelegramApiError && err.isInvalidToken) {
        console.error('[telegram] TELEGRAM_BOT_TOKEN was rejected by Telegram — bot disabled. Get a token from @BotFather.');
      } else {
        console.error('[telegram] could not reach Telegram — bot disabled:', err instanceof Error ? err.message : err);
      }
      return;
    }

    if (!/^https:\/\//i.test(this.webappUrl)) {
      console.warn(`[telegram] TELEGRAM_WEBAPP_URL is not HTTPS — Telegram only opens HTTPS mini apps: ${this.webappUrl}`);
    }

    // Polling and webhooks are mutually exclusive; a leftover webhook would
    // starve getUpdates. Best effort — failures are logged, not fatal.
    await this.try('deleteWebhook', () => this.api.call('deleteWebhook', { drop_pending_updates: false }));
    // Persistent 🎧 button next to the message input. Best effort too: some
    // clients/bots need the menu button configured via @BotFather instead.
    await this.try('setChatMenuButton', () =>
      this.api.call('setChatMenuButton', {
        menu_button: { type: 'web_app', text: 'MUSICRATE', web_app: { url: appButtonUrl(this.webappUrl) } },
      }),
    );

    this.running = true;
    const subscribers = await this.repo.count().catch(() => 0);
    console.log(`[telegram] bot @${this.username} is up · web app: ${this.webappUrl} · subscribers: ${subscribers}`);
    void this.loop();
  }

  /** Aborts the in-flight long poll; the loop exits on the next iteration. */
  async stop(): Promise<void> {
    this.running = false;
    this.stopController.abort();
  }

  /** Diagnostics for GET /api/telegram/status (no secrets). */
  status(): { running: boolean; username: string | null } {
    return {
      running: this.running,
      username: this.username ? `@${this.username}` : null,
    };
  }

  /**
   * Announces a freshly published track to every subscriber. Called
   * fire-and-forget from the publish route, so this never throws.
   */
  async notifyNewTrack(track: Track): Promise<void> {
    if (!this.running) return;
    let chatIds: number[] = [];
    try {
      chatIds = await this.repo.listChatIds();
    } catch (err) {
      console.error('[telegram] could not load subscribers:', err instanceof Error ? err.message : err);
      return;
    }
    if (chatIds.length === 0) return;

    const text = newTrackMessage(track);
    const replyMarkup: InlineKeyboard = {
      inline_keyboard: [[{ text: '🎧 Открыть трек', web_app: { url: trackButtonUrl(this.webappUrl, track.id) } }]],
    };

    let sent = 0;
    for (const chatId of chatIds) {
      try {
        await this.api.call('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup });
        sent++;
      } catch (err) {
        if (err instanceof TelegramApiError && err.status === 403) {
          // The user blocked the bot — forget them quietly.
          await this.repo.unsubscribe(chatId).catch(() => {});
        } else {
          console.error(`[telegram] could not notify chat ${chatId}:`, err instanceof Error ? err.message : err);
        }
      }
      await sleep(SEND_PAUSE_MS);
    }
    console.log(`[telegram] notified ${sent}/${chatIds.length} subscriber(s) about “${track.title}”`);
  }

  /* ------------------------------ internals ------------------------------ */

  private async loop(): Promise<void> {
    let backoffMs = 1_000;
    while (this.running) {
      try {
        const updates = await this.api.call<TgUpdate[]>(
          'getUpdates',
          { offset: this.offset, timeout: POLL_SECONDS, allowed_updates: ['message', 'my_chat_member'] },
          (POLL_SECONDS + 10) * 1_000,
        );
        backoffMs = 1_000;
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (err) {
        if (!this.running) break; // stopped via stop()
        if (err instanceof TelegramApiError && err.isInvalidToken) {
          console.error('[telegram] token revoked mid-flight — bot stopped.');
          return;
        }
        if (err instanceof TelegramApiError && err.isConflict) {
          console.error('[telegram] 409: another process is already polling this bot. Run only one server per bot token.');
        } else {
          console.error('[telegram] poll failed, retrying:', err instanceof Error ? err.message : err);
        }
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
      }
    }
  }

  private async handleUpdate(update: TgUpdate): Promise<void> {
    // Subscribe/unsubscribe lifecycle: a user blocking the bot (or Telegram
    // deleting the chat) removes the subscription without a /stop.
    if (update.my_chat_member) {
      const status = update.my_chat_member.new_chat_member.status;
      if (status === 'kicked' || status === 'left') {
        await this.repo.unsubscribe(update.my_chat_member.chat.id).catch(() => {});
      }
      return;
    }

    const message = update.message;
    if (!message || message.chat.type !== 'private') return;
    const text = (message.text ?? '').trim();
    const chatId = message.chat.id;
    const from = message.from;

    if (text.split(/\s+/)[0] === '/start') {
      await this.repo
        .subscribe(chatId, { firstName: from?.first_name, username: from?.username })
        .catch((err) => console.error('[telegram] subscribe failed:', err));
      await this.send(chatId, welcomeMessage(from?.first_name), this.appKeyboard());
    } else if (text.split(/\s+/)[0] === '/stop') {
      const removed = await this.repo.unsubscribe(chatId).catch(() => false);
      await this.send(
        chatId,
        removed === false
          ? 'Рассылка и так выключена. Включить снова: /start'
          : 'Рассылка остановлена — новых сообщений не будет. Вернуть: /start',
      );
    } else {
      await this.send(chatId, helpMessage(), this.appKeyboard());
    }
  }

  private appKeyboard(): InlineKeyboard {
    return { inline_keyboard: [[{ text: '▶️ Открыть MUSICRATE', web_app: { url: appButtonUrl(this.webappUrl) } }]] };
  }

  private async send(chatId: number, text: string, replyMarkup?: InlineKeyboard): Promise<void> {
    await this.try('sendMessage', () =>
      this.api.call('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
    );
  }

  /** Best-effort call: log and continue on failure. */
  private async try(method: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      if (this.running || method === 'getMe') {
        console.error(`[telegram] ${method} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }
}
