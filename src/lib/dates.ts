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

/** Parse a LocalDateKey back into a Date at local midnight. */
function parseDateKey(key: LocalDateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Enumerate every local date key from `fromKey` to `toKey`, inclusive,
 * ascending. Used by the Momentum fold (formulas.ts) to walk every calendar
 * day between the earliest logged activity and today, so inactive days are
 * folded in as zero-activity days (gentle decay) rather than skipped.
 *
 * `YYYY-MM-DD` keys sort lexicographically the same as chronologically
 * (zero-padded), so plain string comparisons are safe here.
 */
export function enumerateDateKeys(
  fromKey: LocalDateKey,
  toKey: LocalDateKey
): LocalDateKey[] {
  const out: LocalDateKey[] = [];
  if (fromKey > toKey) return out;
  let cursor = parseDateKey(fromKey);
  let guard = 0;
  // Safety bound (~54 years) so a malformed key can't spin the loop forever.
  while (guard < 20000) {
    const key = toLocalDateKey(cursor);
    out.push(key);
    if (key >= toKey) break;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    guard++;
  }
  return out;
}
