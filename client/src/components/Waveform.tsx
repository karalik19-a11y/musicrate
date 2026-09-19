import { clsx } from 'clsx';
import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface WaveformProps {
  peaks: number[];
  /** 0..1 */
  progress?: number;
  /** Number of bars to draw (peaks are resampled). */
  bars?: number;
  className?: string;
  /** Highlight colour class for the played part. */
  accent?: string;
  /** Called with a 0..1 ratio when the user taps/drags. */
  onSeek?: (ratio: number) => void;
  /** Adds a glow to the played part. */
  active?: boolean;
  /** Minimum bar height ratio. */
  floor?: number;
}

function resample(peaks: number[], bars: number): number[] {
  if (!peaks.length) return Array.from({ length: bars }, () => 0.3);
  if (peaks.length === bars) return peaks;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = Math.floor((i / bars) * peaks.length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / bars) * peaks.length));
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j] ?? 0);
    out.push(max);
  }
  return out;
}

export function Waveform({
  peaks,
  progress = 0,
  bars = 48,
  className,
  accent = 'bg-acid',
  onSeek,
  active,
  floor = 0.12,
}: WaveformProps) {
  const data = useMemo(() => resample(peaks, bars), [peaks, bars]);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const ratioFromEvent = (e: ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  const handlers = onSeek
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onSeek(ratioFromEvent(e));
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (dragging.current) onSeek(ratioFromEvent(e));
        },
        onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
          dragging.current = false;
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        },
        onPointerCancel: () => {
          dragging.current = false;
        },
      }
    : {};

  const clip = `inset(0 ${(1 - Math.min(1, Math.max(0, progress))) * 100}% 0 0)`;

  const renderBars = (colorClass: string) => (
    <div className="flex h-full w-full items-center gap-[2px]">
      {data.map((p, i) => (
        <span
          key={i}
          className={clsx('block min-w-0 flex-1 rounded-full', colorClass)}
          style={{ height: `${Math.max(floor, p) * 100}%` }}
        />
      ))}
    </div>
  );

  return (
    <div
      ref={ref}
      className={clsx('relative w-full touch-none select-none', onSeek && 'cursor-pointer', className)}
      role={onSeek ? 'slider' : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      {...handlers}
    >
      <div className="absolute inset-0">{renderBars('bg-white/22')}</div>
      <div
        className={clsx('absolute inset-0 transition-[clip-path] duration-300 ease-linear', active && 'drop-shadow-[0_0_8px_rgba(215,255,63,0.55)]')}
        style={{ clipPath: clip, WebkitClipPath: clip }}
      >
        {renderBars(accent)}
      </div>
    </div>
  );
}
