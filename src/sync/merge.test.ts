import { describe, expect, it } from 'vitest';
import { createChart } from '../model/factory';
import {
  setActionDetails,
  setActionText,
  toggleHabitToday,
} from '../model/operations';
import type { Chart } from '../model/types';
import { mergeSides, TOMBSTONE_MAX_AGE_MS, type MergeSide } from './merge';

function chart(id: string, updatedAt: string, goal = id): Chart {
  return {
    ...createChart({ goal, now: () => updatedAt }),
    id,
    updatedAt,
  };
}

function side(charts: Chart[], tombstones: Record<string, string> = {}): MergeSide {
  return { charts, tombstones };
}

const NOW = Date.parse('2026-07-12T00:00:00.000Z');

describe('mergeSides', () => {
  it('unions charts present on only one side', () => {
    const local = side([chart('a', '2026-01-01T00:00:00.000Z')]);
    const remote = side([chart('b', '2026-01-02T00:00:00.000Z')]);
    const { charts } = mergeSides(local, remote, NOW);
    expect(charts.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('last-write-wins: remote newer overwrites local', () => {
    const local = side([chart('a', '2026-01-01T00:00:00.000Z', 'old')]);
    const remote = side([chart('a', '2026-02-01T00:00:00.000Z', 'new')]);
    const { charts } = mergeSides(local, remote, NOW);
    expect(charts).toHaveLength(1);
    expect(charts[0].goal).toBe('new');
  });

  it('last-write-wins: local newer overwrites remote', () => {
    const local = side([chart('a', '2026-03-01T00:00:00.000Z', 'newer')]);
    const remote = side([chart('a', '2026-02-01T00:00:00.000Z', 'older')]);
    const { charts } = mergeSides(local, remote, NOW);
    expect(charts).toHaveLength(1);
    expect(charts[0].goal).toBe('newer');
  });

  it('tombstone newer than chart deletes the chart (tombstone retained)', () => {
    const local = side([chart('a', '2026-06-20T00:00:00.000Z')]);
    const remote = side([], { a: '2026-07-01T00:00:00.000Z' });
    const { charts, tombstones } = mergeSides(local, remote, NOW);
    expect(charts).toHaveLength(0);
    expect(tombstones.a).toBe('2026-07-01T00:00:00.000Z');
  });

  it('tombstone older than chart loses (chart survives, tombstone dropped)', () => {
    // Chart edited AFTER it was deleted elsewhere => resurrection wins.
    const local = side([chart('a', '2026-07-05T00:00:00.000Z')]);
    const remote = side([], { a: '2026-07-01T00:00:00.000Z' });
    const { charts, tombstones } = mergeSides(local, remote, NOW);
    expect(charts).toHaveLength(1);
    expect(tombstones.a).toBeUndefined();
  });

  it('keeps a tombstone with no matching chart on either side', () => {
    const local = side([], { gone: '2026-06-01T00:00:00.000Z' });
    const remote = side([]);
    const { charts, tombstones } = mergeSides(local, remote, NOW);
    expect(charts).toHaveLength(0);
    expect(tombstones.gone).toBe('2026-06-01T00:00:00.000Z');
  });

  it('prunes tombstones older than 90 days', () => {
    const old = new Date(NOW - TOMBSTONE_MAX_AGE_MS - 1000).toISOString();
    const fresh = new Date(NOW - 1000).toISOString();
    const local = side([], { old, fresh });
    const { tombstones } = mergeSides(local, side([]), NOW);
    expect(tombstones.old).toBeUndefined();
    expect(tombstones.fresh).toBe(fresh);
  });

  it('unions tombstones keeping the newest deletion time per id', () => {
    const local = side([], { a: '2026-05-01T00:00:00.000Z' });
    const remote = side([], { a: '2026-06-01T00:00:00.000Z' });
    const { tombstones } = mergeSides(local, remote, NOW);
    expect(tombstones.a).toBe('2026-06-01T00:00:00.000Z');
  });

  it('is idempotent: merging the result again is stable', () => {
    const local = side([chart('a', '2026-03-01T00:00:00.000Z'), chart('b', '2026-01-01T00:00:00.000Z')], {
      old: new Date(NOW - TOMBSTONE_MAX_AGE_MS - 1000).toISOString(),
    });
    const remote = side([chart('b', '2026-02-01T00:00:00.000Z'), chart('c', '2026-04-01T00:00:00.000Z')], {
      a: '2026-01-15T00:00:00.000Z', // older than a's updatedAt => dropped
      gone: '2026-06-01T00:00:00.000Z',
    });
    const first = mergeSides(local, remote, NOW);
    const second = mergeSides(first, first, NOW);
    expect(second.charts.map((c) => c.id).sort()).toEqual(first.charts.map((c) => c.id).sort());
    expect(second.tombstones).toEqual(first.tombstones);
    // Sanity: b resolved to the newer (remote) copy, c present, a survived.
    expect(first.charts.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
    expect(first.tombstones.a).toBeUndefined();
    expect(first.tombstones.old).toBeUndefined();
    expect(first.tombstones.gone).toBe('2026-06-01T00:00:00.000Z');
  });

  it('does not mutate the input tombstone maps', () => {
    const localTomb = { a: '2026-01-15T00:00:00.000Z' };
    const local = side([chart('a', '2026-03-01T00:00:00.000Z')], localTomb);
    mergeSides(local, side([]), NOW);
    expect(localTomb).toEqual({ a: '2026-01-15T00:00:00.000Z' });
  });
});

// --- Per-action structural merge (v2.2, SPEC 20) ------------------------------
//
// These build both sides from the SAME base chart (same chart id, same pillar
// and action ids throughout) via real operations, mirroring the actual
// divergence bug: a phone habit-check and a PC text-edit on the same chart,
// both stale relative to each other's `chart.updatedAt`.

describe('mergeSides — per-action merge (SPEC 20)', () => {
  function baseChart(): Chart {
    return createChart({ goal: 'Base', now: () => '2026-01-01T00:00:00.000Z' });
  }

  it('phone habit-check + PC text-edit on the same chart both survive', () => {
    const base = baseChart();
    // Phone: only checks off a habit today. Stale chart.updatedAt overall.
    const phone = toggleHabitToday(base, 0, 0, () => '2026-07-10T08:00:00.000Z');
    // PC: edits unrelated action text, LATER — this chart.updatedAt wins.
    const pc = setActionText(base, 1, 1, 'Ship the report', () => '2026-07-12T09:00:00.000Z');

    const { charts } = mergeSides(side([pc]), side([phone]), NOW);
    expect(charts).toHaveLength(1);
    const merged = charts[0];
    // PC's text edit is not wiped by the phone being "whole-chart newer or older".
    expect(merged.pillars[1].actions[1].text).toBe('Ship the report');
    // Phone's habit check-in survives too (completions are unioned).
    expect(merged.pillars[0].actions[0].completions).toEqual(['2026-07-10T08:00:00.000Z']);
  });

  it('completions union dedupes an identical check-in present on both sides', () => {
    const base = baseChart();
    const shared = '2026-07-10T08:00:00.000Z';
    const local = toggleHabitToday(base, 2, 2, () => shared);
    const remote = toggleHabitToday(base, 2, 2, () => shared);
    const { charts } = mergeSides(side([local]), side([remote]), NOW);
    expect(charts[0].pillars[2].actions[2].completions).toEqual([shared]);
  });

  it('completions union sorts entries from both sides ascending', () => {
    const base = baseChart();
    const local = toggleHabitToday(base, 3, 3, () => '2026-07-11T00:00:00.000Z');
    const remote = toggleHabitToday(base, 3, 3, () => '2026-07-09T00:00:00.000Z');
    const { charts } = mergeSides(side([local]), side([remote]), NOW);
    expect(charts[0].pillars[3].actions[3].completions).toEqual([
      '2026-07-09T00:00:00.000Z',
      '2026-07-11T00:00:00.000Z',
    ]);
  });

  it('scalar LWW respects action.updatedAt: remote newer overwrites local text', () => {
    const base = baseChart();
    const local = setActionText(base, 0, 0, 'old text', () => '2026-07-01T00:00:00.000Z');
    const remote = setActionText(base, 0, 0, 'new text', () => '2026-07-05T00:00:00.000Z');
    const { charts } = mergeSides(side([local]), side([remote]), NOW);
    expect(charts[0].pillars[0].actions[0].text).toBe('new text');
    expect(charts[0].pillars[0].actions[0].updatedAt).toBe('2026-07-05T00:00:00.000Z');
  });

  it('scalar LWW respects action.updatedAt: local newer overwrites remote text', () => {
    const base = baseChart();
    const local = setActionText(base, 0, 0, 'new text', () => '2026-07-05T00:00:00.000Z');
    const remote = setActionText(base, 0, 0, 'old text', () => '2026-07-01T00:00:00.000Z');
    const { charts } = mergeSides(side([local]), side([remote]), NOW);
    expect(charts[0].pillars[0].actions[0].text).toBe('new text');
    expect(charts[0].pillars[0].actions[0].updatedAt).toBe('2026-07-05T00:00:00.000Z');
  });

  it('tie on action.updatedAt keeps local', () => {
    const base = baseChart();
    const sameStamp = () => '2026-07-05T00:00:00.000Z';
    const local = setActionDetails(base, 0, 0, { description: 'local desc' }, sameStamp);
    const remote = setActionDetails(base, 0, 0, { description: 'remote desc' }, sameStamp);
    const { charts } = mergeSides(side([local]), side([remote]), NOW);
    expect(charts[0].pillars[0].actions[0].description).toBe('local desc');
  });

  it("an action with '' updatedAt (never stamped) loses to any real stamp, either direction", () => {
    const base = baseChart(); // every action.updatedAt === ''
    const remoteStamped = setActionText(base, 0, 0, 'remote wins', () => '2026-07-05T00:00:00.000Z');
    // local unstamped vs remote stamped: remote wins.
    const r1 = mergeSides(side([base]), side([remoteStamped]), NOW);
    expect(r1.charts[0].pillars[0].actions[0].text).toBe('remote wins');

    const localStamped = setActionText(base, 0, 0, 'local wins', () => '2026-07-05T00:00:00.000Z');
    // local stamped vs remote unstamped: local wins.
    const r2 = mergeSides(side([localStamped]), side([base]), NOW);
    expect(r2.charts[0].pillars[0].actions[0].text).toBe('local wins');
  });

  it('id-mismatch at a position (defensive path) takes the chart-level winner unchanged', () => {
    // Two independently-created charts forced to share an id: their action ids
    // differ at every position, which should never happen for charts that
    // genuinely share an id, but the merge must not crash or invent data.
    const local: Chart = { ...chart('shared', '2026-07-01T00:00:00.000Z', 'local-goal') };
    const remote: Chart = { ...chart('shared', '2026-07-05T00:00:00.000Z', 'remote-goal') };
    const { charts } = mergeSides(side([local]), side([remote]), NOW);
    expect(charts).toHaveLength(1);
    // Remote is the chart-level winner (strictly newer) => its action objects
    // are kept unchanged at the mismatched positions.
    expect(charts[0].goal).toBe('remote-goal');
    expect(charts[0].pillars[0].actions[0].id).toBe(remote.pillars[0].actions[0].id);
  });

  it('per-action merge is idempotent: re-merging the result is stable', () => {
    const base = baseChart();
    const phone = toggleHabitToday(base, 0, 0, () => '2026-07-10T08:00:00.000Z');
    const pc = setActionText(base, 1, 1, 'Ship the report', () => '2026-07-12T09:00:00.000Z');
    const first = mergeSides(side([pc]), side([phone]), NOW);
    const second = mergeSides(
      { charts: first.charts, tombstones: first.tombstones },
      { charts: first.charts, tombstones: first.tombstones },
      NOW,
    );
    expect(second.charts).toEqual(first.charts);
    expect(second.tombstones).toEqual(first.tombstones);
  });
});
