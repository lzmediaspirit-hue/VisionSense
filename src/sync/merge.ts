// Pure merge logic for Google Drive sync (SPEC 10.3, SPEC 20). No I/O, no
// globals — every function here is deterministic and unit-tested (see
// merge.test.ts).
//
// Model:
//   - Charts present on only one side are kept (union).
//   - Charts present on BOTH sides are merged STRUCTURALLY, per action, not
//     whole-chart LWW (SPEC 20): a single stale field on one device no longer
//     wipes every other field the other device edited. The side with the
//     strictly newer `chart.updatedAt` is the WINNER (ties -> local) and
//     supplies chart-level fields (goal, themeId, templateId, createdAt,
//     pillar names/colors); merged `chart.updatedAt` is the max of both
//     sides. Actions merge per position (8x8 is fixed): scalar fields come
//     from whichever side has the strictly newer `action.updatedAt` (ties ->
//     local; '' — pre-v2.2 data — always loses to a real stamp), while
//     `completions` is always the UNION of both sides regardless of which
//     side won the scalars (habit check-ins are an append-mostly set; a union
//     never loses a check-in).
//   - Deletions are tombstones: `Record<chartId, deletedAtISO>`. A tombstone that
//     is NEWER than a chart's `updatedAt` deletes it; otherwise the chart survives
//     (it was re-created/edited after the deletion) and the stale tombstone is
//     dropped.
//   - Tombstones older than 90 days are pruned.
// The result is stable under re-merge (idempotent).

import type { Action, Chart } from '../model/types';

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
 * Merge one action position. `remoteChartWins` is the CHART-level winner (not
 * an action-level decision) and is only consulted for the defensive id-
 * mismatch path: same chart id but a differing action id at this position
 * shouldn't happen (the 8x8 grid is structural) but if it ever does, the
 * chart-level winner's action is kept unchanged rather than guessing.
 */
function mergeAction(localAction: Action, remoteAction: Action, remoteChartWins: boolean): Action {
  if (localAction.id !== remoteAction.id) {
    return remoteChartWins ? remoteAction : localAction;
  }
  // Scalar fields: strictly-newer action.updatedAt wins; ties -> local. ''
  // (never stamped) parses as epoch 0, so it always loses to a real stamp.
  const remoteNewer = ms(remoteAction.updatedAt) > ms(localAction.updatedAt);
  const scalarSource = remoteNewer ? remoteAction : localAction;
  // completions union regardless of which side won the scalars — check-ins
  // are an append-mostly set, so a union never drops one.
  const completions = Array.from(
    new Set([...localAction.completions, ...remoteAction.completions]),
  ).sort();
  return { ...scalarSource, completions };
}

/**
 * Structurally merge two charts that share an id (SPEC 20). Chart-level
 * fields come from the LWW winner (ties -> local); actions merge per
 * position via `mergeAction`.
 */
function mergeChart(local: Chart, remote: Chart): Chart {
  const remoteChartWins = ms(remote.updatedAt) > ms(local.updatedAt); // ties -> local
  const winner = remoteChartWins ? remote : local;
  const mergedUpdatedAt = remoteChartWins ? remote.updatedAt : local.updatedAt; // = max(both)
  const pillars = winner.pillars.map((winnerPillar, pillarIndex) => {
    const localPillar = local.pillars[pillarIndex];
    const remotePillar = remote.pillars[pillarIndex];
    const actions = winnerPillar.actions.map((_, actionIndex) =>
      mergeAction(
        localPillar.actions[actionIndex],
        remotePillar.actions[actionIndex],
        remoteChartWins,
      ),
    );
    return { ...winnerPillar, actions };
  });
  return { ...winner, pillars, updatedAt: mergedUpdatedAt };
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
  // 1. Per-id union of charts: present on one side only => kept as-is;
  //    present on both => structural per-action merge (SPEC 20).
  const byId = new Map<string, Chart>();
  for (const chart of local.charts) byId.set(chart.id, chart);
  for (const chart of remote.charts) {
    const existingLocal = byId.get(chart.id);
    byId.set(chart.id, existingLocal ? mergeChart(existingLocal, chart) : chart);
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
