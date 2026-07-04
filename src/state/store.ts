import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type {
  AppStateV1,
  CheckIn,
  DesiredReality,
  EvidenceEntry,
  EvidenceSourceType,
  Habit,
  HabitCompletion,
  HabitSchedule,
  ID,
  SelfTrustLedgerEvent,
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
import { toLocalDateKey, todayKey } from "../lib/dates";
import {
  recomputeStatsFromLedger,
  replaySelfTrust,
  type SelfTrustEventKind,
} from "../lib/formulas";
import { strings } from "../copy/strings";

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
   * (habitId, dateKey) so re-tapping updates rather than duplicating. On a
   * genuine transition (new completion, or `kept` flips), appends an
   * immutable Self-Trust ledger event keyed by the completion's stable id
   * (see formulas.ts's same-day flip comment), upserts/removes the derived
   * Evidence entry, and recomputes the cached ProfileStats.
   */
  recordHabitCompletion: (input: NewHabitCompletion) => HabitCompletion;

  /**
   * Validate the cached ProfileStats against the ledger/entity lists and
   * recompute if the day has rolled over or the cache looks corrupt. Call on
   * app start.
   */
  ensureStatsFresh: () => void;

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

// --- Ledger/Evidence write helpers (pure; operate on arrays, not the store) ---

/** Build a not-yet-finalized ledger event; `delta`/`resultingScore` are filled
 * in by the caller once the post-write recompute is known. */
function draftSelfTrustEvent(
  kind: SelfTrustEventKind,
  sourceType: SelfTrustLedgerEvent["sourceType"],
  sourceId: ID,
  now: number
): SelfTrustLedgerEvent {
  return { id: newId(), createdAt: now, kind, sourceType, sourceId, delta: 0, resultingScore: 0 };
}

/** Insert or update the single Evidence entry derived from a given source. */
function upsertEvidenceEntry(
  entries: EvidenceEntry[],
  entry: {
    sourceType: EvidenceSourceType;
    sourceId: ID;
    dateKey: string;
    text: string;
    desiredRealityId?: ID;
  },
  now: number
): EvidenceEntry[] {
  const idx = entries.findIndex(
    (e) => e.sourceType === entry.sourceType && e.sourceId === entry.sourceId
  );
  if (idx >= 0) {
    const updated: EvidenceEntry = {
      ...entries[idx],
      text: entry.text,
      dateKey: entry.dateKey,
      desiredRealityId: entry.desiredRealityId,
    };
    const copy = [...entries];
    copy[idx] = updated;
    return copy;
  }
  const created: EvidenceEntry = {
    id: newId(),
    createdAt: now,
    dateKey: entry.dateKey,
    text: entry.text,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    desiredRealityId: entry.desiredRealityId,
  };
  return [...entries, created];
}

/** Drop any Evidence entries derived from a given source (e.g. an un-kept habit). */
function removeEvidenceEntriesForSource(
  entries: EvidenceEntry[],
  sourceType: EvidenceSourceType,
  sourceId: ID
): EvidenceEntry[] {
  return entries.filter((e) => !(e.sourceType === sourceType && e.sourceId === sourceId));
}

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

        let completion: HabitCompletion;
        let habitCompletions: HabitCompletion[];
        let previousKept: boolean | null;
        if (existing) {
          previousKept = existing.kept;
          completion = {
            ...existing,
            kept: input.kept,
            createdAt: now,
            reflectionPromptUsed:
              input.reflectionPromptUsed ?? existing.reflectionPromptUsed,
          };
          habitCompletions = state.habitCompletions.map((c) =>
            c.id === existing.id ? completion : c
          );
        } else {
          previousKept = null;
          completion = {
            id: newId(),
            habitId: input.habitId,
            dateKey,
            createdAt: now,
            kept: input.kept,
            reflectionPromptUsed: input.reflectionPromptUsed,
          };
          habitCompletions = [...state.habitCompletions, completion];
        }

        // Only a genuine transition (new record, or `kept` flipped) touches
        // the ledger/evidence — re-tapping the same value is a no-op so it
        // never inflates the ledger or double-counts (see formulas.ts).
        if (previousKept === completion.kept) {
          set({ habitCompletions });
          return completion;
        }

        const habit = state.habits.find((h) => h.id === completion.habitId);
        const kind: SelfTrustEventKind = completion.kept ? "ATFT" : "ITFT";
        const event = draftSelfTrustEvent(kind, "habitCompletion", completion.id, now);
        const selfTrustLedger = [...state.selfTrustLedger, event];
        const evidenceEntries = completion.kept
          ? upsertEvidenceEntry(
              state.evidenceEntries,
              {
                sourceType: "habitCompletion",
                sourceId: completion.id,
                dateKey: completion.dateKey,
                text: `${strings.evidence.habitKeptPrefix}${habit?.name ?? ""}`.trim(),
                desiredRealityId: habit?.desiredRealityId,
              },
              now
            )
          : removeEvidenceEntriesForSource(state.evidenceEntries, "habitCompletion", completion.id);

        const stats = recomputeStatsFromLedger(
          { ...state, habitCompletions, selfTrustLedger },
          todayKey()
        );
        event.resultingScore = stats.selfTrust;
        event.delta = stats.selfTrust - state.profileStats.selfTrust;

        set({ habitCompletions, selfTrustLedger, evidenceEntries, profileStats: stats });
        return completion;
      },

      ensureStatsFresh: (): void => {
        const state = useStore.getState();
        const today = todayKey();
        const expectedSelfTrust = replaySelfTrust(state.selfTrustLedger);
        const isStale = state.profileStats.lastComputedDateKey !== today;
        const looksCorrupt = Math.abs(expectedSelfTrust - state.profileStats.selfTrust) > 1e-6;
        if (!isStale && !looksCorrupt) return;
        set({ profileStats: recomputeStatsFromLedger(state, today) });
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
