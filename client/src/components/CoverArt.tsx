import { clsx } from 'clsx';
import { useMemo } from 'react';
import { coverBackground, coverSpec, hexAlpha, type CoverSpec } from '@/lib/cover';

interface CoverArtProps {
  seed: string;
  title: string;
  className?: string;
  /** Rounded corner radius class. */
  rounded?: string;
  /** Show the big glyph (first letter of the title). */
  glyph?: boolean;
  /** Bigger pattern + shine for hero sizes. */
  hero?: boolean;
}

function Pattern({ spec }: { spec: CoverSpec }) {
  const accent = spec.palette.accents[0];
  const stroke = hexAlpha('#ffffff', 0.55);
  switch (spec.pattern) {
    case 'rings':
      return (
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {[46, 38, 30, 22, 14].map((r, i) => (
            <circle key={r} cx="62" cy="58" r={r} fill="none" stroke={i % 2 ? stroke : accent} strokeOpacity={0.35} strokeWidth={0.6} />
          ))}
          <circle cx="62" cy="58" r="4" fill={accent} fillOpacity={0.7} />
        </svg>
      );
    case 'stripes':
      return (
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => (
            <line
              key={i}
              x1={-20 + i * 16}
              y1="110"
              x2={40 + i * 16}
              y2="-10"
              stroke={i % 3 === 0 ? accent : stroke}
              strokeOpacity={0.28}
              strokeWidth={i % 3 === 0 ? 1.4 : 0.5}
            />
          ))}
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {Array.from({ length: 36 }).map((_, i) => {
            const x = 12 + (i % 6) * 15;
            const y = 12 + Math.floor(i / 6) * 15;
            const r = 0.8 + ((i * 7) % 5) * 0.55;
            return <circle key={i} cx={x} cy={y} r={r} fill={i % 5 === 0 ? accent : '#fff'} fillOpacity={0.35} />;
          })}
        </svg>
      );
    case 'arcs':
      return (
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {[20, 34, 48, 62, 76].map((r, i) => (
            <path
              key={r}
              d={`M ${100 - r} 100 A ${r} ${r} 0 0 0 100 ${100 - r}`}
              fill="none"
              stroke={i % 2 ? accent : stroke}
              strokeOpacity={0.4}
              strokeWidth={0.8}
            />
          ))}
        </svg>
      );
    case 'grid':
      return (
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <g key={i}>
              <line x1={i * 16.6} y1="0" x2={i * 16.6} y2="100" stroke={stroke} strokeOpacity={0.18} strokeWidth={0.4} />
              <line x1="0" y1={i * 16.6} x2="100" y2={i * 16.6} stroke={stroke} strokeOpacity={0.18} strokeWidth={0.4} />
            </g>
          ))}
          <rect x="49.8" y="16" width="34" height="34" fill="none" stroke={accent} strokeOpacity={0.6} strokeWidth={0.8} />
        </svg>
      );
    default:
      return null;
  }
}

export function CoverArt({ seed, title, className, rounded = 'rounded-2xl', glyph = true, hero }: CoverArtProps) {
  const spec = useMemo(() => coverSpec(seed), [seed]);
  const background = useMemo(() => coverBackground(spec), [spec]);
  const letter = (title.trim()[0] ?? '♪').toUpperCase();
  const glyphClass =
    spec.palette.glyph === 'acid'
      ? 'text-acid'
      : 'bg-[linear-gradient(160deg,#ffffff_0%,#c9c9d2_45%,#ffffff_60%,#8c8c98_100%)] bg-clip-text text-transparent';

  return (
    <div
      className={clsx('@container relative aspect-square overflow-hidden select-none grain-local', rounded, className)}
      style={{ background }}
      aria-hidden
    >
      <Pattern spec={spec} />
      {/* top-left light sweep */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_38%)]" />
      {glyph && (
        <span
          className={clsx(
            'absolute font-display font-black leading-none',
            glyphClass,
            spec.glyphAlign === 'center' && 'inset-0 grid place-items-center',
            spec.glyphAlign === 'bl' && 'bottom-[6%] left-[8%]',
            spec.glyphAlign === 'br' && 'bottom-[6%] right-[8%]',
          )}
          style={{ fontSize: hero ? '50cqw' : '46cqw' }}
        >
          {letter}
        </span>
      )}
      {/* subtle inner border */}
      <div className={clsx('pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10', rounded)} />
    </div>
  );
}
