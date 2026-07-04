import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type {
  AppStateV1,
  CheckIn,
  DesiredReality,
  Habit,
  HabitCompletion,
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
import { toLocalDateKey } from "../lib/dates";

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

  // --- Daily loop (M2) ---
  /** Record today's base-state check-in. */
  addCheckIn: (input: NewCheckIn) => CheckIn;
  /**
   * Record (or update) a habit's completion for a given local day. Upserts on
   * (habitId, dateKey) so re-tapping updates rather than duplicating. Writes
   * only the HabitCompletion record — the Self-Trust/Momentum ledger is wired
   * in Phase 2 (M3).
   */
  recordHabitCompletion: (input: NewHabitCompletion) => HabitCompletion;

  /** Replace the entire persisted state (used by import / clear-data later). */
  replaceAll: (next: AppStateV1) => void;
  /** Reset to a fresh empty state. */
  reset: () => void;
}

/** Fields the user supplies for a base-state check-in. */
export type NewCheckIn = Pick<CheckIn, "baseState"> &
  Partial<Pick<CheckIn, "note" | "desiredRealityId">>;

/** Fields the user supplies when recording a habit completion. */
export type NewHabitCompletion = Pick<HabitCompletion, "habitId" | "kept"> &
  Partial<Pick<HabitCompletion, "reflectionPromptUsed">>;

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

      addCheckIn: (input) => {
        const now = Date.now();
        const checkIn: CheckIn = {
          id: newId(),
          dateKey: toLocalDateKey(new Date(now)),
          createdAt: now,
          baseState: input.baseState,
          note: input.note,
          desiredRealityId: input.desiredRealityId,
        };
        set((s) => ({ checkIns: [...s.checkIns, checkIn] }));
        return checkIn;
      },

      recordHabitCompletion: (input) => {
        const now = Date.now();
        const dateKey = toLocalDateKey(new Date(now));
        const state = useStore.getState();
        const existing = state.habitCompletions.find(
          (c) => c.habitId === input.habitId && c.dateKey === dateKey
        );
        if (existing) {
          const updated: HabitCompletion = {
            ...existing,
            kept: input.kept,
            createdAt: now,
            reflectionPromptUsed:
              input.reflectionPromptUsed ?? existing.reflectionPromptUsed,
          };
          set((s) => ({
            habitCompletions: s.habitCompletions.map((c) =>
              c.id === existing.id ? updated : c
            ),
          }));
          return updated;
        }
        const completion: HabitCompletion = {
          id: newId(),
          habitId: input.habitId,
          dateKey,
          createdAt: now,
          kept: input.kept,
          reflectionPromptUsed: input.reflectionPromptUsed,
        };
        set((s) => ({
          habitCompletions: [...s.habitCompletions, completion],
        }));
        return completion;
      },

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
