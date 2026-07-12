import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChart } from '../model/factory';
import {
  clearSyncMeta,
  defaultSyncMeta,
  loadSyncMeta,
  parseDrivePayload,
  recordChartDeletion,
  saveSyncMeta,
  SYNC_META_KEY,
} from './metadata';

describe('sync metadata', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns defaults when nothing is stored', () => {
    expect(loadSyncMeta()).toEqual(defaultSyncMeta());
  });

  it('returns defaults for a corrupt blob (never throws)', () => {
    localStorage.setItem(SYNC_META_KEY, '{not json');
    expect(loadSyncMeta()).toEqual(defaultSyncMeta());
  });

  it('round-trips and sanitizes tombstones on load', () => {
    saveSyncMeta({
      enabled: true,
      email: 'me@example.com',
      fileId: 'file123',
      lastSyncAt: '2026-07-01T00:00:00.000Z',
      // one valid, one junk value that must be dropped on reload
      deletedChartIds: { a: '2026-07-01T00:00:00.000Z', b: 'not-a-date' },
    });
    const loaded = loadSyncMeta();
    expect(loaded.enabled).toBe(true);
    expect(loaded.email).toBe('me@example.com');
    expect(loaded.deletedChartIds).toEqual({ a: '2026-07-01T00:00:00.000Z' });
  });

  it('records a tombstone only when sync is enabled', () => {
    // No metadata at all => no-op.
    recordChartDeletion('x', '2026-07-01T00:00:00.000Z');
    expect(localStorage.getItem(SYNC_META_KEY)).toBeNull();

    // Disabled metadata => no-op.
    saveSyncMeta({ ...defaultSyncMeta(), enabled: false });
    recordChartDeletion('x', '2026-07-01T00:00:00.000Z');
    expect(loadSyncMeta().deletedChartIds).toEqual({});

    // Enabled => tombstone recorded.
    saveSyncMeta({ ...defaultSyncMeta(), enabled: true });
    recordChartDeletion('x', '2026-07-01T00:00:00.000Z');
    expect(loadSyncMeta().deletedChartIds).toEqual({ x: '2026-07-01T00:00:00.000Z' });
  });

  it('clearSyncMeta removes the blob', () => {
    saveSyncMeta({ ...defaultSyncMeta(), enabled: true });
    clearSyncMeta();
    expect(localStorage.getItem(SYNC_META_KEY)).toBeNull();
  });

  it('parseDrivePayload validates charts with defaults and drops junk ones', () => {
    const good = createChart({ goal: 'Ship', now: () => '2026-07-01T00:00:00.000Z' });
    const parsed = parseDrivePayload({
      schemaVersion: 1,
      charts: [good, { id: 'broken' }, 'nonsense'],
      deletedChartIds: { z: '2026-06-01T00:00:00.000Z', bad: 42 },
      savedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.charts.map((c) => c.id)).toEqual([good.id]);
    expect(parsed?.deletedChartIds).toEqual({ z: '2026-06-01T00:00:00.000Z' });
    expect(parsed?.savedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('parseDrivePayload rejects a non-object', () => {
    expect(parseDrivePayload('nope')).toBeNull();
    expect(parseDrivePayload(null)).toBeNull();
  });
});
