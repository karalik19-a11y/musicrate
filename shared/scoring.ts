/**
 * The one and only implementation of the rating maths.
 *
 * Both data sources use it:
 *  - the Express + SQL server (sums are produced by SQLite),
 *  - the in-browser local engine used by the static GitHub Pages build.
 *
 * That parity is the point: a public score is always
 * `avg(quality) + avg(listenability) + avg(personal)` derived from real
 * rating rows. No client ever sends a total, so nothing can be forged.
 *
 * Dependency-free: imported by the server and the browser alike.
 */

import type { RatingInput, RatingSummary } from './types';

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Sums over the raw rating rows of a single track (0..30 per component). */
export interface RatingSums {
  count: number;
  quality: number;
  listenability: number;
  personal: number;
}

export const EMPTY_SUMS: RatingSums = { count: 0, quality: 0, listenability: 0, personal: 0 };

export function addRating(sums: RatingSums, rating: RatingInput): RatingSums {
  return {
    count: sums.count + 1,
    quality: sums.quality + rating.quality,
    listenability: sums.listenability + rating.listenability,
    personal: sums.personal + rating.personal,
  };
}

export function removeRating(sums: RatingSums, rating: RatingInput): RatingSums {
  return {
    count: Math.max(0, sums.count - 1),
    quality: sums.quality - rating.quality,
    listenability: sums.listenability - rating.listenability,
    personal: sums.personal - rating.personal,
  };
}

/** Averages (0..30, two decimals) plus the public total (0..90). */
export function summarizeRatings(sums: RatingSums): RatingSummary {
  const n = sums.count > 0 ? sums.count : 1;
  const quality = sums.count > 0 ? sums.quality / n : 0;
  const listenability = sums.count > 0 ? sums.listenability / n : 0;
  const personal = sums.count > 0 ? sums.personal / n : 0;
  return {
    count: sums.count,
    quality: roundTo(quality, 2),
    listenability: roundTo(listenability, 2),
    personal: roundTo(personal, 2),
    total: roundTo(quality + listenability + personal, 2),
  };
}

/** The score a single user gave: the sum of their three components, 0..90. */
export function totalOf(rating: RatingInput): number {
  return rating.quality + rating.listenability + rating.personal;
}

/** Mean of per-track totals — used for the artist overview card. */
export function averageOfTotals(totals: number[]): number | null {
  if (totals.length === 0) return null;
  const sum = totals.reduce((acc, value) => acc + value, 0);
  return roundTo(sum / totals.length, 1);
}
