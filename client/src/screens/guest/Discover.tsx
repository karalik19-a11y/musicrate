import { clsx } from 'clsx';
import { Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useDeferredValue, useState } from 'react';
import type { TrackSort } from '@shared/types';
import { EmptyState } from '@/components/EmptyState';
import { TrackRow } from '@/components/TrackRow';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useFeed } from '@/hooks/useTracks';
import { tracksLabel } from '@/lib/format';
import { tap } from '@/lib/haptics';

const SORTS: { key: TrackSort; label: string }[] = [
  { key: 'new', label: 'Новые' },
  { key: 'top', label: 'Топ' },
  { key: 'played', label: 'Популярные' },
];

export function FeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3.5 rounded-[22px] p-3 glass">
          <div className="size-[72px] animate-pulse rounded-2xl bg-white/6" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/8" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/6" />
            <div className="h-5 w-full animate-pulse rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Discover() {
  const [sort, setSort] = useState<TrackSort>('new');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const feed = useFeed(sort, deferred);
  const tracks = feed.data ?? [];

  return (
    <Screen>
      <ScreenHeader overline="Лента" title="DISCOVER" />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fog" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Трек или артист"
          enterKeyHint="search"
          className="h-13 w-full rounded-2xl pl-12 pr-12 text-[16px] glass placeholder:text-smoke focus:border-white/25"
        />
        {query && (
          <button type="button" aria-label="Очистить" onClick={() => setQuery('')} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-fog">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* horizontally scrollable strip: bleeds to the screen edges and never widens the page */}
      <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              tap();
              setSort(s.key);
            }}
            className={clsx(
              'relative h-10 shrink-0 whitespace-nowrap rounded-full px-4 font-display text-[11px] font-bold uppercase tracking-[0.14em] transition-colors',
              sort === s.key ? 'text-ink' : 'text-silver glass',
            )}
          >
            {sort === s.key && (
              <motion.span layoutId="sort-pill" className="absolute inset-0 rounded-full bg-chrome" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{s.label}</span>
          </button>
        ))}
        <span className="ml-auto shrink-0 self-center whitespace-nowrap pl-2 text-[12px] text-fog">{feed.data ? tracksLabel(tracks.length) : ''}</span>
      </div>

      {feed.isLoading ? (
        <FeedSkeleton />
      ) : feed.isError ? (
        <EmptyState title="Offline" subtitle="Не удалось загрузить ленту." action={<Button variant="glass" onClick={() => feed.refetch()}>Повторить</Button>} />
      ) : tracks.length === 0 ? (
        deferred ? (
          <EmptyState compact title="Ничего не нашлось" subtitle={`По запросу «${deferred}» пусто.`} />
        ) : (
          <EmptyState title="No tracks yet" subtitle="Be the first one to drop." />
        )
      ) : (
        <motion.div layout className="space-y-2.5">
          <AnimatePresence initial={false}>
            {tracks.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: Math.min(i, 8) * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
              >
                <TrackRow track={t} queue={tracks} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </Screen>
  );
}
