import { clsx } from 'clsx';

/** Wordmark. Chrome gradient text with a slow shine. */
export function Logo({ className, plain }: { className?: string; plain?: boolean }) {
  return (
    <span
      className={clsx(
        'font-display font-black uppercase leading-none tracking-[-0.04em]',
        plain ? 'text-chrome' : 'chrome-text',
        className,
      )}
      aria-label="MUSICRATE"
    >
      MUSIC
      <span className={plain ? 'text-acid' : 'acid-text'}>RATE</span>
    </span>
  );
}
