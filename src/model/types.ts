// Core data model for VisionSense (Mandala Chart / OW64).
// See docs/SPEC.md section 3. This layer is pure and unit-tested.

/** Theme ids. Phase 1 only defines 'minimal'; the rest are reserved for phase 2. */
export type ThemeId = 'minimal' | 'stadium' | 'marquee' | 'campus';

/**
 * 'empty' is DERIVED from `text === ''`. Only 'todo' | 'doing' | 'done' are ever
 * stored. An action with empty text is treated as empty regardless of its stored
 * status.
 */
export type ActionStatus = 'empty' | 'todo' | 'doing' | 'done';

/** The three statuses that are actually persisted for a filled action. */
export type StoredStatus = 'todo' | 'doing' | 'done';

export interface Action {
  id: string;
  text: string; // '' = unfilled cell
  status: StoredStatus;
  description: string; // '' = none; extended notes shown in the detail dialog (v1.1)
  reward: string; // '' = none; celebrated with a toast on completion (v1.1)
  completedAt: string | null; // ISO set when this entered 'done', cleared on leaving (v1.1)
  habit: boolean; // when true this is a daily behaviour, not a one-shot task (v1.2)
  established: boolean; // a graduated habit: counts as done, no more daily check-ins (v1.2)
  completions: string[]; // ISO timestamps of daily check-offs, at most one per local day (v1.2)
  cue: string; // '' = none; the "when & where" of an if-then plan (v1.4, SPEC 11.1)
}

export interface Pillar {
  id: string;
  name: string; // '' = unfilled
  color: string; // one of 8 theme slot colors, index-derived by default
  actions: Action[]; // ALWAYS length 8 — invariant, enforced by constructors
}

export interface Chart {
  id: string;
  goal: string; // the center cell
  themeId: ThemeId;
  templateId: string | null; // provenance only
  pillars: Pillar[]; // ALWAYS length 8 — invariant
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * A single day's plan (v1.4, SPEC 11.2). Keyed in AppState.days by the LOCAL
 * day (YYYY-MM-DD). `mits` are "most important tasks" — references to actions in
 * any chart, structurally capped at 3. MIT completion is always DERIVED from the
 * referenced action, never stored here.
 */
export interface DayPlan {
  mits: Array<{ chartId: string; actionId: string }>; // max 3
  note: string; // the evening reflection ("What did I learn today?")
  updatedAt: string; // ISO — used for per-key LWW sync merge
}

/**
 * A weekly review (v1.4, SPEC 11.3). Keyed in AppState.reviews by ISO week
 * (YYYY-Www). All prompts are optional short free-text.
 */
export interface Review {
  wins: string; // "What went well?"
  obstacle: string; // "What got in the way?"
  change: string; // "What will you do differently?"
  focus: string; // "#1 focus next week"
  updatedAt: string; // ISO — used for per-key LWW sync merge
}

export interface AppState {
  schemaVersion: 1;
  charts: Chart[];
  activeChartId: string | null;
  /** Per-day plans, keyed by local YYYY-MM-DD (v1.4). Defaulted to {} on load. */
  days: Record<string, DayPlan>;
  /** Weekly reviews, keyed by ISO week YYYY-Www (v1.4). Defaulted to {} on load. */
  reviews: Record<string, Review>;
}

/** The fixed number of pillars in a chart, and actions per pillar. */
export const RULE_OF_8 = 8 as const;

/** Total number of action cells across a chart (8 pillars x 8 actions). */
export const TOTAL_ACTIONS = RULE_OF_8 * RULE_OF_8; // 64
