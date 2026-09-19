import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArtistTrackCard } from '@/components/ArtistTrackCard';
import { EmptyState } from '@/components/EmptyState';
import { useTrackActions } from '@/components/TrackActions';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useMyTracks } from '@/hooks/useTracks';
import { tracksLabel } from '@/lib/format';
import { FeedSkeleton } from '@/screens/guest/Discover';

export function ArtistTracks() {
  const navigate = useNavigate();
  const mine = useMyTracks();
  const tracks = mine.data ?? [];
  const actions = useTrackActions({ queue: tracks });

  return (
    <Screen>
      <ScreenHeader
        overline={mine.data ? tracksLabel(tracks.length) : 'Studio'}
        title="MY TRACKS"
        action={
          <Button variant="acid" size="sm" icon={<Plus className="size-4" strokeWidth={3} />} onClick={() => navigate('/studio/upload')}>
            Новый
          </Button>
        }
      />

      {mine.isLoading ? (
        <FeedSkeleton />
      ) : mine.isError ? (
        <EmptyState title="Offline" subtitle="Не удалось загрузить треки." action={<Button variant="glass" onClick={() => mine.refetch()}>Повторить</Button>} />
      ) : tracks.length === 0 ? (
        <EmptyState
          title="Your sound starts here."
          subtitle="Здесь появятся твои публикации, их оценки и прослушивания."
          action={
            <Button variant="acid" size="lg" icon={<Plus className="size-4" strokeWidth={3} />} onClick={() => navigate('/studio/upload')}>
              Upload track
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {tracks.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, height: 0, marginBottom: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03, type: 'spring', stiffness: 320, damping: 30 }}
              >
                <ArtistTrackCard track={t} queue={tracks} onMore={actions.openMenu} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {actions.element}
    </Screen>
  );
}
