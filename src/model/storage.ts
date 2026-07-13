// localStorage persistence, versioned under `visionsense.v1`.
//
// Robustness contract (SPEC 3 + 5): unknown/corrupt data NEVER crashes the app.
// On a parse or shape failure we preserve the offending blob under
// `visionsense.v1.backup` and fall back to a fresh empty state.

import { createInitialState } from './factory';
import { pruneDays, validateDays, validateReviews } from './journal';
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

/** Exported for reuse by exportImport.ts (JSON import needs the same strictness). */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const THEME_IDS: ReadonlySet<string> = new Set(['minimal', 'stadium', 'marquee', 'campus']);
const STORED_STATUSES: ReadonlySet<string> = new Set(['todo', 'doing', 'done']);

function validateAction(v: unknown): Action | null {
  if (!isObject(v)) return null;
  const { id, text, status } = v;
  if (typeof id !== 'string' || typeof text !== 'string') return null;
  if (typeof status !== 'string' || !STORED_STATUSES.has(status)) return null;
  // v1.1 fields are additive + optional: DEFAULT them when absent (or the wrong
  // type) rather than rejecting, so pre-v1.1 localStorage blobs and previously
  // exported JSON files (which lack these keys) still load/import cleanly.
  const description = typeof v.description === 'string' ? v.description : '';
  const reward = typeof v.reward === 'string' ? v.reward : '';
  const completedAt = typeof v.completedAt === 'string' ? v.completedAt : null;
  // v1.2 habit fields — same additive rule (SPEC 8.5). `completions` is
  // sanitized: only string entries that parse as a valid date are kept, so a
  // junk/hand-edited array never poisons the graphs or calendar.
  const habit = typeof v.habit === 'boolean' ? v.habit : false;
  const established = typeof v.established === 'boolean' ? v.established : false;
  const completions = Array.isArray(v.completions)
    ? v.completions.filter(
        (c): c is string => typeof c === 'string' && !Number.isNaN(new Date(c).getTime()),
      )
    : [];
  // v1.4 if-then cue — same additive rule (SPEC 11.1): default when absent.
  const cue = typeof v.cue === 'string' ? v.cue : '';
  return {
    id,
    text,
    status: status as StoredStatus,
    description,
    reward,
    completedAt,
    habit,
    established,
    completions,
    cue,
  };
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

/** Exported for reuse by exportImport.ts (a single imported chart gets the same
 * strict structural validation as a chart loaded from localStorage). */
export function validateChart(v: unknown): Chart | null {
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

  // v1.4 journal (days/reviews) is additive + optional: default absent/wrong
  // values to {} so pre-v1.4 blobs and old exports load unchanged (SPEC 11.5).
  const days = validateDays(parsed.days);
  const reviews = validateReviews(parsed.reviews);

  return { schemaVersion: 1, charts, activeChartId, days, reviews };
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
    // Prune stale day plans on write (SPEC 11.2). Only rebuild state when
    // pruning actually removed something (pruneDays returns the same ref if not).
    const prunedDays = pruneDays(state.days);
    const toSave = prunedDays === state.days ? state : { ...state, days: prunedDays };
    storage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Best effort (e.g. QuotaExceeded). Persistence is not load-bearing for UX.
  }
}
