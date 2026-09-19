/**
 * Procedural cover art. Every track gets a deterministic, unique look from
 * its cover seed — no image storage needed, and it renders instantly.
 */

export interface CoverSpec {
  palette: Palette;
  angle: number;
  blobs: Array<{ x: number; y: number; r: number; color: string; alpha: number }>;
  pattern: 'rings' | 'stripes' | 'dots' | 'arcs' | 'grid' | 'none';
  glyphAlign: 'bl' | 'br' | 'center';
}

export interface Palette {
  name: string;
  base: [string, string];
  accents: [string, string];
  glyph: 'chrome' | 'acid' | 'ink';
}

export const PALETTES: Palette[] = [
  { name: 'violet-night', base: ['#2b1466', '#0a0a12'], accents: ['#7b5cff', '#ff3d8f'], glyph: 'chrome' },
  { name: 'acid', base: ['#1d2f00', '#050605'], accents: ['#d7ff3f', '#2affc0'], glyph: 'chrome' },
  { name: 'ember', base: ['#3f100a', '#0b0606'], accents: ['#ff6a3d', '#ff3d8f'], glyph: 'chrome' },
  { name: 'ice-chrome', base: ['#1b2433', '#06070a'], accents: ['#6fd6ff', '#ececf1'], glyph: 'chrome' },
  { name: 'gold', base: ['#3b2a06', '#0b0904'], accents: ['#ffd166', '#ff8c42'], glyph: 'chrome' },
  { name: 'magenta', base: ['#41092c', '#0a0509'], accents: ['#ff3d8f', '#7b5cff'], glyph: 'chrome' },
  { name: 'teal', base: ['#063a3a', '#040a0a'], accents: ['#2affc0', '#6fd6ff'], glyph: 'chrome' },
  { name: 'mono', base: ['#2c2c31', '#050506'], accents: ['#ececf1', '#8c8c98'], glyph: 'acid' },
  { name: 'blood-orange', base: ['#4a1a00', '#0c0704'], accents: ['#ff8c42', '#d7ff3f'], glyph: 'chrome' },
  { name: 'deep-blue', base: ['#0a1e5c', '#04060f'], accents: ['#3d7bff', '#6fd6ff'], glyph: 'chrome' },
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

const PATTERNS: CoverSpec['pattern'][] = ['rings', 'stripes', 'dots', 'arcs', 'grid', 'none', 'rings', 'arcs'];

export function coverSpec(seed: string): CoverSpec {
  const h = hash(seed);
  const rand = rng(h);
  const palette = PALETTES[h % PALETTES.length]!;
  const angle = Math.round(rand() * 360);
  const blobs = Array.from({ length: 3 }, (_, i) => ({
    x: Math.round(rand() * 100),
    y: Math.round(rand() * 100),
    r: 45 + Math.round(rand() * 40),
    color: palette.accents[i % 2]!,
    alpha: 0.45 + rand() * 0.35,
  }));
  return {
    palette,
    angle,
    blobs,
    pattern: PATTERNS[Math.floor(rand() * PATTERNS.length)]!,
    glyphAlign: (['bl', 'br', 'center'] as const)[Math.floor(rand() * 3)]!,
  };
}

/** CSS background string for the cover base. */
export function coverBackground(spec: CoverSpec): string {
  const blobs = spec.blobs
    .map((b) => `radial-gradient(circle at ${b.x}% ${b.y}%, ${hexAlpha(b.color, b.alpha)} 0%, transparent ${b.r}%)`)
    .join(', ');
  return `${blobs}, linear-gradient(${spec.angle}deg, ${spec.palette.base[0]} 0%, ${spec.palette.base[1]} 100%)`;
}

export function hexAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = Number.parseInt(v.slice(0, 2), 16);
  const g = Number.parseInt(v.slice(2, 4), 16);
  const b = Number.parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

/** Avatar gradient from a user name. */
export function nameGradient(name: string): string {
  const p = PALETTES[hash(name) % PALETTES.length]!;
  return `linear-gradient(135deg, ${p.accents[0]} 0%, ${p.accents[1]} 100%)`;
}

/** Renders the cover to a PNG data URL (used for lock-screen artwork). */
export function coverToDataUrl(seed: string, size = 512): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const spec = coverSpec(seed);
  const rad = (spec.angle * Math.PI) / 180;
  const grad = ctx.createLinearGradient(
    size / 2 - Math.cos(rad) * size,
    size / 2 - Math.sin(rad) * size,
    size / 2 + Math.cos(rad) * size,
    size / 2 + Math.sin(rad) * size,
  );
  grad.addColorStop(0, spec.palette.base[0]);
  grad.addColorStop(1, spec.palette.base[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (const b of spec.blobs) {
    const g = ctx.createRadialGradient(
      (b.x / 100) * size,
      (b.y / 100) * size,
      0,
      (b.x / 100) * size,
      (b.y / 100) * size,
      (b.r / 100) * size,
    );
    g.addColorStop(0, hexAlpha(b.color, b.alpha));
    g.addColorStop(1, hexAlpha(b.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas.toDataURL('image/png');
}
