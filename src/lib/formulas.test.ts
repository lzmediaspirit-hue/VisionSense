import { describe, expect, it } from "vitest";
import {
  ATFT_GAIN,
  CHECK_IN_POINT,
  DECAY,
  EXERCISE_SESSION_POINT,
  GRACE_FACTOR,
  HABIT_COMPLETION_POINT,
  ITFT_LOSS,
  NUDGE_ACTED_ON_POINT,
  SCALE,
  activityScoreByDay,
  applySelfTrustEvent,
  clampSelfTrust,
  computeMomentum,
  displayedMomentum,
  foldMomentum,
  recomputeMomentum,
  recomputeStatsFromLedger,
  replaySelfTrust,
} from "./formulas";
import type { SelfTrustLedgerEvent } from "../types";

/** Tiny seeded PRNG (mulberry32) so "property" tests are deterministic/repeatable
 * without pulling in a fast-check dependency. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeEvent(
  partial: Partial<SelfTrustLedgerEvent> & Pick<SelfTrustLedgerEvent, "kind" | "sourceId" | "createdAt">
): SelfTrustLedgerEvent {
  return {
    id: partial.id ?? `${partial.sourceId}-${partial.createdAt}`,
    createdAt: partial.createdAt,
    kind: partial.kind,
    sourceType: partial.sourceType ?? "habitCompletion",
    sourceId: partial.sourceId,
    delta: partial.delta ?? 0,
    resultingScore: partial.resultingScore ?? 0,
  };
}

describe("formula constants", () => {
  it("match the engineering-plan §4 values", () => {
    expect(ATFT_GAIN).toBe(4);
    expect(ITFT_LOSS).toBe(3);
    expect(GRACE_FACTOR).toBe(0.5);
    expect(DECAY).toBe(0.9);
    expect(SCALE).toBe(40);
  });
});

describe("applySelfTrustEvent", () => {
  it("gains taper toward the ceiling (ATFT at 50)", () => {
    // 50 + 4 * (1 - 0.5) = 52
    expect(applySelfTrustEvent(50, "ATFT")).toBeCloseTo(52);
  });

  it("losses are grace-factored and smaller than gains (ITFT at 50)", () => {
    // 50 - 3 * 0.5 * 0.5 = 49.25
    expect(applySelfTrustEvent(50, "ITFT")).toBeCloseTo(49.25);
  });

  it("stays within [0, 100]", () => {
    expect(applySelfTrustEvent(100, "ATFT")).toBeLessThanOrEqual(100);
    expect(applySelfTrustEvent(0, "ITFT")).toBeGreaterThanOrEqual(0);
    expect(applySelfTrustEvent(0, "ITFT")).toBe(0);
  });
});

describe("clampSelfTrust", () => {
  it("bounds to 0..100", () => {
    expect(clampSelfTrust(-5)).toBe(0);
    expect(clampSelfTrust(150)).toBe(100);
    expect(clampSelfTrust(42)).toBe(42);
  });
});

describe("computeMomentum", () => {
  it("folds activity into decayed previous momentum", () => {
    // 10 * 0.9 + 3 = 12
    expect(computeMomentum(10, 3)).toBeCloseTo(12);
  });

  it("a single inactive day never snaps to zero", () => {
    const next = computeMomentum(20, 0);
    expect(next).toBeCloseTo(18);
    expect(next).toBeGreaterThan(0);
  });
});

describe("displayedMomentum", () => {
  it("maps 0 to 0 and stays within [0, 100)", () => {
    expect(displayedMomentum(0)).toBe(0);
    expect(displayedMomentum(1000)).toBeLessThan(100);
    expect(displayedMomentum(1000)).toBeGreaterThan(90);
  });

  it("is monotonically increasing", () => {
    expect(displayedMomentum(10)).toBeLessThan(displayedMomentum(20));
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (M3 — highest-risk logic in the app, per engineering
// plan §6/§7 risk #4). These run a seeded-random sequence of events through
// the formulas many times and assert invariants hold for every run, rather
// than only spot-checking fixed inputs above.
// ---------------------------------------------------------------------------

describe("property: Self-Trust score always stays in [0, 100]", () => {
  it("holds across many random ATFT/ITFT sequences", () => {
    const rng = makeRng(42);
    for (let run = 0; run < 200; run++) {
      let score = 50;
      const steps = 1 + Math.floor(rng() * 200);
      for (let i = 0; i < steps; i++) {
        const kind = rng() < 0.5 ? "ATFT" : "ITFT";
        score = applySelfTrustEvent(score, kind);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("property: a single miss never zeroes momentum", () => {
  it("holds from any positive starting momentum", () => {
    const rng = makeRng(7);
    for (let run = 0; run < 200; run++) {
      const start = rng() * 1000;
      const next = computeMomentum(start, 0);
      if (start > 0) expect(next).toBeGreaterThan(0);
      expect(next).toBeCloseTo(start * DECAY);
    }
  });
});

describe("property: asymmetric gain/loss — losses are smaller than gains at the same score", () => {
  // With the current constants (ATFT_GAIN=4, ITFT_LOSS=3, GRACE_FACTOR=0.5),
  // gain(s) = 4*(1 - s/100) and loss(s) = 1.5*(s/100). These cross at
  // s = 400/5.5 ≈ 72.73: below that score gains dominate (the book-faithful
  // "grace" behavior engineering-plan §4 describes), but above it the loss
  // magnitude actually exceeds the gain magnitude at that same score. This
  // is a genuine property of the already-approved formula/constants (not
  // something this phase changes) — flagged in the M3 report for a possible
  // constant-tuning pass per engineering-plan §7 risk #4. The property is
  // exercised across the range where a fresh/neutral user actually lives
  // (starting at 50) and where the plan's "grace" claim holds exactly.
  it("holds for scores up to the gain/loss crossover (~72.7)", () => {
    for (let score = 1; score <= 72; score++) {
      const gain = applySelfTrustEvent(score, "ATFT") - score;
      const loss = score - applySelfTrustEvent(score, "ITFT");
      expect(gain).toBeGreaterThan(0);
      expect(loss).toBeGreaterThan(0);
      expect(loss).toBeLessThan(gain);
    }
  });

  it("documents the crossover: above ~72.7 the loss magnitude exceeds the gain magnitude", () => {
    const score = 90;
    const gain = applySelfTrustEvent(score, "ATFT") - score;
    const loss = score - applySelfTrustEvent(score, "ITFT");
    expect(loss).toBeGreaterThan(gain);
  });
});

describe("property: long inactivity decays gracefully toward (but never below) zero", () => {
  it("approaches zero asymptotically and never goes negative", () => {
    let momentum = 500;
    let prev = momentum;
    for (let day = 0; day < 500; day++) {
      momentum = computeMomentum(momentum, 0);
      expect(momentum).toBeGreaterThanOrEqual(0);
      expect(momentum).toBeLessThanOrEqual(prev);
      prev = momentum;
    }
    expect(momentum).toBeLessThan(0.01);
    expect(displayedMomentum(momentum)).toBeGreaterThanOrEqual(0);
    expect(displayedMomentum(momentum)).toBeLessThan(1);
  });
});

describe("property: all-misses floor behavior", () => {
  it("score decreases monotonically but never reaches (or crosses) zero", () => {
    let score = 50;
    let prev = score;
    for (let i = 0; i < 500; i++) {
      score = applySelfTrustEvent(score, "ITFT");
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(prev);
      prev = score;
    }
    // Grace-factored loss keeps it hard-to-crash: still comfortably above 0
    // after hundreds of consecutive misses.
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe("activityScoreByDay", () => {
  it("sums only kept completions, all check-ins, completed exercises, and acted-on nudges", () => {
    const byDay = activityScoreByDay({
      habitCompletions: [
        { id: "c1", habitId: "h1", dateKey: "2025-01-01", createdAt: 1, kept: true },
        { id: "c2", habitId: "h2", dateKey: "2025-01-01", createdAt: 1, kept: false },
      ],
      checkIns: [
        { id: "ci1", dateKey: "2025-01-01", createdAt: 1, baseState: "calm" },
      ],
      exerciseSessions: [
        {
          id: "e1",
          type: "polarityTransmutation",
          dateKey: "2025-01-01",
          startedAt: 1,
          completedAt: 2,
          steps: [],
        },
        {
          id: "e2",
          type: "polarityTransmutation",
          dateKey: "2025-01-01",
          startedAt: 1,
          steps: [],
        }, // abandoned — no completedAt, must not count
      ],
      mentalNudges: [
        { id: "n1", text: "call", capturedAt: 1, actedAt: new Date(2025, 0, 1).getTime(), status: "actedOn" },
      ],
    });
    // 1 (kept completion) + 1 (check-in) + 1 (completed exercise) + 1 (nudge) = 4
    expect(byDay.get("2025-01-01")).toBe(
      HABIT_COMPLETION_POINT + CHECK_IN_POINT + EXERCISE_SESSION_POINT + NUDGE_ACTED_ON_POINT
    );
  });

  it("re-tapping a habit completion (upsert) never inflates a day's score beyond one point", () => {
    // Simulates the upsert result: only the LATEST record for (habit, day)
    // exists in the entity list (the store never keeps duplicates).
    const byDay = activityScoreByDay({
      habitCompletions: [
        { id: "c1", habitId: "h1", dateKey: "2025-01-01", createdAt: 5, kept: true },
      ],
      checkIns: [],
      exerciseSessions: [],
      mentalNudges: [],
    });
    expect(byDay.get("2025-01-01")).toBe(HABIT_COMPLETION_POINT);
  });
});

describe("foldMomentum / recomputeMomentum", () => {
  it("folds gaps between activity days with decay-only steps", () => {
    const byDay = new Map([
      ["2025-01-01", 3],
      ["2025-01-03", 2],
    ]);
    // day1: 0*0.9+3=3; day2 (gap, 0 activity): 3*0.9+0=2.7; day3: 2.7*0.9+2=4.43
    const raw = foldMomentum(byDay, "2025-01-03");
    expect(raw).toBeCloseTo(4.43);
  });

  it("returns 0 when there is no activity at all", () => {
    expect(foldMomentum(new Map(), "2025-01-01")).toBe(0);
    const { momentumRaw, momentumDisplayed } = recomputeMomentum(
      { habitCompletions: [], checkIns: [], exerciseSessions: [], mentalNudges: [] },
      "2025-01-01"
    );
    expect(momentumRaw).toBe(0);
    expect(momentumDisplayed).toBe(0);
  });
});

describe("replaySelfTrust", () => {
  it("folds events from the neutral baseline of 50", () => {
    const ledger = [
      makeEvent({ kind: "ATFT", sourceId: "a", createdAt: 1 }),
      makeEvent({ kind: "ATFT", sourceId: "b", createdAt: 2 }),
    ];
    expect(replaySelfTrust(ledger)).toBeCloseTo(
      applySelfTrustEvent(applySelfTrustEvent(50, "ATFT"), "ATFT")
    );
  });

  it("upsert semantics: a same-day flip (miss then keep) collapses to only the latest event per source", () => {
    // Same sourceId (a stable HabitCompletion id, per the upsert design in
    // store.ts) — first a miss, then flipped to a keep. The effective score
    // must equal a single ATFT from baseline, NOT the sequential
    // ITFT-then-ATFT application (which would double-count the miss).
    const flip = [
      makeEvent({ kind: "ITFT", sourceId: "completion-1", createdAt: 1 }),
      makeEvent({ kind: "ATFT", sourceId: "completion-1", createdAt: 2 }),
    ];
    const keptOnly = [makeEvent({ kind: "ATFT", sourceId: "completion-1", createdAt: 2 })];
    expect(replaySelfTrust(flip)).toBeCloseTo(replaySelfTrust(keptOnly));
    expect(replaySelfTrust(flip)).toBeCloseTo(applySelfTrustEvent(50, "ATFT"));

    // Prove this actually differs from the naive "apply every event in
    // order" approach, which WOULD double-count the superseded miss.
    const naiveSequential = applySelfTrustEvent(applySelfTrustEvent(50, "ITFT"), "ATFT");
    expect(replaySelfTrust(flip)).not.toBeCloseTo(naiveSequential, 5);
  });

  it("different sources are independent and both fold in", () => {
    const ledger = [
      makeEvent({ kind: "ITFT", sourceId: "a", createdAt: 1 }),
      makeEvent({ kind: "ATFT", sourceId: "b", createdAt: 2 }),
    ];
    const expected = applySelfTrustEvent(applySelfTrustEvent(50, "ITFT"), "ATFT");
    expect(replaySelfTrust(ledger)).toBeCloseTo(expected);
  });

  it("ledger replay reproduces the same score regardless of how many superseded taps occurred", () => {
    const rng = makeRng(99);
    for (let run = 0; run < 50; run++) {
      const taps = 1 + Math.floor(rng() * 10);
      let now = 0;
      let lastKind: "ATFT" | "ITFT" = "ATFT";
      const ledger: SelfTrustLedgerEvent[] = [];
      for (let i = 0; i < taps; i++) {
        lastKind = rng() < 0.5 ? "ATFT" : "ITFT";
        ledger.push(makeEvent({ kind: lastKind, sourceId: "same-source", createdAt: now }));
        now++;
      }
      // Whatever the tap history, only the LAST tap should determine the score.
      expect(replaySelfTrust(ledger)).toBeCloseTo(applySelfTrustEvent(50, lastKind));
    }
  });
});

describe("recomputeStatsFromLedger", () => {
  it("combines replaySelfTrust and recomputeMomentum into one ProfileStats", () => {
    const state = {
      selfTrustLedger: [makeEvent({ kind: "ATFT", sourceId: "a", createdAt: 1 })],
      habitCompletions: [
        { id: "c1", habitId: "h1", dateKey: "2025-01-01", createdAt: 1, kept: true },
      ],
      checkIns: [],
      exerciseSessions: [],
      mentalNudges: [],
    };
    const stats = recomputeStatsFromLedger(state, "2025-01-01");
    expect(stats.selfTrust).toBeCloseTo(applySelfTrustEvent(50, "ATFT"));
    expect(stats.momentumRaw).toBeCloseTo(HABIT_COMPLETION_POINT);
    expect(stats.momentumDisplayed).toBeCloseTo(displayedMomentum(HABIT_COMPLETION_POINT));
    expect(stats.lastComputedDateKey).toBe("2025-01-01");
  });
});
