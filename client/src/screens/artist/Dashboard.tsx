import { ArrowRight, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { ArtistTrackCard } from '@/components/ArtistTrackCard';
import { EmptyState } from '@/components/EmptyState';
import { useTrackActions } from '@/components/TrackActions';
import { Button } from '@/components/ui/Button';
import { Screen, ScreenHeader, SectionTitle } from '@/components/ui/Screen';
import { useArtistOverview, useMyTracks } from '@/hooks/useTracks';
import { formatInt } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { FeedSkeleton } from '@/screens/guest/Discover';

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[22px] glass px-4 py-3.5">
      <p className={`font-display text-[24px] font-black leading-none tabular ${accent ? 'text-acid' : 'text-chrome'}`}>{value}</p>
      <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-fog">{label}</p>
    </div>
  );
}

export function ArtistDashboard() {
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const overview = useArtistOverview();
  const mine = useMyTracks();
  const tracks = mine.data ?? [];
  const recent = tracks.slice(0, 3);
  const actions = useTrackActions({ queue: tracks });

  return (
    <Screen>
      <ScreenHeader overline={user.name === 'Artist' ? 'Artist access' : `Artist · ${user.name}`} title="STUDIO" />

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onClick={() => {
          tap();
          navigate('/studio/upload');
        }}
        className="relative flex h-24 w-full items-center gap-4 overflow-hidden rounded-[28px] bg-acid px-6 text-left text-ink shadow-glow-acid grain-local"
      >
        <span className="absolute -right-10 -top-16 size-48 rounded-full bg-white/30 blur-3xl" aria-hidden />
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-acid">
          <Plus className="size-6" strokeWidth={3} />
        </span>
        <span className="relative">
          <span className="block font-display text-[19px] font-black uppercase tracking-tight">Новый трек</span>
          <span className="block text-[13px] text-ink/70">MP3 · WAV · M4A</span>
        </span>
        <ArrowRight className="relative ml-auto size-5 opacity-70" />
      </motion.button>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Треки" value={overview.data ? formatInt(overview.data.tracks) : '—'} />
        <Stat label="Прослуш." value={overview.data ? formatInt(overview.data.plays) : '—'} />
        <Stat label="Score" value={overview.data?.averageScore != null ? String(Math.round(overview.data.averageScore)) : '—'} accent={overview.data?.averageScore != null} />
      </div>

      <section className="mt-8">
        <SectionTitle
          action={
            tracks.length > 0 && (
              <button type="button" className="text-[12px] font-medium text-fog" onClick={() => navigate('/studio/tracks')}>
                Все треки →
              </button>
            )
          }
        >
          Мои треки
        </SectionTitle>

        {mine.isLoading ? (
          <FeedSkeleton rows={2} />
        ) : tracks.length === 0 ? (
          <EmptyState
            title="Your sound starts here."
            subtitle="Опубликуй первый трек — он сразу появится у гостей."
            action={
              <Button variant="acid" size="lg" icon={<Plus className="size-4" strokeWidth={3} />} onClick={() => navigate('/studio/upload')}>
                Upload track
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {recent.map((t) => (
                <motion.div key={t.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, height: 0, marginBottom: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
                  <ArtistTrackCard track={t} queue={tracks} onMore={actions.openMenu} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {actions.element}
    </Screen>
  );
}
