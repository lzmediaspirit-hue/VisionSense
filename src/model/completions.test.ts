import { describe, expect, it } from 'vitest';
import {
  bucketsFor,
  collectCompletions,
  completionSummary,
  dailyBuckets,
  localDayKey,
  localMonthKey,
  monthlyBuckets,
  yearlyBuckets,
} from './completions';
import { createChart } from './factory';
import type { Chart } from './types';

/**
 * Build a chart whose completions land on the given LOCAL Dates. We pass the
 * Date's own ISO (UTC instant) as completedAt — exactly what operations.ts
 * stores — so parsing it back with new Date() reconstructs the same instant and
 * the module's LOCAL getters recover the intended calendar day, in ANY runner
 * timezone. This is what makes these assertions timezone-sane.
 */
function chartWithCompletions(dates: Date[]): Chart {
  const chart = createChart();
  const pillar = chart.pillars[0];
  const actions = pillar.actions.map((a, i) =>
    i < dates.length
      ? { ...a, text: `done ${i}`, status: 'done' as const, completedAt: dates[i].toISOString() }
      : a,
  );
  const pillars = chart.pillars.slice();
  pillars[0] = { ...pillar, actions };
  return { ...chart, pillars };
}

describe('completions bucketing', () => {
  it('localDayKey / localMonthKey use LOCAL calendar components, not UTC slicing', () => {
    // Construct a Date late in the local day; its local calendar day is fixed by
    // construction regardless of timezone, and we key off local getters.
    const d = new Date(2024, 5, 1, 23, 30); // local Jun 1 2024, 23:30
    expect(localDayKey(d)).toBe('2024-06-01');
    expect(localMonthKey(d)).toBe('2024-06');
    // Single-digit month/day are zero-padded.
    expect(localDayKey(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('collectCompletions gathers only actions with a valid completedAt', () => {
    const chart = chartWithCompletions([new Date(2024, 5, 1, 10, 0), new Date(2024, 5, 2, 10, 0)]);
    expect(collectCompletions(chart)).toHaveLength(2);
    // A fresh chart has none.
    expect(collectCompletions(createChart())).toHaveLength(0);
  });

  it('ignores an unparseable completedAt without throwing', () => {
    const chart = createChart();
    const pillars = chart.pillars.slice();
    pillars[0] = {
      ...pillars[0],
      actions: pillars[0].actions.map((a, i) =>
        i === 0 ? { ...a, text: 'x', status: 'done' as const, completedAt: 'not-a-date' } : a,
      ),
    };
    expect(collectCompletions({ ...chart, pillars })).toHaveLength(0);
  });

  it('daily buckets span exactly the last 30 local days ending on now, inclusive', () => {
    const now = new Date(2024, 5, 15, 12, 0); // local Jun 15
    const buckets = dailyBuckets([], now, 30);
    expect(buckets).toHaveLength(30);
    expect(buckets[buckets.length - 1].key).toBe('2024-06-15'); // today is last
    expect(buckets[0].key).toBe('2024-05-17'); // 29 days earlier
  });

  it('counts completions into the correct local daily bucket', () => {
    const now = new Date(2024, 5, 15, 12, 0);
    // Two completions on Jun 1 (one near midnight to exercise local-day keying),
    // one on Jun 15 (today).
    const dates = collectCompletions(
      chartWithCompletions([
        new Date(2024, 5, 1, 8, 0),
        new Date(2024, 5, 1, 23, 45),
        new Date(2024, 5, 15, 9, 0),
      ]),
    );
    const buckets = dailyBuckets(dates, now, 30);
    const byKey = new Map(buckets.map((b) => [b.key, b.count]));
    expect(byKey.get('2024-06-01')).toBe(2);
    expect(byKey.get('2024-06-15')).toBe(1);
    expect(byKey.get('2024-06-10')).toBe(0);
  });

  it('monthly buckets span the last 12 months ending on now', () => {
    const now = new Date(2024, 5, 15);
    const dates = collectCompletions(
      chartWithCompletions([new Date(2024, 5, 3, 10, 0), new Date(2024, 0, 20, 10, 0)]),
    );
    const buckets = monthlyBuckets(dates, now, 12);
    expect(buckets).toHaveLength(12);
    expect(buckets[buckets.length - 1].key).toBe('2024-06');
    expect(buckets[0].key).toBe('2023-07');
    const byKey = new Map(buckets.map((b) => [b.key, b.count]));
    expect(byKey.get('2024-06')).toBe(1);
    expect(byKey.get('2024-01')).toBe(1);
  });

  it('yearly buckets span earliest completion year through current year', () => {
    const now = new Date(2024, 5, 15);
    const dates = collectCompletions(
      chartWithCompletions([new Date(2022, 2, 1, 10, 0), new Date(2024, 5, 1, 10, 0)]),
    );
    const buckets = yearlyBuckets(dates, now);
    expect(buckets.map((b) => b.key)).toEqual(['2022', '2023', '2024']);
    const byKey = new Map(buckets.map((b) => [b.key, b.count]));
    expect(byKey.get('2022')).toBe(1);
    expect(byKey.get('2023')).toBe(0);
    expect(byKey.get('2024')).toBe(1);
  });

  it('yearly buckets fall back to just the current year with no data', () => {
    const buckets = yearlyBuckets([], new Date(2024, 5, 15));
    expect(buckets.map((b) => b.key)).toEqual(['2024']);
    expect(buckets[0].count).toBe(0);
  });

  it('bucketsFor dispatches to the requested view', () => {
    const chart = chartWithCompletions([new Date(2024, 5, 15, 9, 0)]);
    const now = new Date(2024, 5, 15, 12, 0);
    expect(bucketsFor(chart, 'daily', now)).toHaveLength(30);
    expect(bucketsFor(chart, 'monthly', now)).toHaveLength(12);
    expect(bucketsFor(chart, 'yearly', now)).toHaveLength(1);
  });

  it('summary reports total done and a current streak ending today', () => {
    const now = new Date(2024, 5, 15, 12, 0);
    // Completions on Jun 13, 14, 15 => 3-day streak ending today.
    const chart = chartWithCompletions([
      new Date(2024, 5, 13, 9, 0),
      new Date(2024, 5, 14, 9, 0),
      new Date(2024, 5, 15, 9, 0),
    ]);
    const summary = completionSummary(chart, now);
    expect(summary.totalDone).toBe(3);
    expect(summary.total).toBe(64);
    expect(summary.currentStreak).toBe(3);
  });

  it('streak is 0 when today has no completion (honest)', () => {
    const now = new Date(2024, 5, 15, 12, 0);
    const chart = chartWithCompletions([new Date(2024, 5, 13, 9, 0), new Date(2024, 5, 14, 9, 0)]);
    expect(completionSummary(chart, now).currentStreak).toBe(0);
  });

  it('a gap breaks the streak', () => {
    const now = new Date(2024, 5, 15, 12, 0);
    // Today + a gap: Jun 15 and Jun 13 (missing Jun 14) => streak of 1.
    const chart = chartWithCompletions([new Date(2024, 5, 15, 9, 0), new Date(2024, 5, 13, 9, 0)]);
    expect(completionSummary(chart, now).currentStreak).toBe(1);
  });
});
