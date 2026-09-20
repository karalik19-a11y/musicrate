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
