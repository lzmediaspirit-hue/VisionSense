// All entity interfaces for VisionSense, copied faithfully from the
// engineering plan §4. This module is the single source of truth for the
// shape of persisted data. Later phases build directly on these names/paths.

// ---- Shared primitives ----
export type ID = string; // crypto.randomUUID()
export type LocalDateKey = string; // "YYYY-MM-DD", derived via toLocalDateKey()
export type EpochMs = number;

export type SevenKeysCategory =
  | "beliefs"
  | "conviction"
  | "perception"
  | "emotionallyChargedThoughts"
  | "focus"
  | "reactions"
  | "expectations";

// ---- C12: goal-as-feeling ----
export interface DesiredReality {
  id: ID;
  title: string; // e.g. "New job in design"
  targetFeeling: string; // e.g. "secure", "seen" (C12)
  normalizeIt: boolean; // "already normal/mine" framing toggle (C8)
  sourceActionNote?: string; // paired "be a source" practice (C8)
  collectiveBeliefToRelease?: string; // supporting concept
  createdAt: EpochMs;
  archivedAt?: EpochMs; // soft-delete; never hard-delete user data implicitly
}

// ---- C10 tier, C6 start/stop, C11 seven keys ----
export interface Habit {
  id: ID;
  desiredRealityId: ID;
  name: string;
  tier: "inner" | "outer"; // C10: inner rendered above outer
  actionType: "start" | "stop"; // C6
  exchangingFor?: string; // "stop" habits: what desired state this trades for (C6)
  sevenKeysCategory?: SevenKeysCategory; // C11, optional, mainly for inner habits
  isKeystone: boolean; // e.g. relaxation habit gating exercises (C9)
  schedule: HabitSchedule;
  active: boolean;
  createdAt: EpochMs;
  archivedAt?: EpochMs;
}

export interface HabitSchedule {
  kind: "daily" | "weekly" | "oneOff";
  daysOfWeek?: number[]; // 0-6, only for "weekly"
  targetDate?: LocalDateKey; // only for "oneOff" (put-off list items etc.)
}

// ---- Daily state check-in, C7 ----
export interface CheckIn {
  id: ID;
  dateKey: LocalDateKey;
  createdAt: EpochMs;
  baseState: string; // free-text or short tag, e.g. "anxious", "at ease"
  note?: string;
  desiredRealityId?: ID; // optional link if the check-in was goal-specific
}

// ---- Habit completion event (separate from CheckIn) ----
export interface HabitCompletion {
  id: ID;
  habitId: ID;
  dateKey: LocalDateKey;
  createdAt: EpochMs;
  kept: boolean; // true = ATFT event, false = ITFT event
  reflectionPromptUsed?: boolean; // true if the C2 reframe screen was shown/used
}

// ---- Guided exercises: Polarity Transmutation (MVP), Technique / Emotional Alchemy (post-MVP) ----
export type ExerciseType =
  | "polarityTransmutation" // C7, technique #7 — MVP
  | "technique" // technique #8 — post-MVP
  | "emotionalAlchemy" // C14, technique #16 — post-MVP
  | "frequencyAudit" // C11 — post-MVP
  | "beliefAdoption" // technique #13 — post-MVP
  | "internalValidation"; // Energetic Ceiling — post-MVP

export interface ExerciseSession {
  id: ID;
  type: ExerciseType;
  desiredRealityId?: ID;
  habitId?: ID; // if this session counts as completing a linked habit
  dateKey: LocalDateKey;
  startedAt: EpochMs;
  completedAt?: EpochMs; // undefined = abandoned mid-flow
  relaxGateCompletedAt?: EpochMs; // C9 gate timestamp, if applicable
  steps: ExerciseStepEntry[];
}

export interface ExerciseStepEntry {
  stepKey: string; // e.g. "nameFeeling", "nameOppositePolarity", "logEvidence"
  value: string; // user's free-text input for that step
}

// ---- C10: mental nudges inbox ----
export interface MentalNudge {
  id: ID;
  text: string;
  capturedAt: EpochMs;
  actedAt?: EpochMs; // presence = acted-on; feeds a fast-ATFT ledger event
  status: "open" | "actedOn" | "released"; // "released" = consciously let go, not "failed"
}

// ---- C13: wins/evidence log ----
export type EvidenceSourceType =
  | "habitCompletion"
  | "exerciseSession"
  | "mentalNudgeActedOn"
  | "putOffItemCleared"
  | "manualEntry";

export interface EvidenceEntry {
  id: ID;
  dateKey: LocalDateKey;
  createdAt: EpochMs;
  text: string;
  sourceType: EvidenceSourceType;
  sourceId?: ID; // id of the HabitCompletion/ExerciseSession/etc. that generated it
  desiredRealityId?: ID;
}

// ---- C4: Self-Trust ledger (append-only, source of truth for the score) ----
export interface SelfTrustLedgerEvent {
  id: ID;
  createdAt: EpochMs;
  kind: "ATFT" | "ITFT";
  sourceType: "habitCompletion" | "mentalNudgeActedOn" | "putOffItemCleared";
  sourceId: ID;
  delta: number; // signed change actually applied, for audit/debug
  resultingScore: number; // snapshot of selfTrust after this event
}

// ---- Put-off list, technique #5 ----
export interface PutOffItem {
  id: ID;
  text: string;
  createdAt: EpochMs;
  clearedAt?: EpochMs; // presence = cleared; feeds an ATFT ledger event
  releasedAt?: EpochMs; // presence = consciously let go; no ledger event, no penalty
}

// ---- Derived/cached profile stats (recomputable from the ledger; not itself authoritative) ----
export interface ProfileStats {
  selfTrust: number; // 0-100, cached derived value
  momentumRaw: number; // unbounded internal accumulator
  momentumDisplayed: number; // 0-100 via soft-cap curve, see formula above
  lastComputedDateKey: LocalDateKey;
}

// ---- Settings & schema envelope ----
export interface Settings {
  languageMode: "bookVocabulary" | "secular"; // Q1, secular is post-MVP but field exists early
  relaxGateEnabled: boolean; // C9
  remindersEnabled: boolean; // post-MVP, opt-in only
}

export interface AppStateV1 {
  schemaVersion: 1;
  desiredRealities: DesiredReality[];
  habits: Habit[];
  checkIns: CheckIn[];
  habitCompletions: HabitCompletion[];
  exerciseSessions: ExerciseSession[];
  mentalNudges: MentalNudge[];
  evidenceEntries: EvidenceEntry[];
  selfTrustLedger: SelfTrustLedgerEvent[];
  putOffItems: PutOffItem[];
  profileStats: ProfileStats;
  settings: Settings;
}

// Top-level localStorage envelope, versioned for migration.
export interface StorageEnvelope {
  schemaVersion: number;
  data: AppStateV1; // swap type per version; migrations transform old -> new
}
