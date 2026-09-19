import { Check, FileAudio, Pause, Play, Rocket, Upload as UploadIcon, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Track, User } from '@shared/types';
import { ACCEPTED_AUDIO_EXTENSIONS, MAX_NAME_LENGTH, MAX_TITLE_LENGTH, MAX_UPLOAD_BYTES } from '@shared/types';
import { CoverArt } from '@/components/CoverArt';
import { Waveform } from '@/components/Waveform';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { Spinner } from '@/components/ui/Spinner';
import { usePublishTrack } from '@/hooks/useTracks';
import { api, ApiError } from '@/lib/api';
import { analyzeAudio, probeDuration } from '@/lib/audio-analysis';
import { formatBytes, formatTime } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { useAuth } from '@/stores/auth';
import { usePlayer } from '@/stores/player';

type Phase = 'form' | 'uploading' | 'processing' | 'live';

interface Picked {
  file: File;
  url: string;
  duration: number | null;
  peaks: number[] | null;
  analyzing: boolean;
}

const ACCEPT = ACCEPTED_AUDIO_EXTENSIONS.map((e) => `.${e}`).join(',') + ',audio/*';

function extensionOk(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_AUDIO_EXTENSIONS.includes(ext);
}

/** Local preview player for the picked file (independent from the global player). */
function usePreview(url: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    if (!url) return;
    const el = new Audio(url);
    el.preload = 'metadata';
    audioRef.current = el;
    const onTime = () => setProgress(el.duration ? el.currentTime / el.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('play', () => setPlaying(true));
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
      el.src = '';
      audioRef.current = null;
    };
  }, [url]);

  return {
    playing,
    progress,
    toggle() {
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) {
        usePlayer.getState().pause();
        void el.play().catch(() => undefined);
      } else el.pause();
    },
    seek(ratio: number) {
      const el = audioRef.current;
      if (el?.duration) el.currentTime = ratio * el.duration;
    },
    stop() {
      audioRef.current?.pause();
    },
  };
}

export function ArtistUpload() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const publish = usePublishTrack();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState(user.name === 'Artist' ? '' : user.name);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<Track | null>(null);
  const preview = usePreview(picked?.url ?? null);

  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.url);
    },
    [picked],
  );

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    if (!extensionOk(file.name)) {
      setFileError('Поддерживаются MP3, WAV, M4A, AAC и FLAC');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError(`Файл больше ${formatBytes(MAX_UPLOAD_BYTES)}`);
      return;
    }
    tap();
    if (picked) URL.revokeObjectURL(picked.url);
    const url = URL.createObjectURL(file);
    setPicked({ file, url, duration: null, peaks: null, analyzing: true });
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH));

    const [quick, analysis] = await Promise.all([probeDuration(file), analyzeAudio(file)]);
    setPicked((current) =>
      current && current.file === file
        ? { ...current, duration: analysis?.duration ?? quick, peaks: analysis?.peaks ?? null, analyzing: false }
        : current,
    );
  };

  const clearFile = () => {
    preview.stop();
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked || phase !== 'form') return;
    if (!title.trim()) return setFormError('Введите название трека');
    if (!artistName.trim()) return setFormError('Введите имя музыканта');
    setFormError(null);
    preview.stop();
    setPhase('uploading');
    setProgress(0);
    try {
      const track = await publish.mutateAsync({
        title: title.trim(),
        artistName: artistName.trim(),
        file: picked.file,
        waveform: picked.peaks,
        onProgress: (ratio) => {
          setProgress(ratio);
          if (ratio >= 0.999) setPhase('processing');
        },
      });
      tap([10, 40, 10, 40, 20]);
      setLive(track);
      setPhase('live');
      if (user.name === 'Artist') {
        // first publish: adopt the musician name as the studio profile name
        void api<{ user: User }>('/me', { method: 'PATCH', body: { name: track.artistName } })
          .then((res) => setUser(res.user))
          .catch(() => undefined);
      }
    } catch (err) {
      setPhase('form');
      setFormError(err instanceof ApiError ? err.message : 'Не удалось опубликовать');
    }
  };

  const reset = () => {
    clearFile();
    setTitle('');
    setLive(null);
    setPhase('form');
    setProgress(0);
  };

  if (phase === 'live' && live) {
    return (
      <Screen>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="relative"
          >
            <span aria-hidden className="absolute inset-0 rounded-full bg-acid/40 blur-2xl animate-pulse-ring" />
            <CoverArt seed={live.coverSeed} title={live.title} className="relative w-52 shadow-glow-acid" rounded="rounded-[30px]" hero />
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 500, damping: 20 }}
              className="absolute -bottom-3 -right-3 grid size-14 place-items-center rounded-full bg-acid text-ink shadow-glow-acid"
            >
              <Check className="size-7" strokeWidth={3.5} />
            </motion.span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 font-display text-[40px] font-black leading-none tracking-tight acid-text"
          >
            TRACK LIVE
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-3 text-[15px] text-silver">
            «{live.title}» — {live.artistName}. Уже в ленте у гостей.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-10 w-full space-y-3">
            <Button variant="chrome" size="xl" block onClick={() => navigate(`/track/${live.id}`)}>
              Открыть трек
            </Button>
            <Button variant="glass" size="lg" block onClick={reset}>
              Загрузить ещё один
            </Button>
          </motion.div>
        </div>
      </Screen>
    );
  }

  const busy = phase === 'uploading' || phase === 'processing';

  return (
    <Screen>
      <ScreenHeader overline="Studio" title="NEW TRACK" />

      <form onSubmit={submit} className="space-y-5">
        <Input
          name="title"
          label="Название трека"
          placeholder="Например, Midnight"
          maxLength={MAX_TITLE_LENGTH}
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          autoCapitalize="words"
        />
        <Input
          name="artistName"
          label="Имя музыканта"
          placeholder="Например, Daniel"
          maxLength={MAX_NAME_LENGTH}
          value={artistName}
          disabled={busy}
          onChange={(e) => setArtistName(e.target.value)}
          autoCapitalize="words"
        />

        <div>
          <span className="mb-2 block font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fog">Аудиофайл</span>
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={onPick} disabled={busy} />

          <AnimatePresence mode="wait" initial={false}>
            {!picked ? (
              <motion.button
                key="picker"
                type="button"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => inputRef.current?.click()}
                className="flex h-40 w-full flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-white/18 bg-white/[0.03] text-center"
              >
                <span className="grid size-14 place-items-center rounded-full bg-chrome text-ink">
                  <UploadIcon className="size-6" />
                </span>
                <span>
                  <span className="block font-display text-[13px] font-bold uppercase tracking-[0.14em] text-chrome">Загрузить трек</span>
                  <span className="mt-1 block text-[12px] text-fog">MP3 · WAV · M4A · до {formatBytes(MAX_UPLOAD_BYTES)}</span>
                </span>
              </motion.button>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-[26px] glass p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet/20 text-violet">
                    <FileAudio className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-chrome">{picked.file.name}</p>
                    <p className="text-[12px] text-fog">
                      {formatBytes(picked.file.size)}
                      {' · '}
                      {picked.analyzing ? 'анализируем…' : picked.duration != null ? formatTime(picked.duration) : 'длительность определит сервер'}
                    </p>
                  </div>
                  {!busy && (
                    <IconButton size="sm" variant="ghost" aria-label="Убрать файл" onClick={clearFile}>
                      <X className="size-5" />
                    </IconButton>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    disabled={busy}
                    onClick={preview.toggle}
                    aria-label={preview.playing ? 'Пауза' : 'Прослушать'}
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-chrome text-ink disabled:opacity-50"
                  >
                    {preview.playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
                  </motion.button>
                  {picked.analyzing ? (
                    <div className="flex h-10 flex-1 items-center gap-1.5">
                      {Array.from({ length: 28 }).map((_, i) => (
                        <span key={i} className="flex-1 origin-center rounded-full bg-white/20 animate-bars" style={{ height: `${25 + ((i * 41) % 60)}%`, animationDelay: `${i * 40}ms` }} />
                      ))}
                    </div>
                  ) : (
                    <Waveform peaks={picked.peaks ?? []} bars={56} progress={preview.progress} onSeek={busy ? undefined : preview.seek} active={preview.playing} className="h-10 flex-1" />
                  )}
                </div>

                <AnimatePresence>
                  {busy && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-4 flex items-center justify-between text-[12px]">
                        <span className="inline-flex items-center gap-2 font-display font-bold uppercase tracking-[0.16em] text-acid">
                          {phase === 'processing' ? <Spinner className="size-3.5" /> : null}
                          {phase === 'processing' ? 'Processing' : 'Uploading'}
                        </span>
                        <span className="tabular text-fog">{Math.round(progress * 100)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                        <motion.div className="h-full rounded-full bg-acid shadow-glow-acid" animate={{ width: `${Math.max(2, progress * 100)}%` }} transition={{ ease: 'linear', duration: 0.2 }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          {fileError && <p className="mt-2 text-[13px] text-danger">{fileError}</p>}
        </div>

        {formError && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-danger/10 px-4 py-3 text-center text-[14px] text-danger">
            {formError}
          </motion.p>
        )}

        <Button type="submit" variant="acid" size="xl" block loading={busy} disabled={!picked || picked.analyzing || !title.trim() || !artistName.trim()} icon={<Rocket className="size-5" />}>
          Опубликовать
        </Button>
      </form>
    </Screen>
  );
}
