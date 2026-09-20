/**
 * Minimal Telegram Bot API client: plain `fetch`, JSON in/out, no SDK.
 * Node ≥ 20 ships a global fetch, so the bot costs zero new dependencies.
 */

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description?: string,
  ) {
    super(`Telegram ${method} failed: ${status}${description ? ` — ${description}` : ''}`);
    this.name = 'TelegramApiError';
  }

  /** 409: another getUpdates poller (or a webhook) owns this bot. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** 401/404: the token is not a valid bot token. */
  get isInvalidToken(): boolean {
    return this.status === 401 || this.status === 404;
  }
}

export class TelegramApi {
  constructor(
    private readonly token: string,
    /** Aborted by TelegramBot.stop() so in-flight long polls drop immediately. */
    private readonly stopSignal: AbortSignal,
    /** Bot API origin: api.telegram.org, or a self-hosted local Bot API server. */
    private readonly baseUrl = 'https://api.telegram.org',
  ) {}

  /**
   * Calls a Bot API method. `timeoutMs` must comfortably exceed the long-poll
   * window for getUpdates; for everything else the default is plenty.
   */
  async call<T = unknown>(method: string, payload: Record<string, unknown> = {}, timeoutMs = 20_000): Promise<T> {
    // AbortSignal.any keeps both "user pressed Ctrl+C" and "request took too
    // long" in play; available since Node 20.3 (engines require ≥ 20.19).
    const signal =
      typeof AbortSignal.any === 'function'
        ? AbortSignal.any([this.stopSignal, AbortSignal.timeout(timeoutMs)])
        : this.stopSignal;

    const res = await fetch(`${this.baseUrl}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
      error_code?: number;
    };
    if (!res.ok || !body.ok) {
      throw new TelegramApiError(method, body.error_code ?? res.status, body.description);
    }
    return body.result as T;
  }
}
