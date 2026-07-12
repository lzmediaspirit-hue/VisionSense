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
  return { schemaVersion: 1, charts: [chart], activeChartId: chart.id };
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
});
