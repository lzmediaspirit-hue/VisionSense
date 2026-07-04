import type {
  AppStateV1,
  DesiredReality,
  EvidenceEntry,
  Habit,
  HabitCompletion,
  ID,
  LocalDateKey,
  MentalNudge,
} from "../types";
import { toLocalDateKey } from "./dates";

/** Non-archived desired realities, newest first. */
export function activeDesiredRealities(state: AppStateV1): DesiredReality[] {
  return state.desiredRealities
    .filter((dr) => dr.archivedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function desiredRealityById(
  state: AppStateV1,
  id: ID | undefined
): DesiredReality | undefined {
  if (!id) return undefined;
  return state.desiredRealities.find((dr) => dr.id === id);
}

/** Inner habits sort above outer habits everywhere (C10). Stable within a tier. */
export function sortInnerFirst(habits: Habit[]): Habit[] {
  const rank = (h: Habit) => (h.tier === "inner" ? 0 : 1);
  return [...habits].sort((a, b) => {
    const t = rank(a) - rank(b);
    return t !== 0 ? t : a.createdAt - b.createdAt;
  });
}

/** Active (non-archived) habits scoped to a desired reality, inner-first. */
export function habitsForReality(state: AppStateV1, drId: ID): Habit[] {
  return sortInnerFirst(
    state.habits.filter((h) => h.desiredRealityId === drId && h.archivedAt == null)
  );
}

/**
 * Whether a habit is due on a given local day per its HabitSchedule:
 *  - daily: every day
 *  - weekly: when the day-of-week is listed
 *  - oneOff: on its targetDate (or, with no targetDate, treated as "someday" —
 *    always surfaced until it is kept)
 */
export function isHabitDueOn(habit: Habit, date: Date): boolean {
  const s = habit.schedule;
  switch (s.kind) {
    case "daily":
      return true;
    case "weekly":
      return (s.daysOfWeek ?? []).includes(date.getDay());
    case "oneOff":
      return s.targetDate == null || s.targetDate === toLocalDateKey(date);
    default:
      return false;
  }
}

/**
 * Active habits from non-archived desired realities that are due on `date`,
 * ordered inner-first across all goals.
 */
export function habitsDueToday(state: AppStateV1, date: Date = new Date()): Habit[] {
  const liveGoalIds = new Set(
    state.desiredRealities.filter((dr) => dr.archivedAt == null).map((dr) => dr.id)
  );
  const due = state.habits.filter(
    (h) =>
      h.archivedAt == null &&
      h.active &&
      liveGoalIds.has(h.desiredRealityId) &&
      isHabitDueOn(h, date)
  );
  return sortInnerFirst(due);
}

/** Today's completion record for a habit, if one exists. */
export function completionFor(
  state: AppStateV1,
  habitId: ID,
  dateKey: LocalDateKey
): HabitCompletion | undefined {
  return state.habitCompletions.find(
    (c) => c.habitId === habitId && c.dateKey === dateKey
  );
}

/** Whether a base-state check-in has already been logged for the given day. */
export function hasCheckInOn(state: AppStateV1, dateKey: LocalDateKey): boolean {
  return state.checkIns.some((c) => c.dateKey === dateKey);
}

/**
 * Read the cached headline stats for display. This is intentionally a thin
 * stub over the persisted ProfileStats cache (defaults selfTrust=50,
 * momentum=0). Phase 2 (M3) replaces the write side by recomputing these from
 * the Self-Trust ledger + Momentum decay; this read seam stays the same.
 */
export function cachedStats(state: AppStateV1): {
  selfTrust: number;
  momentum: number;
} {
  const p = state.profileStats;
  return {
    selfTrust: Math.round(p?.selfTrust ?? 50),
    momentum: Math.round(p?.momentumDisplayed ?? 0),
  };
}

/** Open (not yet acted-on/released) nudges, oldest-captured first. */
export function openNudges(state: AppStateV1): MentalNudge[] {
  return state.mentalNudges
    .filter((n) => n.status === "open")
    .sort((a, b) => a.capturedAt - b.capturedAt);
}

/** Nudges that have been acted on or released, most recent first. */
export function nudgeHistory(state: AppStateV1): MentalNudge[] {
  return state.mentalNudges
    .filter((n) => n.status !== "open")
    .sort((a, b) => (b.actedAt ?? b.capturedAt) - (a.actedAt ?? a.capturedAt));
}

/** The Evidence/Wins feed, reverse-chronological. */
export function evidenceFeed(state: AppStateV1): EvidenceEntry[] {
  return [...state.evidenceEntries].sort((a, b) => b.createdAt - a.createdAt);
}
