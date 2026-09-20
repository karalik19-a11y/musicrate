import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ArtistOverview, RatingInput, Track, TrackSort } from '@shared/types';
import { getBackend } from '@/lib/backend';
import { usePlayer } from '@/stores/player';

/* ------------------------------ keys ------------------------------ */

export const trackKeys = {
  all: ['tracks'] as const,
  feed: (sort: TrackSort, q: string) => ['tracks', 'feed', sort, q] as const,
  detail: (id: string) => ['tracks', 'detail', id] as const,
  mine: () => ['tracks', 'mine'] as const,
};
export const artistKeys = { overview: ['artist', 'overview'] as const };

/* ---------------------------- queries ----------------------------- */

export function useFeed(sort: TrackSort = 'new', q = '') {
  return useQuery({
    queryKey: trackKeys.feed(sort, q),
    queryFn: async () => (await getBackend().listTracks({ sort, query: q || undefined })).tracks,
    staleTime: 15_000,
  });
}

export function useTrack(id: string | undefined) {
  return useQuery({
    queryKey: trackKeys.detail(id ?? ''),
    queryFn: async () => (await getBackend().getTrack(id!)).track,
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: (count, error) => {
      const status = (error as { status?: number }).status;
      return status !== 410 && status !== 404 && count < 2;
    },
  });
}

export function useMyTracks() {
  return useQuery({
    queryKey: trackKeys.mine(),
    queryFn: async () => (await getBackend().myTracks()).tracks,
    staleTime: 10_000,
  });
}

export function useArtistOverview() {
  return useQuery({
    queryKey: artistKeys.overview,
    queryFn: async () => (await getBackend().overview()).overview,
    staleTime: 10_000,
  });
}

/* --------------------------- cache utils -------------------------- */

/** Pushes a fresh track object into every cached list, the detail cache and the player. */
export function applyTrackUpdate(client: QueryClient, track: Track): void {
  client.setQueryData(trackKeys.detail(track.id), track);
  client.setQueriesData<Track[]>({ queryKey: trackKeys.all, exact: false }, (old) =>
    Array.isArray(old) ? old.map((t) => (t.id === track.id ? track : t)) : old,
  );
  usePlayer.getState().patchTrack(track);
}

export function removeTrackFromCache(client: QueryClient, id: string): void {
  client.setQueriesData<Track[]>({ queryKey: trackKeys.all, exact: false }, (old) =>
    Array.isArray(old) ? old.filter((t) => t.id !== id) : old,
  );
  client.removeQueries({ queryKey: trackKeys.detail(id) });
  usePlayer.getState().removeTrack(id);
}

/* --------------------------- mutations ---------------------------- */

/**
 * The response is the track as the backend recomputed it — averages and total
 * included. The UI never builds a score out of its own numbers.
 */
export function useRateTrack(trackId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (rating: RatingInput) => (await getBackend().rateTrack(trackId, rating)).track,
    onSuccess: (track) => {
      applyTrackUpdate(client, track);
      void client.invalidateQueries({ queryKey: trackKeys.feed('top', ''), exact: false });
    },
  });
}

export function useDeleteTrack() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await getBackend().deleteTrack(id);
      return id;
    },
    onSuccess: (id) => {
      removeTrackFromCache(client, id);
      void client.invalidateQueries({ queryKey: artistKeys.overview });
    },
  });
}

export interface PublishInput {
  title: string;
  artistName: string;
  file: File;
  waveform: number[] | null;
  duration: number | null;
  onProgress: (ratio: number) => void;
}

export function usePublishTrack() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: PublishInput) => {
      const { onProgress, ...rest } = input;
      return (await getBackend().publish({ ...rest, onProgress })).track;
    },
    onSuccess: (track) => {
      client.setQueryData<Track[]>(trackKeys.mine(), (old) => (old ? [track, ...old] : [track]));
      client.setQueryData(trackKeys.detail(track.id), track);
      void client.invalidateQueries({ queryKey: trackKeys.all });
      void client.invalidateQueries({ queryKey: artistKeys.overview });
    },
  });
}

/** One play per user per 30s, deduped by whoever stores the data. */
export function useRecordPlay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await getBackend().recordPlay(id)).plays,
    onSuccess: (plays, id) => {
      client.setQueryData<Track>(trackKeys.detail(id), (old) => (old ? { ...old, plays } : old));
      client.setQueriesData<Track[]>({ queryKey: trackKeys.all, exact: false }, (old) =>
        Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, plays } : t)) : old,
      );
    },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (name: string) => (await getBackend().rename(name)).user,
  });
}
