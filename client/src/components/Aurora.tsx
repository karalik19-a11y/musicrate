import { clsx } from 'clsx';

/** Slow drifting light blobs used behind the entry screens. */
export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  return (
    <div aria-hidden className={clsx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="absolute -left-1/4 top-[-10%] size-[70vmax] rounded-full blur-[110px] animate-drift-1"
        style={{ background: 'radial-gradient(circle, rgba(123,92,255,0.55) 0%, rgba(123,92,255,0) 60%)', opacity: 0.8 * intensity }}
      />
      <div
        className="absolute right-[-30%] top-[20%] size-[60vmax] rounded-full blur-[120px] animate-drift-2"
        style={{ background: 'radial-gradient(circle, rgba(255,61,143,0.45) 0%, rgba(255,61,143,0) 60%)', opacity: 0.7 * intensity }}
      />
      <div
        className="absolute bottom-[-30%] left-[10%] size-[60vmax] rounded-full blur-[120px] animate-drift-3"
        style={{ background: 'radial-gradient(circle, rgba(215,255,63,0.30) 0%, rgba(215,255,63,0) 60%)', opacity: 0.7 * intensity }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-ink" />
    </div>
  );
}
