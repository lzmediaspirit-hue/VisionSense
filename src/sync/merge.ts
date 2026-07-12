// Pure merge logic for Google Drive sync (SPEC 10.3). No I/O, no globals — every
// function here is deterministic and unit-tested (see merge.test.ts).
//
// Model:
//   - Charts are merged per id, LAST-WRITE-WINS on `updatedAt`.
//   - Charts present on only one side are kept (union).
//   - Deletions are tombstones: `Record<chartId, deletedAtISO>`. A tombstone that
//     is NEWER than a chart's `updatedAt` deletes it; otherwise the chart survives
//     (it was re-created/edited after the deletion) and the stale tombstone is
//     dropped.
//   - Tombstones older than 90 days are pruned.
// The result is stable under re-merge (idempotent).

import type { Chart } from '../model/types';

export type Tombstones = Record<string, string>;

export interface MergeSide {
  charts: readonly Chart[];
  tombstones: Tombstones;
}

export interface MergeResult {
  charts: Chart[];
  tombstones: Tombstones;
}

export const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/** Parse an ISO string to epoch ms; unparseable => 0 (treated as oldest). */
function ms(iso: string | undefined | null): number {
  if (typeof iso !== 'string') return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Union tombstone maps, keeping the newest deletion time per chart id. */
function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const out: Tombstones = { ...a };
  for (const [id, iso] of Object.entries(b)) {
    if (!(id in out) || ms(iso) > ms(out[id])) out[id] = iso;
  }
  return out;
}

/**
 * Merge two sides into a single {charts, tombstones}. `now` is injectable for
 * deterministic pruning tests (defaults to Date.now()).
 */
export function mergeSides(
  local: MergeSide,
  remote: MergeSide,
  now: number = Date.now(),
): MergeResult {
  // 1. Per-id LWW union of charts.
  const byId = new Map<string, Chart>();
  for (const chart of local.charts) byId.set(chart.id, chart);
  for (const chart of remote.charts) {
    const existing = byId.get(chart.id);
    if (!existing || ms(chart.updatedAt) > ms(existing.updatedAt)) {
      byId.set(chart.id, chart);
    }
  }

  // 2. Union of tombstones (newest deletion wins per id).
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);

  // 3. Apply tombstones. A tombstone strictly newer than the chart deletes it;
  //    otherwise the chart wins and the stale tombstone is dropped.
  const survivors: Chart[] = [];
  for (const chart of byId.values()) {
    const deletedAt = tombstones[chart.id];
    if (deletedAt !== undefined && ms(deletedAt) > ms(chart.updatedAt)) {
      // Tombstone wins: chart stays deleted, tombstone retained.
      continue;
    }
    // Chart wins (or no tombstone): keep chart, drop any stale tombstone.
    if (deletedAt !== undefined) delete tombstones[chart.id];
    survivors.push(chart);
  }

  // 4. Prune tombstones older than 90 days.
  for (const [id, iso] of Object.entries(tombstones)) {
    if (now - ms(iso) > TOMBSTONE_MAX_AGE_MS) delete tombstones[id];
  }

  return { charts: survivors, tombstones };
}
