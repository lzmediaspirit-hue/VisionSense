// Self-Trust and Momentum scoring math.
//
// The tunable constants live here (and ONLY here) so they can be adjusted after
// dogfooding without touching logic — see engineering-plan §4 and risk #4.
//
// Phase 2 owns the property-based tests and any richer wiring (per-day activity
// aggregation, ledger replay). The implementations below are the minimal,
// correct per-§4 formulas; they are intentionally trivial and pure.

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
