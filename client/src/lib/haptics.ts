import { telegramHaptic } from '@/lib/telegram';

/**
 * Best-effort haptic tick: Telegram's native haptics inside the mini app,
 * `navigator.vibrate` elsewhere (Android Chrome; iOS Safari ignores it).
 */
export function tap(pattern: number | number[] = 8): void {
  if (telegramHaptic(pattern)) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
