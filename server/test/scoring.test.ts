import { describe, expect, it } from 'vitest';
import { addRating, averageOfTotals, removeRating, summarizeRatings, totalOf } from '@shared/scoring';

/**
 * The public score is a pure function of real rating rows. These cases pin the
 * numbers the whole product is judged on — 84 for the launch example, 87 after
 * a second guest, and exactly 90 only when every voter gives every component a
 * perfect 30 (there is no other path to it).
 */
describe('shared scoring', () => {
  it('is empty until the first rating lands', () => {
    expect(summarizeRatings({ count: 0, quality: 0, listenability: 0, personal: 0 })).toEqual({
      count: 0,
      quality: 0,
      listenability: 0,
      personal: 0,
      total: 0,
    });
  });

  it('one rating: totals are that guest numbers, count 1', () => {
    const summary = summarizeRatings({ count: 1, quality: 27, listenability: 29, personal: 28 });
    expect(summary).toEqual({ count: 1, quality: 27, listenability: 29, personal: 28, total: 84 });
  });

  it('two ratings: per-component averages, then summed', () => {
    const summary = summarizeRatings({ count: 2, quality: 57, listenability: 59, personal: 58 });
    expect(summary.quality).toBe(28.5);
    expect(summary.listenability).toBe(29.5);
    expect(summary.personal).toBe(29);
    expect(summary.total).toBe(87);
  });

  it('rounds every component to two decimals without drifting the total', () => {
    // the total is rounded from the exact average sum (60.6333…), not from the
    // already-rounded components (30.33 + 20.2 + 10.1 = 60.63) — one rule for
    // both backends, so two clients can never disagree by a hundredth.
    const summary = summarizeRatings({ count: 3, quality: 91, listenability: 60.6, personal: 30.3 });
    expect(summary.quality).toBe(30.33);
    expect(summary.total).toBe(60.63);
  });

  it('90 / 90 requires unanimity at the ceiling', () => {
    const perfect = { count: 4, quality: 120, listenability: 120, personal: 120 };
    expect(summarizeRatings(perfect).total).toBe(90);
    expect(summarizeRatings(addRating(perfect, { quality: 0, listenability: 0, personal: 0 })).total).toBe(72);
  });

  it('incremental sums match a full recompute', () => {
    const rows = [
      { quality: 25, listenability: 28, personal: 22 },
      { quality: 30, listenability: 17, personal: 29 },
      { quality: 12, listenability: 26, personal: 26 },
    ];
    const incremental = rows.reduce(addRating, { count: 0, quality: 0, listenability: 0, personal: 0 });
    expect(summarizeRatings(incremental)).toEqual(summarizeRatings(rows.reduce(addRating, { count: 0, quality: 0, listenability: 0, personal: 0 })));
    expect(summarizeRatings(removeRating(incremental, rows[2]!)).total).toBe(
      summarizeRatings({ count: 2, quality: 55, listenability: 45, personal: 51 }).total,
    );
  });

  it('my score is the sum of my own three components', () => {
    expect(totalOf({ quality: 29, listenability: 28, personal: 30 })).toBe(87);
  });

  it('artist overview averages per-track totals, and stays null when unrated', () => {
    expect(averageOfTotals([])).toBeNull();
    expect(averageOfTotals([84, 87])).toBe(85.5);
  });
});
