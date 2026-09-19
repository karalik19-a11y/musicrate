import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ArtistOverview, RatingInput, Track, TrackSort } from '@shared/types';
import { api, upload } from '@/lib/api';
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
    queryFn: async () => {
      const params = new URLSearchParams({ sort });
      if (q) params.set('q', q);
      const res = await api<{ tracks: Track[] }>(`/tracks?${params}`);
      return res.tracks;
    },
    staleTime: 15_000,
  });
}

export function useTrack(id: string | undefined) {
  return useQuery({
    queryKey: trackKeys.detail(id ?? ''),
    queryFn: async () => (await api<{ track: Track }>(`/tracks/${id}`)).track,
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
    queryFn: async () => (await api<{ tracks: Track[] }>('/artist/tracks')).tracks,
    staleTime: 10_000,
  });
}

export function useArtistOverview() {
  return useQuery({
    queryKey: artistKeys.overview,
    queryFn: async () => (await api<{ overview: ArtistOverview }>('/artist/overview')).overview,
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

export function useRateTrack(trackId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (rating: RatingInput) =>
      (await api<{ track: Track }>(`/tracks/${trackId}/rating`, { method: 'PUT', body: rating })).track,
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
      await api(`/tracks/${id}`, { method: 'DELETE' });
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
  onProgress: (ratio: number) => void;
}

export function usePublishTrack() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: PublishInput) => {
      const form = new FormData();
      form.set('title', input.title);
      form.set('artistName', input.artistName);
      if (input.waveform) form.set('waveform', JSON.stringify(input.waveform));
      form.set('audio', input.file, input.file.name);
      return (await upload<{ track: Track }>('/tracks', form, { onProgress: input.onProgress })).track;
    },
    onSuccess: (track) => {
      client.setQueryData<Track[]>(trackKeys.mine(), (old) => (old ? [track, ...old] : [track]));
      client.setQueryData(trackKeys.detail(track.id), track);
      void client.invalidateQueries({ queryKey: trackKeys.all });
      void client.invalidateQueries({ queryKey: artistKeys.overview });
    },
  });
}
