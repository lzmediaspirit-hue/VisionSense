import { beforeEach, describe, expect, it } from 'vitest';
import { createChart, createInitialState } from './factory';
import {
  BACKUP_KEY,
  loadState,
  migrate,
  saveState,
  STORAGE_KEY,
  type StorageLike,
} from './storage';
import type { AppState } from './types';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function sampleState(): AppState {
  const chart = createChart({ goal: 'Ship v1', now: () => '2022-01-01T00:00:00.000Z' });
  return { schemaVersion: 1, charts: [chart], activeChartId: chart.id, days: {}, reviews: {} };
}

describe('storage', () => {
  let storage: MemStorage;
  beforeEach(() => {
    storage = new MemStorage();
  });

  it('round-trips save then load', () => {
    const state = sampleState();
    saveState(state, storage);
    expect(loadState(storage)).toEqual(state);
  });

  // v2.4 (SPEC 22): bonus picks beyond the Top 3 are NOT clamped anywhere in
  // the persistence path — the day-plan validation used by loadState pins
  // this via journal.ts's validateDayPlan/validateDays.
  it('round-trips a day plan with more than 3 mits (bonus picks) unclamped', () => {
    const state = sampleState();
    const mits = Array.from({ length: 5 }, (_, i) => ({ chartId: 'c', actionId: `a${i}` }));
    state.days = {
      '2026-07-15': { mits, note: '', updatedAt: '2026-07-15T00:00:00.000Z' },
    };
    saveState(state, storage);
    const loaded = loadState(storage);
    expect(loaded.days['2026-07-15'].mits).toHaveLength(5);
    expect(loaded.days['2026-07-15'].mits).toEqual(mits);
  });

  it('returns fresh empty state when nothing is stored', () => {
    expect(loadState(storage)).toEqual(createInitialState());
  });

  it('falls back to empty state and backs up an unparseable blob', () => {
    storage.setItem(STORAGE_KEY, '{not valid json');
    const state = loadState(storage);
    expect(state).toEqual(createInitialState());
    expect(storage.getItem(BACKUP_KEY)).toBe('{not valid json');
  });

  it('falls back and backs up structurally-invalid data (wrong pillar count)', () => {
    const bad = sampleState();
    bad.charts[0].pillars = bad.charts[0].pillars.slice(0, 7); // only 7 pillars
    const raw = JSON.stringify(bad);
    storage.setItem(STORAGE_KEY, raw);
    const state = loadState(storage);
    expect(state).toEqual(createInitialState());
    expect(storage.getItem(BACKUP_KEY)).toBe(raw);
  });

  it('rejects unknown schemaVersion', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, charts: [] }));
    expect(loadState(storage)).toEqual(createInitialState());
    expect(storage.getItem(BACKUP_KEY)).not.toBeNull();
  });

  it('drops a dangling activeChartId that matches no chart', () => {
    const state = sampleState();
    state.activeChartId = 'does-not-exist';
    saveState(state, storage);
    expect(loadState(storage).activeChartId).toBeNull();
  });

  it('migrate validates a well-formed state and rejects junk', () => {
    expect(migrate(sampleState())).not.toBeNull();
    expect(migrate(null)).toBeNull();
    expect(migrate({ schemaVersion: 1 })).toBeNull(); // missing charts
    expect(migrate('nope')).toBeNull();
  });

  it('is a no-op when storage is absent (null)', () => {
    expect(() => saveState(sampleState(), null)).not.toThrow();
    expect(loadState(null)).toEqual(createInitialState());
  });

  // --- v1.1 backward compatibility (SPEC 7.4) --------------------------------

  it('loads a pre-v1.1 blob (actions lacking description/reward/completedAt) with defaults', () => {
    // Hand-build a schemaVersion 1 blob whose actions are the OLD shape: only
    // id/text/status, none of the v1.1 keys. This mirrors data written by an
    // earlier build still sitting in a returning user's localStorage.
    const state = sampleState();
    const legacy = {
      ...state,
      charts: state.charts.map((c) => ({
        ...c,
        pillars: c.pillars.map((p) => ({
          ...p,
          actions: p.actions.map((a) => ({ id: a.id, text: a.text, status: a.status })),
        })),
      })),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    // Not treated as corrupt: no backup written, real charts returned.
    expect(storage.getItem(BACKUP_KEY)).toBeNull();
    expect(loaded.charts).toHaveLength(1);
    for (const pillar of loaded.charts[0].pillars) {
      for (const action of pillar.actions) {
        expect(action.description).toBe('');
        expect(action.reward).toBe('');
        expect(action.completedAt).toBeNull();
      }
    }
  });

  // --- v1.2 backward compatibility (SPEC 8.5) --------------------------------

  it('loads a pre-v1.2 blob (actions lacking habit/established/completions) with defaults', () => {
    // v1.1-shaped actions: they carry description/reward/completedAt but none of
    // the v1.2 habit keys, mirroring a returning user's localStorage.
    const state = sampleState();
    const legacy = {
      ...state,
      charts: state.charts.map((c) => ({
        ...c,
        pillars: c.pillars.map((p) => ({
          ...p,
          actions: p.actions.map((a) => ({
            id: a.id,
            text: a.text,
            status: a.status,
            description: a.description,
            reward: a.reward,
            completedAt: a.completedAt,
          })),
        })),
      })),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    expect(storage.getItem(BACKUP_KEY)).toBeNull(); // not treated as corrupt
    for (const pillar of loaded.charts[0].pillars) {
      for (const action of pillar.actions) {
        expect(action.habit).toBe(false);
        expect(action.established).toBe(false);
        expect(action.completions).toEqual([]);
      }
    }
  });

  it('sanitizes the completions array: keeps only valid date strings', () => {
    const state = sampleState();
    // Hand-poison one action's completions with junk entries.
    const raw = JSON.parse(JSON.stringify(state));
    raw.charts[0].pillars[0].actions[0] = {
      ...raw.charts[0].pillars[0].actions[0],
      habit: true,
      completions: ['2024-06-01T08:00:00.000Z', 'not-a-date', 42, null, '2024-06-02T09:00:00.000Z'],
    };
    // A wrong-typed completions field on another action degrades to [].
    raw.charts[0].pillars[0].actions[1] = {
      ...raw.charts[0].pillars[0].actions[1],
      completions: 'nope',
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const loaded = loadState(storage);
    expect(storage.getItem(BACKUP_KEY)).toBeNull(); // sanitized, not rejected
    expect(loaded.charts[0].pillars[0].actions[0].completions).toEqual([
      '2024-06-01T08:00:00.000Z',
      '2024-06-02T09:00:00.000Z',
    ]);
    expect(loaded.charts[0].pillars[0].actions[1].completions).toEqual([]);
  });

  // --- v1.4 backward compatibility (SPEC 11.5) --------------------------------

  it('loads a pre-v1.4 blob (no cue, no days/reviews) with defaults', () => {
    // Hand-build a schemaVersion 1 blob shaped like a v1.2/v1.3 blob: actions
    // have no `cue`, and the top-level object has no `days`/`reviews` at all —
    // mirroring what a returning user's localStorage (or an old Drive file)
    // actually contains before this build.
    const state = sampleState();
    const legacy: Record<string, unknown> = {
      schemaVersion: state.schemaVersion,
      activeChartId: state.activeChartId,
      charts: state.charts.map((c) => ({
        ...c,
        pillars: c.pillars.map((p) => ({
          ...p,
          actions: p.actions.map((a) => ({
            id: a.id,
            text: a.text,
            status: a.status,
            description: a.description,
            reward: a.reward,
            completedAt: a.completedAt,
            habit: a.habit,
            established: a.established,
            completions: a.completions,
            // no `cue` key at all
          })),
        })),
      })),
      // no `days` or `reviews` keys at all
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadState(storage);
    expect(storage.getItem(BACKUP_KEY)).toBeNull(); // not treated as corrupt
    expect(loaded.days).toEqual({});
    expect(loaded.reviews).toEqual({});
    for (const pillar of loaded.charts[0].pillars) {
      for (const action of pillar.actions) {
        expect(action.cue).toBe('');
      }
    }
  });

  // --- v1.5 backward compatibility (SPEC 12.5) --------------------------------

  it('defaults weeklyTarget to 0 when absent, wrong type, negative, > 7, or a float', () => {
    const state = sampleState();
    const raw = JSON.parse(JSON.stringify(state));
    // absent
    raw.charts[0].pillars[0].actions[0] = { ...raw.charts[0].pillars[0].actions[0] };
    delete raw.charts[0].pillars[0].actions[0].weeklyTarget;
    // wrong type
    raw.charts[0].pillars[0].actions[1] = {
      ...raw.charts[0].pillars[0].actions[1],
      weeklyTarget: '3',
    };
    // negative
    raw.charts[0].pillars[0].actions[2] = {
      ...raw.charts[0].pillars[0].actions[2],
      weeklyTarget: -1,
    };
    // > 7
    raw.charts[0].pillars[0].actions[3] = {
      ...raw.charts[0].pillars[0].actions[3],
      weeklyTarget: 8,
    };
    // float
    raw.charts[0].pillars[0].actions[4] = {
      ...raw.charts[0].pillars[0].actions[4],
      weeklyTarget: 2.5,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const loaded = loadState(storage);
    expect(storage.getItem(BACKUP_KEY)).toBeNull(); // additive, not corrupt
    const actions = loaded.charts[0].pillars[0].actions;
    expect(actions[0].weeklyTarget).toBe(0);
    expect(actions[1].weeklyTarget).toBe(0);
    expect(actions[2].weeklyTarget).toBe(0);
    expect(actions[3].weeklyTarget).toBe(0);
    expect(actions[4].weeklyTarget).toBe(0);
  });

  it('round-trips a valid weeklyTarget', () => {
    const state = sampleState();
    state.charts[0].pillars[0].actions[0] = {
      ...state.charts[0].pillars[0].actions[0],
      habit: true,
      weeklyTarget: 3,
    };
    saveState(state, storage);
    const loaded = loadState(storage);
    expect(loaded.charts[0].pillars[0].actions[0].weeklyTarget).toBe(3);
  });

  // --- v2.2 backward compatibility (SPEC 20) ---------------------------------

  it('defaults action.updatedAt to \'\' when absent or wrong type (pre-v2.2 data)', () => {
    const state = sampleState();
    const raw = JSON.parse(JSON.stringify(state));
    // absent
    raw.charts[0].pillars[0].actions[0] = { ...raw.charts[0].pillars[0].actions[0] };
    delete raw.charts[0].pillars[0].actions[0].updatedAt;
    // wrong type
    raw.charts[0].pillars[0].actions[1] = {
      ...raw.charts[0].pillars[0].actions[1],
      updatedAt: 12345,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const loaded = loadState(storage);
    expect(storage.getItem(BACKUP_KEY)).toBeNull(); // additive, not corrupt
    const actions = loaded.charts[0].pillars[0].actions;
    expect(actions[0].updatedAt).toBe('');
    expect(actions[1].updatedAt).toBe('');
  });

  it('round-trips a valid action.updatedAt', () => {
    const state = sampleState();
    state.charts[0].pillars[0].actions[0] = {
      ...state.charts[0].pillars[0].actions[0],
      updatedAt: '2026-07-10T08:00:00.000Z',
    };
    saveState(state, storage);
    const loaded = loadState(storage);
    expect(loaded.charts[0].pillars[0].actions[0].updatedAt).toBe('2026-07-10T08:00:00.000Z');
  });

  it('preserves present v1.1 fields on load', () => {
    const state = sampleState();
    state.charts[0].pillars[0].actions[0] = {
      ...state.charts[0].pillars[0].actions[0],
      text: 'Squat',
      status: 'done',
      description: 'Back squat 5x5',
      reward: 'Protein shake',
      completedAt: '2024-03-01T12:00:00.000Z',
    };
    saveState(state, storage);
    const loaded = loadState(storage);
    const action = loaded.charts[0].pillars[0].actions[0];
    expect(action.description).toBe('Back squat 5x5');
    expect(action.reward).toBe('Protein shake');
    expect(action.completedAt).toBe('2024-03-01T12:00:00.000Z');
  });
});
