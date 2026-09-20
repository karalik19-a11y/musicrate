/**
 * Telegram Mini App integration.
 *
 * The official SDK (`telegram-web-app.js`, loaded from index.html) defines
 * `window.Telegram.WebApp` in every environment, but it is only *live* when
 * the page was actually launched from Telegram. `detectTelegram()` tells the
 * two cases apart, and every helper below is a guarded no-op otherwise — the
 * app must keep working as a plain website.
 */

interface TgBackButton {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

interface TgHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

interface TgWebApp {
  version: string;
  platform: string;
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name?: string; last_name?: string; username?: string };
    start_param?: string;
  };
  isExpanded: boolean;
  BackButton: TgBackButton;
  HapticFeedback: TgHapticFeedback;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

/** The live SDK instance, or null when not running inside Telegram. */
export function detectTelegram(): TgWebApp | null {
  if (typeof window === 'undefined') return null;
  const app = window.Telegram?.WebApp;
  if (!app) return null;
  // Outside Telegram the SDK reports platform "unknown" and initData is empty.
  const launched = app.platform ? app.platform !== 'unknown' : Boolean(app.initData);
  return launched ? app : null;
}

/** True while the app runs as a Telegram mini app. */
export function inTelegram(): boolean {
  return detectTelegram() !== null;
}

/**
 * Bootstraps the mini-app shell. Call once, before React mounts:
 * ready() removes Telegram's loading placeholder, expand() goes fullscreen,
 * and the header/footer blend into the app's own ink background.
 */
export function setupTelegram(): void {
  const app = detectTelegram();
  if (!app) return;
  const attempt = (label: string, fn: () => void) => {
    try {
      fn();
    } catch {
      /* older Telegram clients reject newer methods — cosmetic only */
      void label;
    }
  };

  attempt('ready', () => app.ready());
  attempt('expand', () => app.expand());
  // Don't let a scroll gesture close the whole app.
  attempt('swipes', () => app.disableVerticalSwipes());
  // Match the app's ink background so Telegram's chrome melts away.
  attempt('colors', () => {
    app.setHeaderColor('#060607');
    app.setBackgroundColor('#060607');
  });
}

/**
 * Reads a Telegram start_param from every place it can appear:
 * - ?tgWebAppStartParam= in query (web_app button with ?tgWebAppStartParam=)
 * - #tgWebAppStartParam= in hash (Telegram's own injection)
 * - window.Telegram.WebApp.initDataUnsafe.start_param (t.me direct links)
 * Returns raw string or empty.
 */
export function telegramStartParam(): string {
  if (typeof window === 'undefined') return '';
  try {
    const search = new URLSearchParams(window.location.search);
    const fromSearch =
      search.get('tgWebAppStartParam') ||
      search.get('tgWebAppStart_param') ||
      search.get('startapp') ||
      search.get('start_param') ||
      '';
    if (fromSearch) return fromSearch;
  } catch {
    /* ignore */
  }
  try {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const fromHash =
        hashParams.get('tgWebAppStartParam') ||
        hashParams.get('tgWebAppStart_param') ||
        hashParams.get('startapp') ||
        hashParams.get('start_param') ||
        '';
      if (fromHash) return fromHash;
    }
  } catch {
    /* hash may contain #/track/... which is not URLSearchParams-valid — ignore */
  }
  try {
    const unsafe = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (unsafe) return unsafe;
  } catch {
    /* ignore */
  }
  return '';
}

/** Extracts a track id from a start_param like "track_<id>" or plain "<id>". */
export function trackIdFromStartParam(param: string): string | null {
  if (!param) return null;
  const trimmed = param.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('track_')) {
    const id = trimmed.slice(6);
    return id || null;
  }
  // Heuristic: if param looks like a track id (no spaces, reasonable length), treat as id
  // Track ids in this app are typically uuid-ish or short; we accept any non-empty without '/'
  if (/^[a-zA-Z0-9_-]{6,64}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Telegram injects its launch data into location.hash as
 * #tgWebAppData=...&tgWebAppVersion=... This collides with hash routing
 * (#/track/123) — the router would see "tgWebAppData=..." as a route and
 * render NotFound ("LOST IN THE MIX").
 *
 * Call this *after* telegram-web-app.js has run (it already read the hash)
 * but *before* the router is created. It rewrites the hash to a valid app
 * route, preserving deep links encoded in tgWebAppStartParam.
 */
export function normalizeTelegramHash(): void {
  if (typeof window === 'undefined') return;
  const { hash, pathname, search } = window.location;
  if (!hash) return;

  // If hash is already a valid app route, keep it — but it might also contain
  // Telegram params appended with &, e.g. "#/track/abc&tgWebAppData=..."
  // Extract the leading "/..." part.
  if (hash.startsWith('#/')) {
    const m = hash.match(/^#(\/[^&?#]*)/);
    if (m) {
      const route = m[1];
      // If there are extra & params after route, strip them (Telegram data already consumed by SDK)
      if (hash !== `#${route}`) {
        const newUrl = pathname + search + `#${route}`;
        try {
          window.history.replaceState(null, '', newUrl);
        } catch {
          window.location.hash = `#${route}`;
        }
      }
      return;
    }
  }

  // At this point hash is not a valid app route. Check if it's Telegram's launch params.
  const isTelegramHash = hash.includes('tgWebAppData') || hash.includes('tgWebAppVersion') || hash.includes('tgWebAppPlatform') || hash.includes('tgWebAppStartParam');
  if (!isTelegramHash) return;

  // Try to recover deep link from start_param
  const rawParam = telegramStartParam();
  const trackId = rawParam ? trackIdFromStartParam(rawParam) : null;
  if (trackId) {
    const newHash = `#/track/${encodeURIComponent(trackId)}`;
    const newUrl = pathname + search + newHash;
    try {
      window.history.replaceState(null, '', newUrl);
    } catch {
      window.location.hash = newHash;
    }
    return;
  }

  // No deep link — default to root. Hash router treats "#/" as "/".
  // Only replace if current hash is not already "#/" to avoid loop.
  if (hash !== '#/' && hash !== '#') {
    const newUrl = pathname + search + '#/';
    try {
      window.history.replaceState(null, '', newUrl);
    } catch {
      window.location.hash = '#/';
    }
  }
}

/** The Telegram user's first name, if Telegram shared it — for prefilling. */
export function telegramFirstName(maxLength = 40): string {
  const app = detectTelegram();
  const name = app?.initDataUnsafe.user?.first_name?.trim();
  return name ? name.slice(0, maxLength) : '';
}

/**
 * Haptics through Telegram when available.
 * @returns true when Telegram handled it (skip the navigator.vibrate fallback).
 */
export function telegramHaptic(pattern: number | number[]): boolean {
  const app = detectTelegram();
  if (!app) return false;
  try {
    if (Array.isArray(pattern)) app.HapticFeedback.notificationOccurred('success');
    else app.HapticFeedback.impactOccurred(pattern >= 20 ? 'medium' : 'light');
    return true;
  } catch {
    return false;
  }
}
