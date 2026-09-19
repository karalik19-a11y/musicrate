import { clsx } from 'clsx';
import { Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Track } from '@shared/types';
import { tap } from '@/lib/haptics';
import { useIsCurrent, usePlayer } from '@/stores/player';
import { Spinner } from './ui/Spinner';

interface PlayButtonProps {
  track: Track;
  queue?: Track[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'chrome' | 'acid' | 'glass';
  className?: string;
}

const dims = { sm: 'size-10', md: 'size-12', lg: 'size-16', xl: 'size-[76px]' };
const icons = { sm: 'size-4', md: 'size-5', lg: 'size-7', xl: 'size-8' };

export function PlayButton({ track, queue, size = 'md', variant = 'chrome', className }: PlayButtonProps) {
  const { isPlaying, isLoading } = useIsCurrent(track.id);
  const play = usePlayer((s) => s.play);

  return (
    <motion.button
      type="button"
      aria-label={isPlaying ? 'Пауза' : 'Играть'}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 600, damping: 26 }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        tap();
        play(track, queue);
      }}
      className={clsx(
        'relative grid shrink-0 place-items-center rounded-full',
        variant === 'chrome' && 'bg-chrome text-ink shadow-[0_8px_30px_-10px_rgba(255,255,255,0.6)]',
        variant === 'acid' && 'bg-acid text-ink shadow-glow-acid',
        variant === 'glass' && 'glass text-chrome',
        dims[size],
        className,
      )}
    >
      {isPlaying && (
        <span aria-hidden className="absolute inset-0 rounded-full bg-current/25 animate-pulse-ring" />
      )}
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Spinner className={icons[size]} />
          </motion.span>
        ) : isPlaying ? (
          <motion.span
            key="pause"
            initial={{ scale: 0.6, opacity: 0, rotate: -40 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, rotate: 40 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          >
            <Pause className={clsx(icons[size], 'fill-current')} />
          </motion.span>
        ) : (
          <motion.span
            key="play"
            initial={{ scale: 0.6, opacity: 0, rotate: 40 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0, rotate: -40 }}
            transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            className="translate-x-[6%]"
          >
            <Play className={clsx(icons[size], 'fill-current')} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
