import { describe, expect, it } from 'vitest';
import {
  buildCalendarMonth,
  bucketsFor,
  calendarMonthFor,
  collectCompletions,
  completionSummary,
  dailyBuckets,
  isHabitCheckedToday,
  localDayKey,
  localMonthKey,
  monthlyBuckets,
  stepMonth,
  yearlyBuckets,
} from './completions';
import { createChart } from './factory';
import {
  setActionEstablished,
  setActionHabit,
  setActionText,
  toggleHabitToday,
} from './operations';
import type { Chart } from './types';

const CLOCK = () => '2021-01-01T00:00:00.000Z';

/** A chart with one habit action carrying the given local check-off Dates. */
function chartWithHabit(dates: Date[]): Chart {
  let chart = setActionText(createChart(), 0, 0, 'Meditate', CLOCK);
  chart = setActionHabit(chart, 0, 0, true, CLOCK);
  for (const d of dates) chart = toggleHabitToday(chart, 0, 0, () => d.toISOString());
  return chart;
}

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

describe('habit events (v1.2)', () => {
  it('collectCompletions merges habit check-offs with task completions', () => {
    const task = chartWithCompletions([new Date(2024, 5, 1, 10, 0)]); // one task done
    // Merge a habit with two check-offs onto the same chart.
    let chart = setActionText(task, 1, 0, 'Journal', CLOCK);
    chart = setActionHabit(chart, 1, 0, true, CLOCK);
    chart = toggleHabitToday(chart, 1, 0, () => new Date(2024, 5, 2, 9, 0).toISOString());
    chart = toggleHabitToday(chart, 1, 0, () => new Date(2024, 5, 3, 9, 0).toISOString());
    // 1 task completion + 2 habit check-offs = 3 events.
    expect(collectCompletions(chart)).toHaveLength(3);
  });

  it("ignores a habit's stale stored completedAt (only its check-offs count)", () => {
    let chart = chartWithHabit([new Date(2024, 5, 2, 9, 0)]);
    // Force a stale completedAt on the habit action; it must NOT be counted.
    const pillars = chart.pillars.slice();
    pillars[0] = {
      ...pillars[0],
      actions: pillars[0].actions.map((a, i) =>
        i === 0 ? { ...a, status: 'done' as const, completedAt: '2024-05-20T00:00:00.000Z' } : a,
      ),
    };
    chart = { ...chart, pillars };
    // Only the single check-off is an event; the stale completedAt is ignored.
    expect(collectCompletions(chart)).toHaveLength(1);
  });

  it('isHabitCheckedToday reflects a check-off on the local day of now', () => {
    const chart = chartWithHabit([new Date(2024, 5, 15, 9, 0)]);
    const action = chart.pillars[0].actions[0];
    expect(isHabitCheckedToday(action, new Date(2024, 5, 15, 23, 0))).toBe(true);
    expect(isHabitCheckedToday(action, new Date(2024, 5, 16, 1, 0))).toBe(false);
  });

  it('summary counts an established habit as done but not its many check-offs', () => {
    const now = new Date(2024, 5, 15, 12, 0);
    let chart = chartWithHabit([
      new Date(2024, 5, 13, 9, 0),
      new Date(2024, 5, 14, 9, 0),
      new Date(2024, 5, 15, 9, 0),
    ]);
    chart = setActionEstablished(chart, 0, 0, true, CLOCK);
    const summary = completionSummary(chart, now);
    // One established habit => 1 done (NOT the 3 events).
    expect(summary.totalDone).toBe(1);
    // But the streak is driven by the 3 consecutive event days.
    expect(summary.currentStreak).toBe(3);
  });

  it('daily buckets count habit check-offs as events', () => {
    const now = new Date(2024, 5, 15, 12, 0);
    const chart = chartWithHabit([new Date(2024, 5, 15, 9, 0), new Date(2024, 5, 14, 9, 0)]);
    const buckets = bucketsFor(chart, 'daily', now);
    const byKey = new Map(buckets.map((b) => [b.key, b.count]));
    expect(byKey.get('2024-06-15')).toBe(1);
    expect(byKey.get('2024-06-14')).toBe(1);
  });
});

describe('calendar month (v1.2)', () => {
  it('lays out a month as week rows of 7, Sunday-first, with correct padding', () => {
    // June 2024: Jun 1 is a Saturday, so the first week has 6 leading pads.
    const cal = buildCalendarMonth([], 2024, 5, new Date(2024, 5, 15, 12, 0));
    expect(cal.label).toBe('June 2024');
    expect(cal.weekdayHeaders[0]).toBe('Sun');
    expect(cal.weekdayHeaders[6]).toBe('Sat');
    for (const week of cal.weeks) expect(week).toHaveLength(7);
    // First row: 6 padding cells then Jun 1 (a Saturday).
    const firstWeek = cal.weeks[0];
    expect(firstWeek.slice(0, 6).every((d) => d.day === null)).toBe(true);
    expect(firstWeek[6].day).toBe(1);
    // 30 real days appear exactly once.
    const realDays = cal.weeks.flat().filter((d) => d.day !== null);
    expect(realDays).toHaveLength(30);
  });

  it('shades days by event count and marks today', () => {
    const dates = [
      new Date(2024, 5, 5, 9, 0),
      new Date(2024, 5, 5, 21, 0),
      new Date(2024, 5, 6, 9, 0),
    ];
    const cal = buildCalendarMonth(dates, 2024, 5, new Date(2024, 5, 5, 12, 0));
    const days = cal.weeks.flat();
    const jun5 = days.find((d) => d.day === 5)!;
    const jun6 = days.find((d) => d.day === 6)!;
    const jun7 = days.find((d) => d.day === 7)!;
    expect(jun5.count).toBe(2);
    expect(jun5.isToday).toBe(true);
    expect(jun5.fullLabel).toBe('Jun 5, 2024');
    expect(jun6.count).toBe(1);
    expect(jun6.isToday).toBe(false);
    expect(jun7.count).toBe(0);
    expect(cal.totalCount).toBe(3);
  });

  it('calendarMonthFor derives events straight from a chart', () => {
    const chart = chartWithHabit([new Date(2024, 5, 10, 9, 0)]);
    const cal = calendarMonthFor(chart, 2024, 5, new Date(2024, 5, 15, 12, 0));
    const jun10 = cal.weeks.flat().find((d) => d.day === 10)!;
    expect(jun10.count).toBe(1);
  });

  it('stepMonth normalizes year/month overflow both directions', () => {
    expect(stepMonth(2024, 11, 1)).toEqual({ year: 2025, month: 0 });
    expect(stepMonth(2024, 0, -1)).toEqual({ year: 2023, month: 11 });
  });
});
