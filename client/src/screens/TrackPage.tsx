import { Ellipsis, Headphones, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { RatingInput } from '@shared/types';
import { CoverArt } from '@/components/CoverArt';
import { PlayButton } from '@/components/PlayButton';
import { RatingSheet } from '@/components/RatingSheet';
import { MyScoreCard, PublicScoreCard } from '@/components/ScoreCard';
import { useTrackActions } from '@/components/TrackActions';
import { Waveform } from '@/components/Waveform';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useRateTrack, useTrack } from '@/hooks/useTracks';
import { ApiError } from '@/lib/api';
import { coverSpec } from '@/lib/cover';
import { formatDate, formatTime, playsLabel, ratingsLabel } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { useIsCurrent, usePlayer } from '@/stores/player';
import { toast } from '@/stores/toast';

export function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const query = useTrack(id);
  const track = query.data;
  const rate = useRateTrack(id ?? '');
  const [rating, setRating] = useState(false);
  const actions = useTrackActions({ onDeleted: () => navigate(user.role === 'artist' ? '/studio/tracks' : '/discover', { replace: true }) });

  const { isCurrent, isPlaying } = useIsCurrent(id ?? '');
  const progress = usePlayer((s) => (isCurrent && s.duration ? s.currentTime / s.duration : 0));
  const seekRatio = usePlayer((s) => s.seekRatio);
  const play = usePlayer((s) => s.play);

  const submitRating = async (input: RatingInput) => {
    try {
      const updated = await rate.mutateAsync(input);
      setRating(false);
      tap([10, 30, 10]);
      toast.success(`Rated ${updated.myRating?.total ?? 0} / 90`, 'Рейтинг обновлён');
    } catch (err) {
      toast.error('Не удалось сохранить оценку', err instanceof ApiError ? err.message : undefined);
    }
  };

  if (query.isError) {
    const status = (query.error as ApiError).status;
    const removed = status === 410 || status === 404;
    return (
      <Screen>
        <ScreenHeader back title={removed ? 'TRACK REMOVED' : 'OFFLINE'} overline="Track" />
        <EmptyState
          title={removed ? 'Этого трека больше нет' : 'Не удалось загрузить'}
          subtitle={removed ? 'Артист удалил его. Оценки и прослушивания тоже удалены.' : 'Проверь соединение и попробуй ещё раз.'}
          action={
            removed ? (
              <Button variant="chrome" onClick={() => navigate(user.role === 'artist' ? '/studio' : '/discover')}>
                К трекам
              </Button>
            ) : (
              <Button variant="glass" onClick={() => query.refetch()}>Повторить</Button>
            )
          }
        />
      </Screen>
    );
  }

  if (!track) {
    return (
      <Screen>
        <ScreenHeader back title=" " />
        <div className="mx-auto mt-4 aspect-square w-full max-w-[320px] animate-pulse rounded-[32px] bg-white/6" />
        <div className="mx-auto mt-8 h-7 w-2/3 animate-pulse rounded bg-white/8" />
        <div className="mx-auto mt-3 h-4 w-1/3 animate-pulse rounded bg-white/6" />
      </Screen>
    );
  }

  const accent = coverSpec(track.coverSeed).palette.accents[0];
  const canRate = user.role === 'guest';

  return (
    <Screen>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] overflow-hidden">
        <div className="absolute left-1/2 top-[-20%] size-[110vw] -translate-x-1/2 rounded-full opacity-35 blur-[100px]" style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 60%)` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <ScreenHeader
        back
        overline="Track"
        title=" "
        className="mb-0"
        action={
          <IconButton size="sm" aria-label="Действия" onClick={() => actions.openMenu(track)}>
            <Ellipsis className="size-5" />
          </IconButton>
        }
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="mx-auto w-full max-w-[min(78vw,340px)]"
      >
        <CoverArt seed={track.coverSeed} title={track.title} rounded="rounded-[32px]" hero className="shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]" />
      </motion.div>

      <div className="mt-7 text-center">
        <h1 className="font-display text-[30px] font-black uppercase leading-[1.02] tracking-tight text-chrome text-balance">{track.title}</h1>
        <p className="mt-2 text-[16px] text-silver">{track.artistName}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-fog">
          <span className="tabular">{formatTime(track.duration)}</span>
          <span className="opacity-40">•</span>
          <span>{formatDate(track.createdAt)}</span>
          <span className="opacity-40">•</span>
          <span className="inline-flex items-center gap-1 tabular">
            <Headphones className="size-3.5" />
            {playsLabel(track.plays)}
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <PlayButton track={track} size="lg" variant={isPlaying ? 'acid' : 'chrome'} />
        <div className="min-w-0 flex-1">
          <Waveform
            peaks={track.waveform}
            bars={56}
            progress={progress}
            active={isCurrent}
            onSeek={isCurrent ? seekRatio : () => play(track)}
            className="h-12"
            accent={isCurrent ? 'bg-acid' : 'bg-silver'}
          />
          <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular text-fog">
            <span>{isCurrent ? formatTime(progress * track.duration) : '0:00'}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <PublicScoreCard rating={track.rating} />
        {track.myRating && <MyScoreCard rating={track.myRating} />}

        {canRate ? (
          <Button
            variant={track.myRating ? 'glass' : 'acid'}
            size="xl"
            block
            icon={<Star className={`size-5 ${track.myRating ? '' : 'fill-current'}`} />}
            onClick={() => {
              tap();
              setRating(true);
            }}
          >
            {track.myRating ? 'Изменить оценку' : 'Оценить'}
          </Button>
        ) : (
          <p className="text-center text-[13px] text-fog">
            {track.isMine ? 'Это твой трек. Оценки ставят гости — ты видишь их здесь в реальном времени.' : 'Оценки ставят гости.'}
            {track.rating.count > 0 && ` Сейчас: ${ratingsLabel(track.rating.count)}.`}
          </p>
        )}
      </div>

      <RatingSheet open={rating} onClose={() => !rate.isPending && setRating(false)} initial={track.myRating} onSubmit={submitRating} submitting={rate.isPending} title={`${track.title} — ${track.artistName}`} />
      {actions.element}
    </Screen>
  );
}
