/** Best-effort haptic tick (Android Chrome). iOS Safari ignores it silently. */
export function tap(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
