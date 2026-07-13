// The "journal" layer (v1.4, SPEC 11.2/11.3): per-day plans and weekly reviews.
// Pure, unit-tested helpers for validation-with-defaults, day pruning, ISO-week
// keying, the MIT cap, and the weekly-review "due" signal. No I/O, no React.

import { localDayKey, streakAcrossCharts } from './completions';
import { isActionFilled } from './progress';
import type { Action, Chart, DayPlan, Review } from './types';

/** Structural cap on the number of MITs ("top 3 for today"). */
export const MAX_MITS = 3;

/** Day plans older than this are pruned on write (SPEC 11.2). */
export const DAY_MAX_AGE_DAYS = 400;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ms(iso: string | undefined | null): number {
  if (typeof iso !== 'string') return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// --- Validation with defaults (mirrors storage.ts's additive-field pattern) ---

/**
 * Validate one DayPlan, defaulting every field. MITs are structurally capped at
 * MAX_MITS and only well-shaped `{chartId, actionId}` entries survive. Returns
 * null only when the value is not an object at all.
 */
export function validateDayPlan(v: unknown): DayPlan | null {
  if (!isRecord(v)) return null;
  const mits: Array<{ chartId: string; actionId: string }> = [];
  if (Array.isArray(v.mits)) {
    for (const m of v.mits) {
      if (mits.length >= MAX_MITS) break;
      if (isRecord(m) && typeof m.chartId === 'string' && typeof m.actionId === 'string') {
        mits.push({ chartId: m.chartId, actionId: m.actionId });
      }
    }
  }
  const note = typeof v.note === 'string' ? v.note : '';
  const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : new Date(0).toISOString();
  return { mits, note, updatedAt };
}

/** Validate a whole days record, dropping unparseable entries. */
export function validateDays(v: unknown): Record<string, DayPlan> {
  if (!isRecord(v)) return {};
  const out: Record<string, DayPlan> = {};
  for (const [key, val] of Object.entries(v)) {
    const plan = validateDayPlan(val);
    if (plan) out[key] = plan;
  }
  return out;
}

/** Validate one Review, defaulting every field. */
export function validateReview(v: unknown): Review | null {
  if (!isRecord(v)) return null;
  const str = (x: unknown): string => (typeof x === 'string' ? x : '');
  const updatedAt = typeof v.updatedAt === 'string' ? v.updatedAt : new Date(0).toISOString();
  return {
    wins: str(v.wins),
    obstacle: str(v.obstacle),
    change: str(v.change),
    focus: str(v.focus),
    updatedAt,
  };
}

/** Validate a whole reviews record, dropping unparseable entries. */
export function validateReviews(v: unknown): Record<string, Review> {
  if (!isRecord(v)) return {};
  const out: Record<string, Review> = {};
  for (const [key, val] of Object.entries(v)) {
    const review = validateReview(val);
    if (review) out[key] = review;
  }
  return out;
}

// --- Day pruning --------------------------------------------------------------

/**
 * Drop day plans older than `maxAgeDays` (by local day key). Returns the SAME
 * reference when nothing is pruned so callers can skip needless writes.
 */
export function pruneDays(
  days: Record<string, DayPlan>,
  now: Date = new Date(),
  maxAgeDays: number = DAY_MAX_AGE_DAYS,
): Record<string, DayPlan> {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - maxAgeDays);
  const cutoffKey = localDayKey(cutoff);
  const out: Record<string, DayPlan> = {};
  let changed = false;
  for (const [key, plan] of Object.entries(days)) {
    // Well-formed YYYY-MM-DD keys compare lexicographically as dates. A key that
    // does not look like a date is kept (never silently discarded).
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && key < cutoffKey) {
      changed = true;
    } else {
      out[key] = plan;
    }
  }
  return changed ? out : days;
}

// --- ISO week keying (SPEC 11.3) ---------------------------------------------

/**
 * ISO-8601 week key `YYYY-Www` for a date's LOCAL calendar day (weeks start
 * Monday; week 1 contains the first Thursday of the year). Uses the local
 * Y/M/D so the key matches the viewer's day, consistent with localDayKey.
 */
export function isoWeekKey(d: Date = new Date()): string {
  // Work in UTC on the local calendar date to avoid DST hour drift.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // move to the week's Thursday
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / WEEK_MS);
  return `${isoYear}-W${pad2(week)}`;
}

/** Human label for an ISO week key, e.g. "2026-W28" -> "Week 28, 2026". */
export function isoWeekLabel(key: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return key;
  return `Week ${Number(m[2])}, ${m[1]}`;
}

// --- Weekly cadence habits (v1.5, SPEC 12) -----------------------------------

/**
 * Count of DISTINCT local days within `now`'s ISO week that have a completion
 * (SPEC 12). A day with two completions (should not happen — `toggleHabitToday`
 * keeps at most one per local day) would still only count once.
 */
export function weekCompletions(action: Action, now: Date = new Date()): number {
  const wk = isoWeekKey(now);
  const days = new Set<string>();
  for (const c of action.completions) {
    const d = new Date(c);
    if (!Number.isNaN(d.getTime()) && isoWeekKey(d) === wk) days.add(localDayKey(d));
  }
  return days.size;
}

/**
 * Whether a weekly habit has met its target for `now`'s ISO week (SPEC 12).
 * Always false for a daily habit (`weeklyTarget === 0`) — meeting a weekly
 * target is meaningless there.
 */
export function isWeeklySatisfied(action: Action, now: Date = new Date()): boolean {
  return action.weeklyTarget >= 1 && weekCompletions(action, now) >= action.weeklyTarget;
}

// --- Weekly-review due signal (SPEC 11.3) ------------------------------------

/**
 * Whether the dashboard Review button should show its "due" badge: the current
 * ISO week has no review yet AND the newest review (if any) is >= 7 days old or
 * absent. No guilt — just a nudge.
 */
export function isReviewDue(reviews: Record<string, Review>, now: Date = new Date()): boolean {
  if (reviews[isoWeekKey(now)]) return false;
  const times = Object.values(reviews).map((r) => ms(r.updatedAt));
  if (times.length === 0) return true;
  const newest = Math.max(...times);
  return now.getTime() - newest >= WEEK_MS;
}

// --- Weekly evidence (v1.9, SPEC 16) -----------------------------------------

/** The current week's evidence for the weekly-review screen (SPEC 16). */
export interface WeekEvidence {
  /** Every filled, non-established habit across all charts, in encounter order. */
  habits: Array<{ name: string; days: number; target: number }>;
  /** Non-habit tasks completed within `now`'s ISO week. */
  tasksDone: number;
  /** Cross-chart streak (SPEC 11.2), reused so the review echoes the Today view. */
  streak: number;
}

/**
 * Gather what actually happened this ISO week, so the weekly-review prompts
 * have something concrete to reflect against (SPEC 16). A daily habit's
 * `target` is 7 (days in the week); a weekly-cadence habit's target is its own
 * `weeklyTarget`. Purely derived — no new state.
 */
export function weekEvidence(charts: readonly Chart[], now: Date = new Date()): WeekEvidence {
  const habits: WeekEvidence['habits'] = [];
  let tasksDone = 0;
  const wk = isoWeekKey(now);
  for (const chart of charts) {
    for (const pillar of chart.pillars) {
      for (const action of pillar.actions) {
        if (action.habit) {
          if (action.established || !isActionFilled(action)) continue;
          habits.push({
            name: action.text.trim(),
            days: weekCompletions(action, now),
            target: action.weeklyTarget >= 1 ? action.weeklyTarget : 7,
          });
        } else if (action.status === 'done' && action.completedAt) {
          const d = new Date(action.completedAt);
          if (!Number.isNaN(d.getTime()) && isoWeekKey(d) === wk) tasksDone++;
        }
      }
    }
  }
  return { habits, tasksDone, streak: streakAcrossCharts(charts, now) };
}
