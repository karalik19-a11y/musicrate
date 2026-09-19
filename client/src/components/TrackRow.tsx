import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import type { Track } from '@shared/types';
import { formatDate, formatTime } from '@/lib/format';
import { useIsCurrent, usePlayer } from '@/stores/player';
import { CoverArt } from './CoverArt';
import { PlayButton } from './PlayButton';
import { RatingBadge } from './RatingBadge';
import { Waveform } from './Waveform';

interface TrackRowProps {
  track: Track;
  queue?: Track[];
  className?: string;
  /** Slot rendered at the far right (e.g. the ••• menu button). */
  trailing?: React.ReactNode;
  /** Extra content below the meta row (artist stats). */
  footer?: React.ReactNode;
}

/** Compact list item used in Discover, artist studio and Home sections. */
export function TrackRow({ track, queue, className, trailing, footer }: TrackRowProps) {
  const navigate = useNavigate();
  const { isCurrent } = useIsCurrent(track.id);
  const progress = usePlayer((s) => (isCurrent && s.duration ? s.currentTime / s.duration : 0));

  return (
    <motion.article
      layout
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onClick={() => navigate(`/track/${track.id}`)}
      className={clsx(
        'relative flex cursor-pointer gap-3.5 rounded-[22px] p-3 glass transition-colors',
        isCurrent && 'border-white/14 bg-graphite-2/80',
        className,
      )}
    >
      <div className="relative shrink-0">
        <CoverArt seed={track.coverSeed} title={track.title} className="size-[72px]" rounded="rounded-2xl" />
        <PlayButton
          track={track}
          queue={queue}
          size="sm"
          variant={isCurrent ? 'acid' : 'chrome'}
          className="absolute -bottom-1.5 -right-1.5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-bold leading-tight text-chrome">{track.title}</h3>
            <p className="mt-0.5 truncate text-[13px] text-fog">{track.artistName}</p>
          </div>
          {trailing}
        </div>
        <Waveform
          peaks={track.waveform}
          bars={40}
          progress={progress}
          active={isCurrent}
          className="mt-2 h-6"
          accent={isCurrent ? 'bg-acid' : 'bg-silver'}
        />
        <div className="mt-2 flex items-center gap-2 text-[11px] text-fog">
          <span className="tabular">{formatTime(track.duration)}</span>
          <span className="opacity-40">•</span>
          <span>{formatDate(track.createdAt)}</span>
          <RatingBadge rating={track.rating} className="ml-auto" />
        </div>
        {footer}
      </div>
    </motion.article>
  );
}
