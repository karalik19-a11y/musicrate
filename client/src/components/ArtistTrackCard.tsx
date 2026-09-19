import { Ellipsis } from 'lucide-react';
import type { Track } from '@shared/types';
import { formatScore, playsLabel, ratingsLabel } from '@/lib/format';
import { COMPONENTS } from './ScoreCard';
import { TrackRow } from './TrackRow';

/** Studio list item: the public rating and stats the artist cares about. */
export function ArtistTrackCard({ track, queue, onMore }: { track: Track; queue?: Track[]; onMore: (track: Track) => void }) {
  return (
    <TrackRow
      track={track}
      queue={queue}
      trailing={
        <button
          type="button"
          aria-label="Действия"
          onClick={(e) => {
            e.stopPropagation();
            onMore(track);
          }}
          className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-silver active:bg-white/10"
        >
          <Ellipsis className="size-5" />
        </button>
      }
      footer={
        <div className="mt-3 rounded-2xl bg-black/25 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2 text-[12px] text-fog">
            <span>{track.rating.count ? ratingsLabel(track.rating.count) : 'Оценок пока нет'}</span>
            <span className="tabular">{playsLabel(track.plays)}</span>
          </div>
          {track.rating.count > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {COMPONENTS.map((c) => (
                <div key={c.key} className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${c.accent}`} />
                    <span className="truncate text-[10px] uppercase tracking-wider text-fog">{c.label}</span>
                  </div>
                  <p className="mt-0.5 font-display text-[13px] font-bold tabular text-chrome">{formatScore(track.rating[c.key])}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
