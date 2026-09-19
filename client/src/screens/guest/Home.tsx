import { ArrowRight, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { TrackHero } from '@/components/TrackHero';
import { TrackRow } from '@/components/TrackRow';
import { Screen, ScreenHeader, SectionTitle } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useFeed } from '@/hooks/useTracks';
import { useAuth } from '@/stores/auth';
import { toast } from '@/stores/toast';
import { FeedSkeleton } from './Discover';

export function GuestHome() {
  const user = useAuth((s) => s.user)!;
  const location = useLocation();
  const navigate = useNavigate();
  const feed = useFeed('new');

  useEffect(() => {
    if ((location.state as { welcome?: boolean } | null)?.welcome) {
      toast.success(`Welcome, ${user.name}`, 'Профиль сохранён на этом устройстве');
      window.history.replaceState({}, '');
    }
  }, [location.state, user.name]);

  const tracks = feed.data ?? [];
  const topRated = useMemo(
    () => [...tracks].filter((t) => t.rating.count > 0).sort((a, b) => b.rating.total - a.rating.total).slice(0, 5),
    [tracks],
  );
  const mostPlayed = useMemo(() => [...tracks].filter((t) => t.plays > 0).sort((a, b) => b.plays - a.plays).slice(0, 5), [tracks]);
  const fresh = tracks.slice(0, 10);

  return (
    <Screen>
      <ScreenHeader overline={`Yo, ${user.name}`} title="HOME" />

      {feed.isLoading ? (
        <FeedSkeleton />
      ) : feed.isError ? (
        <EmptyState title="Offline" subtitle="Не удалось загрузить ленту." action={<Button variant="glass" onClick={() => feed.refetch()}>Повторить</Button>} />
      ) : tracks.length === 0 ? (
        <EmptyState title="No tracks yet" subtitle="Be the first one to drop." />
      ) : (
        <div className="space-y-9">
          <section>
            <SectionTitle action={<Sparkles className="size-4 text-acid" />}>New drops</SectionTitle>
            <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 no-scrollbar">
              {fresh.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 26 }}>
                  <TrackHero track={t} queue={fresh} />
                </motion.div>
              ))}
            </div>
          </section>

          {topRated.length > 0 && (
            <section>
              <SectionTitle action={<TrendingUp className="size-4 text-fog" />}>Top rated</SectionTitle>
              <div className="space-y-2.5">
                {topRated.map((t) => (
                  <TrackRow key={t.id} track={t} queue={topRated} />
                ))}
              </div>
            </section>
          )}

          {mostPlayed.length > 0 && (
            <section>
              <SectionTitle action={<Flame className="size-4 text-fog" />}>Most played</SectionTitle>
              <div className="space-y-2.5">
                {mostPlayed.map((t) => (
                  <TrackRow key={t.id} track={t} queue={mostPlayed} />
                ))}
              </div>
            </section>
          )}

          <Button variant="glass" size="lg" block icon={<ArrowRight className="size-4" />} onClick={() => navigate('/discover')}>
            Все треки
          </Button>
        </div>
      )}
    </Screen>
  );
}
