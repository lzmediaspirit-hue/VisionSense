import type {
  CheckIn,
  ExerciseSession,
  HabitCompletion,
  ID,
  LocalDateKey,
  MentalNudge,
  ProfileStats,
  SelfTrustLedgerEvent,
} from "../types";
import { enumerateDateKeys, toLocalDateKey } from "./dates";

// Self-Trust and Momentum scoring math.
//
// The tunable constants live here (and ONLY here) so they can be adjusted after
// dogfooding without touching logic — see engineering-plan §4 and risk #4.
//
// Phase 2 (M3) owns the property-based tests and the richer wiring below:
// per-day activity aggregation and ledger replay. Everything in this module
// is pure — no store/localStorage access — so it can be property-tested in
// isolation from the UI and from Zustand.
//
// --- Same-day re-tap / flip design (read this before touching the ledger) ---
// A habit's HabitCompletion record is upserted per (habitId, dateKey) — see
// store.ts — so a single stable `completion.id` persists across a same-day
// flip (kept -> not-kept -> kept, etc). Every write that changes a
// completion's `kept` value appends a NEW, immutable SelfTrustLedgerEvent
// with `sourceId = completion.id`; nothing is ever mutated or deleted from
// the ledger, so the raw tap history stays fully auditable.
//
// To avoid double-counting a flip (e.g. a miss followed by a same-day keep
// should land at the same score as if the user had only tapped "keep"),
// replay does NOT fold every event in the ledger forward. Instead
// `replaySelfTrust` collapses the ledger to the LATEST event per sourceId
// (latest by createdAt) before folding — so a superseded tap contributes
// nothing to the score, while still being visible in the raw ledger for
// audit/debug. `recomputeStatsFromLedger` is the single invariant checker:
// the cached ProfileStats is always exactly its output, so "ledger replay
// reproduces the cached score" holds by construction rather than by
// incremental bookkeeping.

/** ATFT (kept commitment) gain magnitude at score 0. */
export const ATFT_GAIN = 4;
/** ITFT (missed commitment) base loss magnitude. */
export const ITFT_LOSS = 3;
/** Grace factor: losses are roughly half the magnitude of gains. */
export const GRACE_FACTOR = 0.5;
/** Momentum decay per fully-inactive day (10% gentle decay, never a reset). */
export const DECAY = 0.9;
/** Soft-cap scale for the displayed 0-100 momentum curve. */
export const SCALE = 40;

/** Clamp a Self-Trust score to its bounded 0-100 range. */
export function clampSelfTrust(score: number): number {
  return Math.min(100, Math.max(0, score));
}

export type SelfTrustEventKind = "ATFT" | "ITFT";

/**
 * Apply a single Self-Trust event to the current score and return the new
 * score. Asymmetric, diminishing-returns math (§4):
 *
 *   ATFT: selfTrust + ATFT_GAIN * (1 - selfTrust / 100)   // gains taper near 100
 *   ITFT: selfTrust - ITFT_LOSS * (selfTrust / 100) * GRACE_FACTOR  // losses taper near 0
 *
 * The result is clamped to [0, 100].
 */
export function applySelfTrustEvent(
  currentScore: number,
  kind: SelfTrustEventKind
): number {
  let next: number;
  if (kind === "ATFT") {
    next = currentScore + ATFT_GAIN * (1 - currentScore / 100);
  } else {
    next = currentScore - ITFT_LOSS * (currentScore / 100) * GRACE_FACTOR;
  }
  return clampSelfTrust(next);
}

/**
 * Fold one day's activity score into the previous day's momentum:
 *
 *   momentum(d) = momentum(d-1) * DECAY + activityScore(d)
 *
 * A single inactive day costs only ~10% of accumulated momentum — never a
 * snap-to-zero. Raw momentum can grow unbounded internally.
 */
export function computeMomentum(
  previousMomentum: number,
  activityScore: number
): number {
  return previousMomentum * DECAY + Math.max(0, activityScore);
}

/**
 * Map raw (unbounded) momentum to a displayed 0-100 value through a soft-cap
 * curve, so the UI number never "caps out" abruptly:
 *
 *   displayed = 100 * (1 - e^(-momentum / SCALE))
 */
export function displayedMomentum(momentumRaw: number): number {
  const safe = Math.max(0, momentumRaw);
  return 100 * (1 - Math.exp(-safe / SCALE));
}

// --- Per-day activity aggregation (Momentum inputs) ---

/** Point value contributed by each kind of logged activity on a given day. */
export const HABIT_COMPLETION_POINT = 1;
export const CHECK_IN_POINT = 1;
export const EXERCISE_SESSION_POINT = 1;
export const NUDGE_ACTED_ON_POINT = 1;

/** The slices of AppStateV1 that feed the daily activity score. */
export interface ActivityLog {
  habitCompletions: HabitCompletion[];
  checkIns: CheckIn[];
  exerciseSessions: ExerciseSession[];
  mentalNudges: MentalNudge[];
}

/**
 * Sum the day's activity score for everything logged/completed on that local
 * day: kept habit completions, check-ins, completed (non-abandoned) exercise
 * sessions, and nudges acted on. Each is worth a small fixed point value
 * (named constants above). Sourced directly from the current entity lists
 * (not raw taps), so re-tapping/upserting a habit completion never inflates a
 * day's score beyond one point per distinct habit.
 */
export function activityScoreByDay(log: ActivityLog): Map<LocalDateKey, number> {
  const scores = new Map<LocalDateKey, number>();
  const add = (key: LocalDateKey, points: number) =>
    scores.set(key, (scores.get(key) ?? 0) + points);

  for (const c of log.habitCompletions) {
    if (c.kept) add(c.dateKey, HABIT_COMPLETION_POINT);
  }
  for (const c of log.checkIns) {
    add(c.dateKey, CHECK_IN_POINT);
  }
  for (const e of log.exerciseSessions) {
    if (e.completedAt != null) add(e.dateKey, EXERCISE_SESSION_POINT);
  }
  for (const n of log.mentalNudges) {
    if (n.actedAt != null) add(toLocalDateKey(new Date(n.actedAt)), NUDGE_ACTED_ON_POINT);
  }
  return scores;
}

/**
 * Fold a day-by-day activity map into a single raw momentum value by
 * replaying every calendar day from the earliest activity day through
 * `todayDateKey` (inclusive), applying the decay to inactive days along the
 * way. Pure — the caller supplies "today" so this is fully deterministic and
 * testable.
 */
export function foldMomentum(
  activityByDay: Map<LocalDateKey, number>,
  todayDateKey: LocalDateKey
): number {
  if (activityByDay.size === 0) return 0;
  let earliest = todayDateKey;
  for (const key of activityByDay.keys()) {
    if (key < earliest) earliest = key;
  }
  const days = enumerateDateKeys(earliest, todayDateKey);
  let momentum = 0;
  for (const key of days) {
    momentum = computeMomentum(momentum, activityByDay.get(key) ?? 0);
  }
  return momentum;
}

/** Recompute both the raw and displayed Momentum from the current activity log. */
export function recomputeMomentum(
  log: ActivityLog,
  todayDateKey: LocalDateKey
): { momentumRaw: number; momentumDisplayed: number } {
  const momentumRaw = foldMomentum(activityScoreByDay(log), todayDateKey);
  return { momentumRaw, momentumDisplayed: displayedMomentum(momentumRaw) };
}

// --- Self-Trust ledger replay ---

/**
 * Replay the Self-Trust ledger into a single 0-100 score. Collapses to the
 * latest event per `sourceId` first (see the module-level comment on
 * same-day flips), then folds the survivors in chronological order through
 * `applySelfTrustEvent`, starting from the neutral baseline of 50.
 */
export function replaySelfTrust(ledger: SelfTrustLedgerEvent[]): number {
  const latestBySource = new Map<ID, SelfTrustLedgerEvent>();
  for (const event of ledger) {
    const prev = latestBySource.get(event.sourceId);
    if (!prev || event.createdAt >= prev.createdAt) {
      latestBySource.set(event.sourceId, event);
    }
  }
  const effective = [...latestBySource.values()].sort(
    (a, b) => a.createdAt - b.createdAt
  );
  let score = 50;
  for (const event of effective) {
    score = applySelfTrustEvent(score, event.kind);
  }
  return score;
}

/**
 * The single invariant checker: rebuild the whole cached ProfileStats from
 * the ledger (Self-Trust) and the current entity lists (Momentum). Used both
 * after every ledger-affecting write and on load, to self-heal a stale/
 * corrupt cache (e.g. the app was closed for days, or the cache and ledger
 * ever drifted apart).
 */
export function recomputeStatsFromLedger(
  state: {
    selfTrustLedger: SelfTrustLedgerEvent[];
  } & ActivityLog,
  todayDateKey: LocalDateKey
): ProfileStats {
  const selfTrust = replaySelfTrust(state.selfTrustLedger);
  const { momentumRaw, momentumDisplayed } = recomputeMomentum(state, todayDateKey);
  return { selfTrust, momentumRaw, momentumDisplayed, lastComputedDateKey: todayDateKey };
}
