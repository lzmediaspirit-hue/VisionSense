// Pure per-key LWW merge for the v1.4 journal (day plans + weekly reviews),
// mirroring the chart merge in merge.ts (SPEC 11.4). No I/O; unit-tested for
// union, LWW in both directions, and idempotence.
//
// Model: days and reviews are keyed records (local YYYY-MM-DD, ISO week
// YYYY-Www). Each value carries an `updatedAt`. On merge, for every key present
// on either side the entry with the newer `updatedAt` wins; ties keep local
// (matches mergeSides, which only lets remote replace when STRICTLY newer).

import type { DayPlan, Review } from '../model/types';

export interface Journal {
  days: Record<string, DayPlan>;
  reviews: Record<string, Review>;
}

/** ISO string -> epoch ms; unparseable => 0 (treated as oldest). */
function ms(iso: string | undefined | null): number {
  if (typeof iso !== 'string') return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Per-key LWW union of two records whose values carry `updatedAt`. */
function mergeRecord<T extends { updatedAt: string }>(
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...local };
  for (const [key, value] of Object.entries(remote)) {
    const existing = out[key];
    if (!existing || ms(value.updatedAt) > ms(existing.updatedAt)) {
      out[key] = value;
    }
  }
  return out;
}

/** Merge two journals per-key, last-write-wins on `updatedAt`. */
export function mergeJournals(local: Journal, remote: Journal): Journal {
  return {
    days: mergeRecord(local.days, remote.days),
    reviews: mergeRecord(local.reviews, remote.reviews),
  };
}
