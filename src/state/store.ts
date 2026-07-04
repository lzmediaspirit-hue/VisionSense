import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type {
  AppStateV1,
  CheckIn,
  DesiredReality,
  EvidenceEntry,
  EvidenceSourceType,
  ExerciseSession,
  ExerciseStepEntry,
  ExerciseType,
  Habit,
  HabitCompletion,
  HabitSchedule,
  ID,
  MentalNudge,
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

  // --- Mental Nudges inbox (M4) ---
  /** Quick-capture a nudge (single text field, <5s flow). */
  addMentalNudge: (text: string) => MentalNudge;
  /**
   * Mark a nudge acted-on: timestamps `actedAt`, appends a fast-ATFT ledger
   * event, and derives an Evidence entry. No-ops (returns the nudge as-is) if
   * it isn't currently open, so a duplicate tap can't double-count.
   */
  markNudgeActedOn: (id: ID) => MentalNudge | undefined;
  /** Consciously let a nudge go — neutral, no ledger event, no evidence. */
  releaseNudge: (id: ID) => void;

  // --- Exercise runner (M4) ---
  /**
   * Start a guided exercise session (writes immediately, `completedAt`
   * unset). If the user abandons the flow, the session simply stays
   * incomplete — it is excluded from Momentum and never produces Evidence,
   * so it cannot corrupt any cached stat.
   */
  startExerciseSession: (input: {
    type: ExerciseType;
    desiredRealityId?: ID;
    habitId?: ID;
  }) => ExerciseSession;
  /**
   * Complete a previously-started session: records its steps, stamps
   * `completedAt`, creates one Evidence entry per supplied evidence text
   * (Polarity Transmutation's 1-3 logged pieces of evidence), and recomputes
   * Momentum (completed exercises count as a day's activity).
   */
  completeExerciseSession: (
    id: ID,
    steps: ExerciseStepEntry[],
    evidenceTexts?: string[]
  ) => ExerciseSession | undefined;

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

      addMentalNudge: (text: string): MentalNudge => {
        const nudge: MentalNudge = {
          id: newId(),
          text,
          capturedAt: Date.now(),
          status: "open",
        };
        set((s) => ({ mentalNudges: [...s.mentalNudges, nudge] }));
        return nudge;
      },

      markNudgeActedOn: (id: ID): MentalNudge | undefined => {
        const state = useStore.getState();
        const nudge = state.mentalNudges.find((n) => n.id === id);
        if (!nudge || nudge.status !== "open") return nudge;

        const now = Date.now();
        const updatedNudge: MentalNudge = { ...nudge, actedAt: now, status: "actedOn" };
        const mentalNudges = state.mentalNudges.map((n) => (n.id === id ? updatedNudge : n));

        const event = draftSelfTrustEvent("ATFT", "mentalNudgeActedOn", id, now);
        const selfTrustLedger = [...state.selfTrustLedger, event];
        const evidenceEntries = upsertEvidenceEntry(
          state.evidenceEntries,
          {
            sourceType: "mentalNudgeActedOn",
            sourceId: id,
            dateKey: toLocalDateKey(new Date(now)),
            text: `${strings.evidence.nudgeActedOnPrefix}${nudge.text}`,
          },
          now
        );

        const stats = recomputeStatsFromLedger(
          { ...state, mentalNudges, selfTrustLedger },
          todayKey()
        );
        event.resultingScore = stats.selfTrust;
        event.delta = stats.selfTrust - state.profileStats.selfTrust;

        set({ mentalNudges, selfTrustLedger, evidenceEntries, profileStats: stats });
        return updatedNudge;
      },

      releaseNudge: (id: ID): void => {
        // Consciously let go — neutral, no ledger event, no evidence entry.
        set((s) => ({
          mentalNudges: s.mentalNudges.map((n) =>
            n.id === id && n.status === "open" ? { ...n, status: "released" } : n
          ),
        }));
      },

      startExerciseSession: (input: {
        type: ExerciseType;
        desiredRealityId?: ID;
        habitId?: ID;
      }): ExerciseSession => {
        const now = Date.now();
        const session: ExerciseSession = {
          id: newId(),
          type: input.type,
          desiredRealityId: input.desiredRealityId,
          habitId: input.habitId,
          dateKey: toLocalDateKey(new Date(now)),
          startedAt: now,
          steps: [],
        };
        set((s) => ({ exerciseSessions: [...s.exerciseSessions, session] }));
        return session;
      },

      completeExerciseSession: (
        id: ID,
        steps: ExerciseStepEntry[],
        evidenceTexts: string[] = []
      ): ExerciseSession | undefined => {
        const state = useStore.getState();
        const session = state.exerciseSessions.find((s) => s.id === id);
        if (!session) return undefined;

        const now = Date.now();
        const updated: ExerciseSession = { ...session, steps, completedAt: now };
        const exerciseSessions = state.exerciseSessions.map((s) => (s.id === id ? updated : s));

        const newEvidence: EvidenceEntry[] = evidenceTexts
          .map((text) => text.trim())
          .filter((text) => text.length > 0)
          .map((text) => ({
            id: newId(),
            createdAt: now,
            dateKey: updated.dateKey,
            text,
            sourceType: "exerciseSession" as const,
            sourceId: id,
            desiredRealityId: session.desiredRealityId,
          }));
        const evidenceEntries = [...state.evidenceEntries, ...newEvidence];

        // Exercises don't touch the Self-Trust ledger (only Momentum), so
        // just recompute — the ledger side of recomputeStatsFromLedger is a
        // no-op here since selfTrustLedger is unchanged.
        const stats = recomputeStatsFromLedger(
          { ...state, exerciseSessions },
          todayKey()
        );

        set({ exerciseSessions, evidenceEntries, profileStats: stats });
        return updated;
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
