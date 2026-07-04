import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type {
  AppStateV1,
  DesiredReality,
  Habit,
  HabitSchedule,
  ID,
  SevenKeysCategory,
} from "../types";
import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyState,
  loadState,
  saveState,
} from "../lib/storage";
import { newId } from "../lib/id";

/**
 * The store's persisted slice is exactly AppStateV1. Actions are added on top
 * (below) but excluded from persistence via `partialize`.
 */
export type PersistedState = AppStateV1;

/** Fields the user supplies when creating a Desired Reality. */
export type NewDesiredReality = Pick<
  DesiredReality,
  "title" | "targetFeeling" | "normalizeIt"
> &
  Partial<Pick<DesiredReality, "sourceActionNote" | "collectiveBeliefToRelease">>;

/** Editable fields of a Desired Reality. */
export type DesiredRealityPatch = Partial<
  Pick<
    DesiredReality,
    | "title"
    | "targetFeeling"
    | "normalizeIt"
    | "sourceActionNote"
    | "collectiveBeliefToRelease"
  >
>;

/** Fields the user supplies when creating a Habit. */
export type NewHabit = Pick<
  Habit,
  "desiredRealityId" | "name" | "tier" | "actionType" | "isKeystone" | "schedule"
> &
  Partial<Pick<Habit, "exchangingFor" | "sevenKeysCategory">>;

/** Editable fields of a Habit. */
export type HabitPatch = Partial<
  Pick<
    Habit,
    | "name"
    | "tier"
    | "actionType"
    | "exchangingFor"
    | "sevenKeysCategory"
    | "isKeystone"
    | "schedule"
    | "active"
  >
>;

// Domain actions grow across milestones (M1: goals/habits, M2: daily loop).
export interface StoreActions {
  // --- Desired Realities (M1) ---
  addDesiredReality: (input: NewDesiredReality) => DesiredReality;
  updateDesiredReality: (id: ID, patch: DesiredRealityPatch) => void;
  archiveDesiredReality: (id: ID) => void;

  // --- Habits (M1) ---
  addHabit: (input: NewHabit) => Habit;
  updateHabit: (id: ID, patch: HabitPatch) => void;
  archiveHabit: (id: ID) => void;

  /** Replace the entire persisted state (used by import / clear-data later). */
  replaceAll: (next: AppStateV1) => void;
  /** Reset to a fresh empty state. */
  reset: () => void;
}

// Re-export the schedule/category types used by forms for convenience.
export type { HabitSchedule, SevenKeysCategory };

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

      addDesiredReality: (input) => {
        const dr: DesiredReality = {
          id: newId(),
          title: input.title,
          targetFeeling: input.targetFeeling,
          normalizeIt: input.normalizeIt,
          sourceActionNote: input.sourceActionNote,
          collectiveBeliefToRelease: input.collectiveBeliefToRelease,
          createdAt: Date.now(),
        };
        set((s) => ({ desiredRealities: [...s.desiredRealities, dr] }));
        return dr;
      },

      updateDesiredReality: (id, patch) =>
        set((s) => ({
          desiredRealities: s.desiredRealities.map((dr) =>
            dr.id === id ? { ...dr, ...patch } : dr
          ),
        })),

      archiveDesiredReality: (id) =>
        set((s) => ({
          desiredRealities: s.desiredRealities.map((dr) =>
            dr.id === id && dr.archivedAt == null
              ? { ...dr, archivedAt: Date.now() }
              : dr
          ),
        })),

      addHabit: (input) => {
        const habit: Habit = {
          id: newId(),
          desiredRealityId: input.desiredRealityId,
          name: input.name,
          tier: input.tier,
          actionType: input.actionType,
          exchangingFor: input.exchangingFor,
          sevenKeysCategory: input.sevenKeysCategory,
          isKeystone: input.isKeystone,
          schedule: input.schedule,
          active: true,
          createdAt: Date.now(),
        };
        set((s) => ({ habits: [...s.habits, habit] }));
        return habit;
      },

      updateHabit: (id, patch) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),

      archiveHabit: (id) =>
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id && h.archivedAt == null
              ? { ...h, archivedAt: Date.now(), active: false }
              : h
          ),
        })),

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
