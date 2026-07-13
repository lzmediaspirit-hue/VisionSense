// Completion history bucketing for the Progress graph (SPEC 7.2) and calendar
// (SPEC 8.4). Pure and unit-tested. An "event" is a habit daily check-off (each
// `completions` entry) or a task completion (`completedAt`) — see collectCompletions.
// Events are bucketed into daily / monthly / yearly counts for the bar chart and
// into a month grid for the calendar.
//
// TIMEZONE NOTE: buckets are keyed by the viewer's LOCAL calendar (via the
// Date's local getFullYear/getMonth/getDate), never by slicing the UTC ISO
// string. A completion at 2024-06-01T23:30:00-05:00 belongs to June 1 for a
// US-Central viewer even though its UTC date is June 2.

import { chartProgress } from './progress';
import { TOTAL_ACTIONS, type Action, type Chart } from './types';

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
 * All completion EVENTS in a chart, as local Dates (SPEC 8.3): every habit
 * daily check-off (`completions` entries) plus every task completion
 * (`completedAt`). A habit's stored `completedAt` is ignored — its check-offs
 * live in `completions` — so events are never double-counted. Unparseable
 * timestamps are skipped rather than throwing.
 */
export function collectCompletions(chart: Chart): Date[] {
  const dates: Date[] = [];
  const push = (iso: string | null) => {
    if (iso === null) return;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) dates.push(d);
  };
  for (const pillar of chart.pillars) {
    for (const action of pillar.actions) {
      for (const c of action.completions) push(c);
      // For a habit the stored completedAt is ignored (SPEC 8.1); a task's
      // completion is the event.
      if (!action.habit) push(action.completedAt);
    }
  }
  return dates;
}

/** Whether a habit action has a check-off on the local day of `now`. */
export function isHabitCheckedToday(action: Action, now: Date = new Date()): boolean {
  const today = localDayKey(now);
  return action.completions.some((c) => {
    const d = new Date(c);
    return !Number.isNaN(d.getTime()) && localDayKey(d) === today;
  });
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
  /** Actions counting as done toward chart progress (task done / habit established). */
  totalDone: number;
  /** Denominator: the fixed 64 action cells. */
  total: number;
  /** Consecutive local days with >= 1 event, ending today (0 if today has none). */
  currentStreak: number;
}

/**
 * Overall summary for the Progress dialog. `totalDone` is the chart-progress
 * count (SPEC 8.3): a task done + a habit established — NOT the raw event count
 * (which can far exceed 64). `currentStreak` counts backwards from today: the
 * run of consecutive local days each having at least one event, ending on
 * `now`'s day — so a day with no events today yields a streak of 0 (honest: the
 * streak only lives while you keep going).
 */
export function completionSummary(chart: Chart, now: Date = new Date()): CompletionSummary {
  const dates = collectCompletions(chart);
  return {
    totalDone: chartProgress(chart).done,
    total: TOTAL_ACTIONS,
    currentStreak: streakFromDates(dates, now),
  };
}

/**
 * Consecutive local days with >= 1 event, counting back from `now`'s day. A day
 * with no events today yields 0 (honest — the streak only lives while you keep
 * going). Shared by the per-chart summary and the all-charts Today streak.
 */
export function streakFromDates(dates: Date[], now: Date = new Date()): number {
  const activeDays = new Set(dates.map(localDayKey));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (activeDays.has(localDayKey(d))) streak++;
    else break;
  }
  return streak;
}

/**
 * Current streak of consecutive local days with >= 1 event across ALL charts
 * (SPEC 11.2 — the Today view's streak). Events from every chart are pooled
 * before counting.
 */
export function streakAcrossCharts(charts: readonly Chart[], now: Date = new Date()): number {
  const dates: Date[] = [];
  for (const chart of charts) dates.push(...collectCompletions(chart));
  return streakFromDates(dates, now);
}

// --- Calendar (SPEC 8.4) -----------------------------------------------------
//
// Pure month-grid builder for the Progress dialog's Calendar tab. Weeks start on
// SUNDAY (locale-neutral); the weekday header below is kept in that same order.

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface CalendarDay {
  /** React key (day key for real days, 'pad-N' for padding cells). */
  key: string;
  /** Day of month 1..31, or null for padding cells outside the month. */
  day: number | null;
  /** Event count on this day (0 for padding). */
  count: number;
  /** True for the cell matching `today`'s local day. */
  isToday: boolean;
  /** Full label e.g. 'Jul 5, 2026', or null for padding. */
  fullLabel: string | null;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0..11
  /** Header label e.g. 'July 2026'. */
  label: string;
  /** Weekday headers in display order (Sunday first). */
  weekdayHeaders: readonly string[];
  /** Week rows, each exactly length 7. */
  weeks: CalendarDay[][];
  /** Total events across the whole month (for the accessible summary). */
  totalCount: number;
}

/**
 * Build the month grid for `year`/`month` (0..11) from `dates`, shading data
 * available as per-day counts. Leading/trailing cells pad each week to length 7.
 * `today` is injectable for deterministic tests.
 */
export function buildCalendarMonth(
  dates: Date[],
  year: number,
  month: number,
  today: Date = new Date(),
): CalendarMonth {
  const counts = countByKey(dates, localDayKey);
  const todayKey = localDayKey(today);
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarDay[] = [];
  const pad = () => cells.push({ key: `pad-${cells.length}`, day: null, count: 0, isToday: false, fullLabel: null });
  for (let i = 0; i < firstWeekday; i++) pad();
  let totalCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = localDayKey(date);
    const count = counts.get(key) ?? 0;
    totalCount += count;
    cells.push({
      key,
      day: d,
      count,
      isToday: key === todayKey,
      fullLabel: `${MONTHS[month]} ${d}, ${year}`,
    });
  }
  while (cells.length % 7 !== 0) pad();

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    year,
    month,
    label: `${MONTH_NAMES[month]} ${year}`,
    weekdayHeaders: WEEKDAY_HEADERS,
    weeks,
    totalCount,
  };
}

/** Convenience: build a chart's month grid straight from its events. */
export function calendarMonthFor(
  chart: Chart,
  year: number,
  month: number,
  today: Date = new Date(),
): CalendarMonth {
  return buildCalendarMonth(collectCompletions(chart), year, month, today);
}

/** Step a {year, month} pair by `delta` months, normalizing overflow. */
export function stepMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
