import { ChevronDown, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Star } from 'lucide-react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useNavigate } from 'react-router';
import { useEffect } from 'react';
import { coverSpec } from '@/lib/cover';
import { formatTime, formatTotal, ratingsLabel } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { usePlayer } from '@/stores/player';
import { CoverArt } from './CoverArt';
import { Waveform } from './Waveform';
import { Button, IconButton } from './ui/Button';
import { Spinner } from './ui/Spinner';

export function FullPlayer() {
  const open = usePlayer((s) => s.sheetOpen);
  const close = usePlayer((s) => s.closeSheet);
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const status = usePlayer((s) => s.status);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration || track?.duration || 0);
  const hasNext = usePlayer((s) => s.index < s.queue.length - 1);
  const hasPrev = usePlayer((s) => s.index > 0);
  const { toggle, next, prev, skipBy, seekRatio } = usePlayer.getState();
  const navigate = useNavigate();
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 700) close();
  };

  const accent = track ? coverSpec(track.coverSeed).palette.accents[0] : '#7b5cff';
  const playing = status === 'playing';
  const progress = duration ? Math.min(1, currentTime / duration) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="player"
          className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-ink"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 36, mass: 0.9 }}
          drag="y"
          dragControls={controls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.55 }}
          onDragEnd={onDragEnd}
        >
          {/* ambient backdrop derived from the cover palette */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-1/4 left-1/2 size-[120vw] -translate-x-1/2 rounded-full opacity-45 blur-[90px]"
              style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 60%)` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/70 to-ink" />
          </div>

          <div
            className="relative flex flex-1 flex-col overflow-y-auto no-scrollbar"
            style={{ paddingTop: 'max(var(--sat), 14px)', paddingBottom: 'max(var(--sab), 20px)' }}
          >
            {/* drag handle + header */}
            <div className="touch-none px-5" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/25" />
              <div className="flex items-center justify-between">
                <IconButton size="sm" aria-label="Свернуть" onClick={close}>
                  <ChevronDown className="size-5" />
                </IconButton>
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-silver">Now playing</p>
                <span className="size-9" />
              </div>
            </div>

            {track ? (
              <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 pt-4">
                <div className="touch-none" onPointerDown={(e) => controls.start(e)}>
                  <motion.div
                    key={track.id}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: playing ? 1 : 0.94, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    className="mx-auto w-full max-w-[min(72vw,340px,44dvh)] short:max-w-[min(64vw,36dvh)]"
                  >
                    <CoverArt
                      seed={track.coverSeed}
                      title={track.title}
                      rounded="rounded-[30px]"
                      hero
                      className="shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]"
                    />
                  </motion.div>
                </div>

                <div className="mt-6 short:mt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-[24px] font-extrabold tracking-tight text-chrome">{track.title}</h2>
                      <p className="mt-1 truncate text-[15px] text-silver">{track.artistName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        navigate(`/track/${track.id}`);
                      }}
                      className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 glass font-display text-[12px] font-bold tabular text-chrome"
                    >
                      <Star className={`size-3.5 ${track.rating.count ? 'fill-acid text-acid' : ''}`} strokeWidth={2.5} />
                      {track.rating.count ? (
                        <>
                          {formatTotal(track.rating.total)}
                          <span className="text-fog">/90</span>
                        </>
                      ) : (
                        <span className="text-fog">—</span>
                      )}
                    </button>
                  </div>
                  {track.rating.count > 0 && (
                    <p className="mt-1 text-[12px] text-fog">{ratingsLabel(track.rating.count)}</p>
                  )}

                  <Waveform
                    peaks={track.waveform}
                    bars={64}
                    progress={progress}
                    onSeek={seekRatio}
                    active={playing}
                    className="mt-5 h-14 short:mt-3 short:h-12"
                  />
                  <div className="mt-2 flex justify-between font-mono text-[12px] tabular text-fog">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  <div className="mt-4 short:mt-2 flex items-center justify-between">
                    <IconButton variant="ghost" size="lg" aria-label="Предыдущий" disabled={!hasPrev && currentTime < 3} onClick={() => { tap(); prev(); }}>
                      <SkipBack className="size-7 fill-current" />
                    </IconButton>
                    <IconButton variant="ghost" size="lg" aria-label="Назад на 10 секунд" onClick={() => { tap(); skipBy(-10); }}>
                      <RotateCcw className="size-6" />
                    </IconButton>
                    <motion.button
                      type="button"
                      aria-label={playing ? 'Пауза' : 'Играть'}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 26 }}
                      onClick={() => {
                        tap();
                        toggle();
                      }}
                      className="relative grid size-[76px] place-items-center rounded-full bg-chrome text-ink shadow-[0_18px_50px_-14px_rgba(255,255,255,0.55)]"
                    >
                      {playing && <span aria-hidden className="absolute inset-0 rounded-full bg-white/30 animate-pulse-ring" />}
                      <AnimatePresence mode="wait" initial={false}>
                        {status === 'loading' ? (
                          <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Spinner className="size-8" />
                          </motion.span>
                        ) : playing ? (
                          <motion.span key="p" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                            <Pause className="size-9 fill-current" />
                          </motion.span>
                        ) : (
                          <motion.span key="s" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="ml-1">
                            <Play className="size-9 fill-current" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                    <IconButton variant="ghost" size="lg" aria-label="Вперёд на 10 секунд" onClick={() => { tap(); skipBy(10); }}>
                      <RotateCw className="size-6" />
                    </IconButton>
                    <IconButton variant="ghost" size="lg" aria-label="Следующий" disabled={!hasNext} onClick={() => { tap(); next(); }} className="disabled:opacity-30">
                      <SkipForward className="size-7 fill-current" />
                    </IconButton>
                  </div>

                  <Button
                    variant="ghost"
                    size="md"
                    block
                    className="mt-3 short:mt-1 !text-fog"
                    onClick={() => {
                      close();
                      navigate(`/track/${track.id}`);
                    }}
                  >
                    Страница трека
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="mb-6 grid size-24 place-items-center rounded-full glass">
                  <Play className="ml-1 size-10 text-fog" />
                </div>
                <h2 className="font-display text-[22px] font-extrabold uppercase tracking-tight text-chrome">Nothing playing</h2>
                <p className="mt-2 text-[15px] text-fog">Выбери трек в ленте — он появится здесь.</p>
                <Button
                  variant="chrome"
                  size="lg"
                  className="mt-8"
                  onClick={() => {
                    close();
                    navigate('/discover');
                  }}
                >
                  Открыть Discover
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
