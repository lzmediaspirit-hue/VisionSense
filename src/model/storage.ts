// localStorage persistence, versioned under `visionsense.v1`.
//
// Robustness contract (SPEC 3 + 5): unknown/corrupt data NEVER crashes the app.
// On a parse or shape failure we preserve the offending blob under
// `visionsense.v1.backup` and fall back to a fresh empty state.

import { createInitialState } from './factory';
import {
  RULE_OF_8,
  type Action,
  type AppState,
  type Chart,
  type Pillar,
  type StoredStatus,
  type ThemeId,
} from './types';

export const STORAGE_KEY = 'visionsense.v1';
export const BACKUP_KEY = 'visionsense.v1.backup';

/** Minimal Storage surface we depend on (matches the DOM Storage interface). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Access to localStorage can throw (e.g. disabled cookies). Treat as absent.
  }
  return null;
}

// --- Validation ---------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const THEME_IDS: ReadonlySet<string> = new Set(['minimal', 'stadium', 'marquee', 'campus']);
const STORED_STATUSES: ReadonlySet<string> = new Set(['todo', 'doing', 'done']);

function validateAction(v: unknown): Action | null {
  if (!isObject(v)) return null;
  const { id, text, status } = v;
  if (typeof id !== 'string' || typeof text !== 'string') return null;
  if (typeof status !== 'string' || !STORED_STATUSES.has(status)) return null;
  return { id, text, status: status as StoredStatus };
}

function validatePillar(v: unknown): Pillar | null {
  if (!isObject(v)) return null;
  const { id, name, color, actions } = v;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof color !== 'string') {
    return null;
  }
  if (!Array.isArray(actions) || actions.length !== RULE_OF_8) return null;
  const validated: Action[] = [];
  for (const a of actions) {
    const action = validateAction(a);
    if (!action) return null;
    validated.push(action);
  }
  return { id, name, color, actions: validated };
}

function validateChart(v: unknown): Chart | null {
  if (!isObject(v)) return null;
  const { id, goal, themeId, templateId, pillars, createdAt, updatedAt } = v;
  if (typeof id !== 'string' || typeof goal !== 'string') return null;
  if (typeof themeId !== 'string' || !THEME_IDS.has(themeId)) return null;
  if (templateId !== null && typeof templateId !== 'string') return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  if (!Array.isArray(pillars) || pillars.length !== RULE_OF_8) return null;
  const validated: Pillar[] = [];
  for (const p of pillars) {
    const pillar = validatePillar(p);
    if (!pillar) return null;
    validated.push(pillar);
  }
  return {
    id,
    goal,
    themeId: themeId as ThemeId,
    templateId: (templateId as string | null) ?? null,
    pillars: validated,
    createdAt,
    updatedAt,
  };
}

/**
 * Validate + migrate a parsed value into a well-formed AppState, or return null
 * if it cannot be trusted. schemaVersion is currently always 1; this is where
 * future version upgrades will be routed.
 */
export function migrate(parsed: unknown): AppState | null {
  if (!isObject(parsed)) return null;
  if (parsed.schemaVersion !== 1) return null;
  if (!Array.isArray(parsed.charts)) return null;

  const charts: Chart[] = [];
  for (const c of parsed.charts) {
    const chart = validateChart(c);
    if (!chart) return null;
    charts.push(chart);
  }

  const rawActive = parsed.activeChartId;
  let activeChartId: string | null = null;
  if (typeof rawActive === 'string' && charts.some((c) => c.id === rawActive)) {
    activeChartId = rawActive;
  } else if (rawActive !== null && rawActive !== undefined && typeof rawActive !== 'string') {
    // Wrong type for a present field => distrust the whole blob.
    return null;
  }

  return { schemaVersion: 1, charts, activeChartId };
}

// --- Load / Save --------------------------------------------------------------

/**
 * Load persisted state. Returns a fresh empty state when storage is absent,
 * empty, or corrupt. A corrupt blob is preserved under BACKUP_KEY.
 */
export function loadState(storage: StorageLike | null = defaultStorage()): AppState {
  if (!storage) return createInitialState();

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return createInitialState();
  }
  if (raw === null) return createInitialState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(storage, raw);
    return createInitialState();
  }

  const state = migrate(parsed);
  if (!state) {
    backupCorrupt(storage, raw);
    return createInitialState();
  }
  return state;
}

function backupCorrupt(storage: StorageLike, raw: string): void {
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // Best effort — never let backup failure crash load.
  }
}

/** Persist state. Swallows quota/serialization errors so a write never crashes. */
export function saveState(
  state: AppState,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best effort (e.g. QuotaExceeded). Persistence is not load-bearing for UX.
  }
}
