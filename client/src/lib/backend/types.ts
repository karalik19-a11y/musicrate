/**
 * The contract every data source implements.
 *
 * Two backends ship with the app:
 *   • `http`  — talks to the Node/Express + SQLite API in `/server`
 *   • `local` — the in-browser engine (IndexedDB + Blob storage) used only
 *               when no API host is configured or local mode is explicitly chosen
 *
 * Screens only ever talk to this interface, which is why the same UI works on
 * a full deployment and on a plain Pages link.
 */

import type { ArtistOverview, AuthResponse, RatingInput, Track, TrackSort, User } from '@shared/types';

export type BackendKind = 'http' | 'local';

export interface PublishInput {
  title: string;
  artistName: string;
  file: File;
  /** Peaks 0..1 measured in the browser; the server keeps them if valid. */
  waveform: number[] | null;
  /** Seconds, measured in the browser (the server re-measures on upload). */
  duration: number | null;
  onProgress?: (ratio: number) => void;
}

export interface Backend {
  readonly kind: BackendKind;

  /** Cheap liveness check; decides between http and local at boot. */
  health(): Promise<{ ok: boolean }>;

  /* session */
  me(): Promise<{ user: User }>;
  rename(name: string): Promise<{ user: User }>;
  loginArtist(password: string, artistKey?: string): Promise<AuthResponse>;
  createGuest(name: string): Promise<AuthResponse>;
  restoreGuest(code: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  /** Called by the auth store whenever the bearer token changes (http only). */
  setToken(token: string | null): void;

  /* tracks */
  listTracks(options: { sort: TrackSort; query?: string }): Promise<{ tracks: Track[] }>;
  getTrack(id: string): Promise<{ track: Track }>;
  myTracks(): Promise<{ tracks: Track[] }>;
  overview(): Promise<{ overview: ArtistOverview }>;
  publish(input: PublishInput): Promise<{ track: Track }>;
  rateTrack(id: string, rating: RatingInput): Promise<{ track: Track }>;
  deleteTrack(id: string): Promise<void>;
  recordPlay(id: string): Promise<{ counted: boolean; plays: number }>;

  /**
   * Resolves a playable `src` for the <audio> element. The http backend hands
   * back its streaming URL, the local one an object URL for the stored blob.
   */
  resolveAudioUrl(track: Track): Promise<string>;
}
