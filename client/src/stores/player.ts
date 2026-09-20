import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Track } from '@shared/types';
import { ApiError, isGoneError } from '@/lib/api';
import { getBackend } from '@/lib/backend';
import { coverToDataUrl } from '@/lib/cover';
import { toast } from './toast';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

interface PlayerState {
  queue: Track[];
  index: number;
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  sheetOpen: boolean;

  current: () => Track | null;
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  seekRatio: (ratio: number) => void;
  skipBy: (delta: number) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  openSheet: () => void;
  closeSheet: () => void;
  /** Keeps the queue in sync when a track's public data changes (e.g. new rating). */
  patchTrack: (track: Track) => void;
  /** Removes a deleted track from the queue; stops it if it was playing. */
  removeTrack: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/* Audio engine: a single <audio> element shared by the whole app       */
/* ------------------------------------------------------------------ */

let audio: HTMLAudioElement | null = null;
let playCountedFor: string | null = null;
let loadedTrackId: string | null = null;

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'metadata';
  audio.setAttribute('playsinline', 'true');

  audio.addEventListener('playing', () => {
    usePlayer.setState({ status: 'playing' });
    const track = usePlayer.getState().current();
    if (track && playCountedFor !== track.id) {
      playCountedFor = track.id;
      void getBackend()
        .recordPlay(track.id)
        .then(({ plays }) => usePlayer.setState((s) => ({ queue: s.queue.map((t) => (t.id === track.id ? { ...t, plays } : t)) })))
        .catch(() => undefined);
    }
  });
  audio.addEventListener('pause', () => {
    const state = usePlayer.getState();
    if (state.status !== 'idle') usePlayer.setState({ status: 'paused' });
  });
  audio.addEventListener('waiting', () => {
    if (usePlayer.getState().status === 'playing') usePlayer.setState({ status: 'loading' });
  });
  audio.addEventListener('timeupdate', () => {
    usePlayer.setState({ currentTime: audio!.currentTime });
  });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio!.duration) && audio!.duration > 0) usePlayer.setState({ duration: audio!.duration });
  });
  audio.addEventListener('ended', () => {
    const state = usePlayer.getState();
    if (state.index < state.queue.length - 1) state.next();
    else {
      audio!.currentTime = 0;
      usePlayer.setState({ status: 'paused', currentTime: 0 });
    }
  });
  audio.addEventListener('error', () => {
    const state = usePlayer.getState();
    const track = state.current();
    if (!track) return;
    // Find out whether the track disappeared (deleted by the artist) or it is a transient failure.
    void getBackend()
      .getTrack(track.id)
      .then(() => {
        toast.error('Не удалось воспроизвести', 'Попробуй ещё раз');
        usePlayer.setState({ status: 'paused' });
      })
      .catch((err: unknown) => {
        if (isGoneError(err)) {
          toast.error('TRACK REMOVED', 'Артист удалил этот трек');
          state.removeTrack(track.id);
        } else {
          toast.error('Нет соединения');
          usePlayer.setState({ status: 'paused' });
        }
      });
  });
  return audio;
}

function updateMediaSession(track: Track | null): void {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  if (!track) {
    ms.metadata = null;
    return;
  }
  const artwork = coverToDataUrl(track.coverSeed, 512);
  ms.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artistName,
    album: 'MUSICRATE',
    artwork: artwork ? [{ src: artwork, sizes: '512x512', type: 'image/png' }] : [],
  });
  const s = () => usePlayer.getState();
  ms.setActionHandler('play', () => s().resume());
  ms.setActionHandler('pause', () => s().pause());
  ms.setActionHandler('previoustrack', () => s().prev());
  ms.setActionHandler('nexttrack', () => s().next());
  ms.setActionHandler('seekbackward', () => s().skipBy(-10));
  ms.setActionHandler('seekforward', () => s().skipBy(10));
  try {
    ms.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) s().seek(details.seekTime);
    });
  } catch {
    /* unsupported */
  }
}

function loadAndPlay(track: Track): void {
  const el = getAudio();
  loadedTrackId = track.id;
  playCountedFor = null;
  el.pause();
  el.src = '';
  usePlayer.setState({ status: 'loading', currentTime: 0, duration: track.duration });
  updateMediaSession(track);

  // The data source decides how bytes reach the element: a streamed URL from
  // the API, or an object URL for the blob kept in the device's IndexedDB.
  void getBackend()
    .resolveAudioUrl(track)
    .then((src) => {
      if (loadedTrackId !== track.id) return; // something else got tapped meanwhile
      el.src = src;
      el.load();
      const attempt = el.play();
      if (attempt) {
        attempt.catch((err: unknown) => {
          if ((err as Error).name === 'AbortError') return; // superseded by another play()
          usePlayer.setState({ status: 'paused' });
        });
      }
    })
    .catch((err: unknown) => {
      if (loadedTrackId !== track.id) return;
      if (isGoneError(err)) {
        toast.error('TRACK REMOVED', 'Артист удалил этот трек');
        usePlayer.getState().removeTrack(track.id);
      } else {
        toast.error('Не удалось загрузить аудио', err instanceof ApiError ? err.message : undefined);
        usePlayer.setState({ status: 'idle' });
      }
    });
}

/* ------------------------------------------------------------------ */

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  status: 'idle',
  currentTime: 0,
  duration: 0,
  sheetOpen: false,

  current() {
    const { queue, index } = get();
    return queue[index] ?? null;
  },

  play(track, queue) {
    const state = get();
    const current = state.current();
    if (current?.id === track.id && loadedTrackId === track.id) {
      state.toggle();
      return;
    }
    const nextQueue = queue && queue.length ? queue : [track];
    const index = Math.max(
      0,
      nextQueue.findIndex((t) => t.id === track.id),
    );
    set({ queue: nextQueue, index });
    loadAndPlay(nextQueue[index] ?? track);
  },

  toggle() {
    const { status } = get();
    if (status === 'playing' || status === 'loading') get().pause();
    else get().resume();
  },

  pause() {
    if (audio && !audio.paused) audio.pause();
  },

  resume() {
    const track = get().current();
    if (!track) return;
    if (loadedTrackId !== track.id) {
      loadAndPlay(track);
      return;
    }
    const attempt = getAudio().play();
    if (attempt) attempt.catch(() => set({ status: 'paused' }));
  },

  seek(seconds) {
    const el = getAudio();
    const duration = get().duration || el.duration || 0;
    const clamped = Math.min(Math.max(0, seconds), duration || seconds);
    el.currentTime = clamped;
    set({ currentTime: clamped });
  },

  seekRatio(ratio) {
    const duration = get().duration || audio?.duration || 0;
    if (duration) get().seek(ratio * duration);
  },

  skipBy(delta) {
    get().seek(get().currentTime + delta);
  },

  next() {
    const { queue, index } = get();
    if (index < queue.length - 1) {
      set({ index: index + 1 });
      loadAndPlay(queue[index + 1]!);
    }
  },

  prev() {
    const { queue, index, currentTime } = get();
    if (currentTime > 3 || index <= 0) {
      get().seek(0);
      return;
    }
    set({ index: index - 1 });
    loadAndPlay(queue[index - 1]!);
  },

  stop() {
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    loadedTrackId = null;
    updateMediaSession(null);
    set({ queue: [], index: -1, status: 'idle', currentTime: 0, duration: 0, sheetOpen: false });
  },

  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => set({ sheetOpen: false }),

  patchTrack(track) {
    const { queue } = get();
    if (!queue.some((t) => t.id === track.id)) return;
    set({ queue: queue.map((t) => (t.id === track.id ? { ...t, ...track } : t)) });
  },

  removeTrack(id) {
    const state = get();
    const current = state.current();
    if (current?.id === id) {
      state.stop();
      return;
    }
    const idx = state.queue.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const queue = state.queue.filter((t) => t.id !== id);
    set({ queue, index: idx < state.index ? state.index - 1 : state.index });
  },
}));

/** Convenience selector: is this track the one currently loaded in the player? */
export function useIsCurrent(trackId: string): { isCurrent: boolean; isPlaying: boolean; isLoading: boolean } {
  return usePlayer(
    useShallow((s) => {
      const isCurrent = s.queue[s.index]?.id === trackId;
      return {
        isCurrent,
        isPlaying: isCurrent && s.status === 'playing',
        isLoading: isCurrent && s.status === 'loading',
      };
    }),
  );
}
