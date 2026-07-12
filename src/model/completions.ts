// Completion history bucketing for the Progress graph (SPEC 7.2). Pure and
// unit-tested. Buckets an action's `completedAt` timestamps into daily / monthly
// / yearly counts for a hand-rolled bar chart.
//
// TIMEZONE NOTE: buckets are keyed by the viewer's LOCAL calendar (via the
// Date's local getFullYear/getMonth/getDate), never by slicing the UTC ISO
// string. A completion at 2024-06-01T23:30:00-05:00 belongs to June 1 for a
// US-Central viewer even though its UTC date is June 2.

import { TOTAL_ACTIONS, type Chart } from './types';

export type ProgressView = 'daily' | 'monthly' | 'yearly';

export interface CompletionBucket {
  /** Machine key: 'YYYY-MM-DD' (daily), 'YYYY-MM' (monthly), 'YYYY' (yearly). */
  key: string;
  /** Short human label for the axis (e.g. 'Jun 1', 'Jun', '2024'). */
  label: string;
  /** Full label for the accessible text summary (e.g. 'Jun 1, 2024'). */
  fullLabel: string;
  count: number;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local 'YYYY-MM-DD' for a Date (no UTC slicing). */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local 'YYYY-MM' for a Date. */
export function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/**
 * All valid completion timestamps in a chart, as local Dates. Only actions with
 * a non-null, parseable `completedAt` count (an action currently in 'done').
 */
export function collectCompletions(chart: Chart): Date[] {
  const dates: Date[] = [];
  for (const pillar of chart.pillars) {
    for (const action of pillar.actions) {
      if (action.completedAt === null) continue;
      const d = new Date(action.completedAt);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  }
  return dates;
}

/** Index completions by a local key function → key -> count. */
function countByKey(dates: Date[], keyOf: (d: Date) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = keyOf(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Daily buckets for the last `days` days ending on `now` (local), inclusive. */
export function dailyBuckets(dates: Date[], now: Date = new Date(), days = 30): CompletionBucket[] {
  const counts = countByKey(dates, localDayKey);
  const buckets: CompletionBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // Step back i local days from `now` by constructing a local Date.
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = localDayKey(d);
    buckets.push({
      key,
      label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      fullLabel: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

/** Monthly buckets for the last `months` months ending on `now` (local), inclusive. */
export function monthlyBuckets(
  dates: Date[],
  now: Date = new Date(),
  months = 12,
): CompletionBucket[] {
  const counts = countByKey(dates, localMonthKey);
  const buckets: CompletionBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = localMonthKey(d);
    buckets.push({
      key,
      label: MONTHS[d.getMonth()],
      fullLabel: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      count: counts.get(key) ?? 0,
    });
  }
  return buckets;
}

/**
 * Yearly buckets from the earliest completion year through the current year
 * (local), inclusive. With no completions it's just the current year, so the
 * chart never renders empty.
 */
export function yearlyBuckets(dates: Date[], now: Date = new Date()): CompletionBucket[] {
  const counts = countByKey(dates, (d) => `${d.getFullYear()}`);
  const currentYear = now.getFullYear();
  let startYear = currentYear;
  for (const d of dates) startYear = Math.min(startYear, d.getFullYear());
  const buckets: CompletionBucket[] = [];
  for (let year = startYear; year <= currentYear; year++) {
    const key = `${year}`;
    buckets.push({ key, label: key, fullLabel: key, count: counts.get(key) ?? 0 });
  }
  return buckets;
}

/** Build the buckets for a given view. */
export function bucketsFor(
  chart: Chart,
  view: ProgressView,
  now: Date = new Date(),
): CompletionBucket[] {
  const dates = collectCompletions(chart);
  switch (view) {
    case 'daily':
      return dailyBuckets(dates, now);
    case 'monthly':
      return monthlyBuckets(dates, now);
    case 'yearly':
      return yearlyBuckets(dates, now);
  }
}

export interface CompletionSummary {
  /** Total actions currently completed (have a completedAt). */
  totalDone: number;
  /** Denominator: the fixed 64 action cells. */
  total: number;
  /** Consecutive local days with >= 1 completion, ending today (0 if today has none). */
  currentStreak: number;
}

/**
 * Overall summary for the Progress dialog. `currentStreak` counts backwards from
 * today: it is the run of consecutive local days each having at least one
 * completion, ending on `now`'s day — so a day with no completions today yields
 * a streak of 0 (honest: the streak only lives while you keep completing).
 */
export function completionSummary(chart: Chart, now: Date = new Date()): CompletionSummary {
  const dates = collectCompletions(chart);
  const activeDays = new Set(dates.map(localDayKey));
  let currentStreak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (activeDays.has(localDayKey(d))) currentStreak++;
    else break;
  }
  return { totalDone: dates.length, total: TOTAL_ACTIONS, currentStreak };
}
