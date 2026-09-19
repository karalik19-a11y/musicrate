import { WAVEFORM_BARS } from '@shared/types';

/** Deterministic PRNG (mulberry32) so a fallback waveform is stable per track. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Used when the client could not decode the audio (e.g. unsupported codec). */
export function fallbackWaveform(seed: string, bars = WAVEFORM_BARS): number[] {
  const rand = mulberry32(hashString(seed));
  const out: number[] = [];
  let level = 0.5;
  for (let i = 0; i < bars; i++) {
    level += (rand() - 0.5) * 0.35;
    level = Math.min(1, Math.max(0.15, level));
    const swell = 0.75 + 0.25 * Math.sin((i / bars) * Math.PI * 2 + rand());
    out.push(Number((level * swell).toFixed(3)));
  }
  return out;
}

/** Validates & normalizes a client-provided peak array. Returns null if unusable. */
export function sanitizeWaveform(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length < 16 || input.length > 512) return null;
  const nums = input.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;
  const max = Math.max(...nums, 0.0001);
  return nums.map((n) => Number(Math.min(1, Math.max(0, n / max)).toFixed(3)));
}
