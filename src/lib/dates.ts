import type { LocalDateKey } from "../types";

/**
 * The ONLY place day-bucketing logic lives in the app.
 *
 * Returns a local-date key ("YYYY-MM-DD") derived from the device's local
 * calendar fields at the moment of the event. We deliberately use
 * getFullYear/getMonth/getDate — NOT toISOString(), which is UTC and would
 * misfile late-night entries onto the wrong day for users west of UTC.
 *
 * The "day" an event belongs to is decided once, at write time, and never
 * recomputed later, so entries never silently shift buckets after a DST change.
 */
export function toLocalDateKey(date: Date): LocalDateKey {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() is 0-based
  const day = date.getDate();
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/** Convenience: today's local date key. */
export function todayKey(now: Date = new Date()): LocalDateKey {
  return toLocalDateKey(now);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}
