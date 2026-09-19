import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import type { Track } from '@shared/types';
import { formatTime } from '@/lib/format';
import { useIsCurrent, usePlayer } from '@/stores/player';
import { CoverArt } from './CoverArt';
import { PlayButton } from './PlayButton';
import { RatingBadge } from './RatingBadge';
import { Waveform } from './Waveform';

/** Big cover card for the horizontal "NEW DROPS" rail. */
export function TrackHero({ track, queue, className }: { track: Track; queue?: Track[]; className?: string }) {
  const navigate = useNavigate();
  const { isCurrent } = useIsCurrent(track.id);
  const progress = usePlayer((s) => (isCurrent && s.duration ? s.currentTime / s.duration : 0));

  return (
    <motion.article
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={() => navigate(`/track/${track.id}`)}
      className={clsx('relative w-[248px] shrink-0 cursor-pointer snap-start', className)}
    >
      <div className="relative">
        <CoverArt seed={track.coverSeed} title={track.title} rounded="rounded-[26px]" hero className="shadow-soft" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-[26px] bg-gradient-to-t from-black/75 to-transparent" />
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[17px] font-extrabold leading-tight text-white">{track.title}</h3>
            <p className="truncate text-[13px] text-white/70">{track.artistName}</p>
          </div>
          <PlayButton track={track} queue={queue} size="md" variant={isCurrent ? 'acid' : 'chrome'} />
        </div>
        <RatingBadge rating={track.rating} className="absolute left-4 top-4 backdrop-blur-md" showCount={false} />
      </div>
      <div className="mt-3 flex items-center gap-3 px-1">
        <Waveform peaks={track.waveform} bars={36} progress={progress} active={isCurrent} className="h-5 flex-1" accent={isCurrent ? 'bg-acid' : 'bg-silver'} />
        <span className="font-mono text-[11px] tabular text-fog">{formatTime(track.duration)}</span>
      </div>
    </motion.article>
  );
}
