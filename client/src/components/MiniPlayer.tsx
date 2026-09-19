import { Pause, Play, SkipForward } from 'lucide-react';
import { motion } from 'motion/react';
import { tap } from '@/lib/haptics';
import { usePlayer } from '@/stores/player';
import { CoverArt } from './CoverArt';
import { Spinner } from './ui/Spinner';

/** Persistent bar above the tab bar. Tap to expand into the full player. */
export function MiniPlayer() {
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const status = usePlayer((s) => s.status);
  const progress = usePlayer((s) => (s.duration ? s.currentTime / s.duration : 0));
  const hasNext = usePlayer((s) => s.index < s.queue.length - 1);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const openSheet = usePlayer((s) => s.openSheet);

  if (!track) return null;
  const playing = status === 'playing';

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="pointer-events-auto mx-auto w-full max-w-lg px-3 pb-2"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Открыть плеер"
        onClick={() => openSheet()}
        onKeyDown={(e) => e.key === 'Enter' && openSheet()}
        className="relative flex h-16 cursor-pointer items-center gap-3 overflow-hidden rounded-[22px] pl-2 pr-2 glass-strong shadow-soft"
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/8">
          <div
            className="h-full bg-acid transition-[width] duration-300 ease-linear"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <CoverArt seed={track.coverSeed} title={track.title} className="size-12" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[14px] font-bold leading-tight text-chrome">{track.title}</p>
          <p className="truncate text-[12px] text-fog">{track.artistName}</p>
        </div>
        <motion.button
          type="button"
          aria-label={playing ? 'Пауза' : 'Играть'}
          whileTap={{ scale: 0.86 }}
          onClick={(e) => {
            e.stopPropagation();
            tap();
            toggle();
          }}
          className="grid size-11 place-items-center rounded-full bg-chrome text-ink"
        >
          {status === 'loading' ? (
            <Spinner className="size-5" />
          ) : playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" />
          )}
        </motion.button>
        <motion.button
          type="button"
          aria-label="Следующий"
          whileTap={{ scale: 0.86 }}
          disabled={!hasNext}
          onClick={(e) => {
            e.stopPropagation();
            tap();
            next();
          }}
          className="grid size-11 place-items-center rounded-full text-silver disabled:opacity-30"
        >
          <SkipForward className="size-5 fill-current" />
        </motion.button>
      </div>
    </motion.div>
  );
}
