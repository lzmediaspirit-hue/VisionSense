import { describe, expect, it } from 'vitest';
import { createChart } from '../model/factory';
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
