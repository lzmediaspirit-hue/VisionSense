// Sync metadata persisted in localStorage under `visionsense.sync.v1` (SPEC 10.3),
// plus validation of the remote Drive payload. The chart data itself never lives
// here — only the small bookkeeping the sync controller needs, and the deletion
// tombstones.

import { isObject, validateChart } from '../model/storage';
import type { Chart } from '../model/types';
import type { DrivePayload } from './drive';
import type { Tombstones } from './merge';

export const SYNC_META_KEY = 'visionsense.sync.v1';

export interface SyncMeta {
  enabled: boolean;
  email: string;
  fileId: string | null;
  lastSyncAt: string | null;
  /** chartId -> ISO timestamp of deletion. */
  deletedChartIds: Tombstones;
}

export function defaultSyncMeta(): SyncMeta {
  return { enabled: false, email: '', fileId: null, lastSyncAt: null, deletedChartIds: {} };
}

/** Keep only string->string entries whose value parses as a date. */
function sanitizeTombstones(v: unknown): Tombstones {
  if (!isObject(v)) return {};
  const out: Tombstones = {};
  for (const [id, iso] of Object.entries(v)) {
    if (typeof iso === 'string' && !Number.isNaN(Date.parse(iso))) out[id] = iso;
  }
  return out;
}

/** Load sync metadata, defaulting every field so a corrupt blob never crashes. */
export function loadSyncMeta(): SyncMeta {
  try {
    if (typeof localStorage === 'undefined') return defaultSyncMeta();
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (raw === null) return defaultSyncMeta();
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return defaultSyncMeta();
    return {
      enabled: parsed.enabled === true,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      fileId: typeof parsed.fileId === 'string' ? parsed.fileId : null,
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      deletedChartIds: sanitizeTombstones(parsed.deletedChartIds),
    };
  } catch {
    return defaultSyncMeta();
  }
}

/** Persist sync metadata. Best effort — a write failure never crashes. */
export function saveSyncMeta(meta: SyncMeta): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore (quota / disabled storage)
  }
}

/** Remove the metadata blob entirely (used on disconnect). */
export function clearSyncMeta(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SYNC_META_KEY);
  } catch {
    // ignore
  }
}

/** True when a sync metadata blob exists and sync is enabled. */
export function isSyncEnabled(): boolean {
  return loadSyncMeta().enabled;
}

/**
 * Record a deletion tombstone for a chart, but only when sync metadata exists and
 * sync is enabled (SPEC 10.4). Called from the store's delete path so deletions
 * propagate to other devices instead of being resurrected by a stale remote copy.
 */
export function recordChartDeletion(chartId: string, now: string = new Date().toISOString()): void {
  const meta = loadSyncMeta();
  if (!meta.enabled) return;
  meta.deletedChartIds = { ...meta.deletedChartIds, [chartId]: now };
  saveSyncMeta(meta);
}

/**
 * Validate a value downloaded from Drive into a well-formed payload, defaulting
 * everything (same strictness/defaults as localStorage load). Returns null when
 * the blob cannot be trusted at all.
 */
export function parseDrivePayload(v: unknown): DrivePayload | null {
  if (!isObject(v)) return null;
  const charts: Chart[] = [];
  if (Array.isArray(v.charts)) {
    for (const c of v.charts) {
      const chart = validateChart(c);
      if (chart) charts.push(chart); // skip individual bad charts rather than reject all
    }
  }
  return {
    schemaVersion: 1,
    charts,
    deletedChartIds: sanitizeTombstones(v.deletedChartIds),
    savedAt: typeof v.savedAt === 'string' ? v.savedAt : new Date(0).toISOString(),
  };
}
