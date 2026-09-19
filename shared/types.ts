/**
 * Shared contracts between the API server and the web client.
 * Keep this file dependency-free: it is imported by both sides.
 */

export type Role = 'guest' | 'artist';

export interface User {
  id: string;
  role: Role;
  name: string;
  createdAt: number;
  /** Guests only: short code that restores the profile on another device. */
  recoveryCode?: string;
}

/** A single rating: every component is an integer in the 0..30 range. */
export interface RatingInput {
  quality: number;
  listenability: number;
  personal: number;
}

/** Community aggregate for a track. Averages are 0..30, total is 0..90. */
export interface RatingSummary {
  count: number;
  quality: number;
  listenability: number;
  personal: number;
  total: number;
}

export interface MyRating extends RatingInput {
  total: number;
  updatedAt: number;
}

export interface Track {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  /** Seconds. */
  duration: number;
  /** 0..1 normalized peaks used to draw the waveform. */
  waveform: number[];
  coverSeed: string;
  mimeType: string;
  fileSize: number;
  createdAt: number;
  audioUrl: string;
  plays: number;
  rating: RatingSummary;
  /** Rating of the requesting user, if any. */
  myRating: MyRating | null;
  /** True when the requesting artist owns the track. */
  isMine: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
  /**
   * Artists only: opaque device key that re-links future password logins on
   * this device to the same artist identity (so track ownership survives logout).
   */
  artistKey?: string;
}

export interface ArtistOverview {
  tracks: number;
  plays: number;
  ratings: number;
  /** Average total score across the artist's rated tracks, 0..90. */
  averageScore: number | null;
}

export type TrackSort = 'new' | 'top' | 'played';

export interface ApiErrorBody {
  error: string;
  message: string;
}

export const RATING_COMPONENT_MAX = 30;
export const RATING_TOTAL_MAX = 90;

export const MAX_UPLOAD_BYTES = 80 * 1024 * 1024; // 80 MB
export const MAX_TITLE_LENGTH = 60;
export const MAX_NAME_LENGTH = 40;
export const WAVEFORM_BARS = 96;

/** Canonical mime type per accepted extension (what we store and stream). */
export const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

export const ACCEPTED_AUDIO_EXTENSIONS = Object.keys(AUDIO_TYPES);
