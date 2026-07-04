import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type { AppStateV1 } from "../types";
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyState,
  loadState,
  saveState,
} from "../lib/storage";

/**
 * The store's persisted slice is exactly AppStateV1. Actions are added on top
 * (below) but excluded from persistence via `partialize`.
 */
export type PersistedState = AppStateV1;

// Domain actions grow across milestones (M1: goals/habits, M2: daily loop).
export interface StoreActions {
  /** Replace the entire persisted state (used by import / clear-data later). */
  replaceAll: (next: AppStateV1) => void;
  /** Reset to a fresh empty state. */
  reset: () => void;
}

export type Store = PersistedState & StoreActions;

/**
 * Custom persistence adapter so the on-disk format is our versioned envelope
 * `{ schemaVersion, data }` under the single `vs_app_state` key — not Zustand's
 * default `{ state, version }` wrapper. All (de)serialization + migration is
 * delegated to the storage repository module.
 */
const envelopeStorage: PersistStorage<PersistedState> = {
  getItem: () => {
    const data = loadState();
    return { state: data, version: CURRENT_SCHEMA_VERSION };
  },
  setItem: (_name, value) => {
    saveState(value.state as AppStateV1);
  },
  removeItem: () => {
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — nothing to remove */
    }
  },
};

const PERSISTED_KEYS: (keyof PersistedState)[] = [
  "schemaVersion",
  "desiredRealities",
  "habits",
  "checkIns",
  "habitCompletions",
  "exerciseSessions",
  "mentalNudges",
  "evidenceEntries",
  "selfTrustLedger",
  "putOffItems",
  "profileStats",
  "settings",
];

function partialize(state: Store): PersistedState {
  const out = {} as PersistedState;
  for (const key of PERSISTED_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[key] = (state as any)[key];
  }
  return out;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...createEmptyState(),

      replaceAll: (next) => set(() => ({ ...next })),

      reset: () => set(() => ({ ...createEmptyState() })),
    }),
    {
      name: STORAGE_KEY,
      version: CURRENT_SCHEMA_VERSION,
      storage: envelopeStorage,
      partialize,
    }
  )
);
