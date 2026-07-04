import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyState } from "../lib/storage";
import { habitsForReality } from "../lib/selectors";
import { applySelfTrustEvent, recomputeStatsFromLedger } from "../lib/formulas";
import { todayKey } from "../lib/dates";

function reset() {
  useStore.setState(createEmptyState());
}

beforeEach(() => {
  localStorage.clear();
  reset();
});

describe("Desired Reality CRUD", () => {
  it("adds a desired reality with an id and createdAt", () => {
    const dr = useStore.getState().addDesiredReality({
      title: "New role",
      targetFeeling: "secure",
      normalizeIt: true,
    });
    expect(dr.id).toBeTruthy();
    expect(dr.createdAt).toBeGreaterThan(0);
    expect(useStore.getState().desiredRealities).toHaveLength(1);
  });

  it("updates editable fields", () => {
    const dr = useStore.getState().addDesiredReality({
      title: "New role",
      targetFeeling: "secure",
      normalizeIt: false,
    });
    useStore.getState().updateDesiredReality(dr.id, { targetFeeling: "seen" });
    expect(useStore.getState().desiredRealities[0].targetFeeling).toBe("seen");
  });

  it("archives via soft-delete (archivedAt set, record retained)", () => {
    const dr = useStore.getState().addDesiredReality({
      title: "New role",
      targetFeeling: "secure",
      normalizeIt: false,
    });
    useStore.getState().archiveDesiredReality(dr.id);
    const stored = useStore.getState().desiredRealities[0];
    expect(stored.archivedAt).toBeGreaterThan(0);
    // record is not hard-deleted
    expect(useStore.getState().desiredRealities).toHaveLength(1);
  });
});

describe("Habit CRUD", () => {
  function seedGoal() {
    return useStore.getState().addDesiredReality({
      title: "New role",
      targetFeeling: "secure",
      normalizeIt: false,
    });
  }

  it("adds a habit scoped to a desired reality, active by default", () => {
    const dr = seedGoal();
    const habit = useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "20 minutes of stillness",
      tier: "inner",
      actionType: "start",
      isKeystone: true,
      schedule: { kind: "daily" },
    });
    expect(habit.active).toBe(true);
    expect(habit.desiredRealityId).toBe(dr.id);
  });

  it("orders inner habits above outer habits", () => {
    const dr = seedGoal();
    useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "Walk",
      tier: "outer",
      actionType: "start",
      isKeystone: false,
      schedule: { kind: "daily" },
    });
    useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "Stillness",
      tier: "inner",
      actionType: "start",
      isKeystone: false,
      schedule: { kind: "daily" },
    });
    const ordered = habitsForReality(useStore.getState(), dr.id);
    expect(ordered.map((h) => h.tier)).toEqual(["inner", "outer"]);
  });

  it("keeps exchangingFor for stop-habits", () => {
    const dr = seedGoal();
    const habit = useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "Late nights",
      tier: "outer",
      actionType: "stop",
      exchangingFor: "steady mornings",
      isKeystone: false,
      schedule: { kind: "daily" },
    });
    expect(habit.actionType).toBe("stop");
    expect(habit.exchangingFor).toBe("steady mornings");
  });

  it("archived habits drop out of the active list", () => {
    const dr = seedGoal();
    const habit = useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "Stillness",
      tier: "inner",
      actionType: "start",
      isKeystone: false,
      schedule: { kind: "daily" },
    });
    useStore.getState().archiveHabit(habit.id);
    expect(habitsForReality(useStore.getState(), dr.id)).toHaveLength(0);
    expect(useStore.getState().habits[0].active).toBe(false);
  });
});

describe("persistence via the store", () => {
  it("writes the versioned envelope to localStorage on mutation", () => {
    useStore.getState().addDesiredReality({
      title: "New role",
      targetFeeling: "secure",
      normalizeIt: false,
    });
    const raw = localStorage.getItem("vs_app_state");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.data.desiredRealities).toHaveLength(1);
  });
});

// --- M3: Self-Trust ledger + Momentum wiring ---

function seedHabit() {
  const dr = useStore.getState().addDesiredReality({
    title: "Steady work",
    targetFeeling: "secure",
    normalizeIt: false,
  });
  return useStore.getState().addHabit({
    desiredRealityId: dr.id,
    name: "Stillness",
    tier: "inner",
    actionType: "start",
    isKeystone: false,
    schedule: { kind: "daily" },
  });
}

describe("recordHabitCompletion: Self-Trust ledger + Evidence wiring", () => {
  it("a kept completion appends an ATFT event and raises cached Self-Trust", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });

    const state = useStore.getState();
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.selfTrustLedger[0].kind).toBe("ATFT");
    expect(state.selfTrustLedger[0].sourceType).toBe("habitCompletion");
    expect(state.profileStats.selfTrust).toBeCloseTo(applySelfTrustEvent(50, "ATFT"));
    expect(state.selfTrustLedger[0].resultingScore).toBeCloseTo(state.profileStats.selfTrust);
  });

  it("a miss appends an ITFT event and lowers cached Self-Trust", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: false });

    const state = useStore.getState();
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.selfTrustLedger[0].kind).toBe("ITFT");
    expect(state.profileStats.selfTrust).toBeCloseTo(applySelfTrustEvent(50, "ITFT"));
  });

  it("re-tapping the SAME value again is a no-op on the ledger (no double count)", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });

    const state = useStore.getState();
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.profileStats.selfTrust).toBeCloseTo(applySelfTrustEvent(50, "ATFT"));
  });

  it("a same-day flip (miss then keep) lands at the same score as keeping it outright — no double count", () => {
    const habitA = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habitA.id, kept: false });
    useStore.getState().recordHabitCompletion({ habitId: habitA.id, kept: true });
    const flippedScore = useStore.getState().profileStats.selfTrust;

    // Reset and compare against tapping "keep" directly, with no miss first.
    useStore.setState(createEmptyState());
    const habitB = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habitB.id, kept: true });
    const keptOnlyScore = useStore.getState().profileStats.selfTrust;

    expect(flippedScore).toBeCloseTo(keptOnlyScore);
    // The ledger keeps BOTH raw taps (immutable audit trail)...
    useStore.setState(createEmptyState());
    const habitC = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habitC.id, kept: false });
    useStore.getState().recordHabitCompletion({ habitId: habitC.id, kept: true });
    expect(useStore.getState().selfTrustLedger).toHaveLength(2);
    // ...but only the latest tap's Evidence entry survives (no un-kept "win").
    expect(useStore.getState().evidenceEntries).toHaveLength(1);
  });

  it("kept completions create an Evidence entry; un-keeping removes it", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    expect(useStore.getState().evidenceEntries).toHaveLength(1);
    expect(useStore.getState().evidenceEntries[0].sourceType).toBe("habitCompletion");

    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: false });
    expect(useStore.getState().evidenceEntries).toHaveLength(0);
  });

  it("ledger replay reproduces the cached Self-Trust score exactly", () => {
    const habitA = seedHabit();
    const habitB = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habitA.id, kept: true });
    useStore.getState().recordHabitCompletion({ habitId: habitB.id, kept: false });
    useStore.getState().recordHabitCompletion({ habitId: habitA.id, kept: false });

    const state = useStore.getState();
    const replayed = recomputeStatsFromLedger(state, todayKey());
    expect(replayed.selfTrust).toBeCloseTo(state.profileStats.selfTrust);
  });

  it("kept completions register as Momentum activity for today", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    expect(useStore.getState().profileStats.momentumRaw).toBeGreaterThan(0);
  });
});

describe("Mental Nudges: quick-add / acted-on / release", () => {
  it("adds a nudge as open", () => {
    const nudge = useStore.getState().addMentalNudge("message Sam");
    expect(nudge.status).toBe("open");
    expect(useStore.getState().mentalNudges).toHaveLength(1);
  });

  it("marking acted-on stamps actedAt, appends a fast-ATFT event, and creates Evidence", () => {
    const nudge = useStore.getState().addMentalNudge("message Sam");
    useStore.getState().markNudgeActedOn(nudge.id);

    const state = useStore.getState();
    const updated = state.mentalNudges.find((n) => n.id === nudge.id);
    expect(updated?.status).toBe("actedOn");
    expect(updated?.actedAt).toBeGreaterThan(0);
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.selfTrustLedger[0].kind).toBe("ATFT");
    expect(state.selfTrustLedger[0].sourceType).toBe("mentalNudgeActedOn");
    expect(state.evidenceEntries).toHaveLength(1);
    expect(state.evidenceEntries[0].sourceType).toBe("mentalNudgeActedOn");
    expect(state.profileStats.selfTrust).toBeCloseTo(applySelfTrustEvent(50, "ATFT"));
  });

  it("marking acted-on twice does not double-count (no-op guard)", () => {
    const nudge = useStore.getState().addMentalNudge("message Sam");
    useStore.getState().markNudgeActedOn(nudge.id);
    useStore.getState().markNudgeActedOn(nudge.id);
    expect(useStore.getState().selfTrustLedger).toHaveLength(1);
  });

  it("releasing a nudge is neutral: no ledger event, no evidence, no penalty", () => {
    const nudge = useStore.getState().addMentalNudge("message Sam");
    useStore.getState().releaseNudge(nudge.id);

    const state = useStore.getState();
    expect(state.mentalNudges.find((n) => n.id === nudge.id)?.status).toBe("released");
    expect(state.selfTrustLedger).toHaveLength(0);
    expect(state.evidenceEntries).toHaveLength(0);
    expect(state.profileStats.selfTrust).toBe(50);
  });
});

describe("Exercise runner sessions", () => {
  it("starting a session writes it immediately without completedAt", () => {
    const session = useStore.getState().startExerciseSession({ type: "polarityTransmutation" });
    expect(session.completedAt).toBeUndefined();
    expect(useStore.getState().exerciseSessions).toHaveLength(1);
  });

  it("an abandoned session (never completed) does not affect Momentum or Evidence", () => {
    useStore.getState().startExerciseSession({ type: "polarityTransmutation" });
    const state = useStore.getState();
    expect(state.profileStats.momentumRaw).toBe(0);
    expect(state.evidenceEntries).toHaveLength(0);
  });

  it("completing a session stamps completedAt, logs Evidence per text, and counts toward Momentum", () => {
    const session = useStore.getState().startExerciseSession({ type: "polarityTransmutation" });
    useStore.getState().completeExerciseSession(
      session.id,
      [
        { stepKey: "nameFeeling", value: "unseen" },
        { stepKey: "nameOppositePolarity", value: "seen" },
      ],
      ["A friend thanked me publicly", "I got positive feedback at work"]
    );

    const state = useStore.getState();
    const updated = state.exerciseSessions.find((s) => s.id === session.id);
    expect(updated?.completedAt).toBeGreaterThan(0);
    expect(state.evidenceEntries).toHaveLength(2);
    expect(state.evidenceEntries.every((e) => e.sourceType === "exerciseSession")).toBe(true);
    expect(state.profileStats.momentumRaw).toBeGreaterThan(0);
    // Exercises never touch the Self-Trust ledger.
    expect(state.selfTrustLedger).toHaveLength(0);
  });

  it("completing an unknown session id is a safe no-op", () => {
    const result = useStore.getState().completeExerciseSession("nonexistent", [], []);
    expect(result).toBeUndefined();
    expect(useStore.getState().evidenceEntries).toHaveLength(0);
  });
});

describe("ensureStatsFresh", () => {
  it("recomputes when lastComputedDateKey is stale", () => {
    useStore.setState({
      profileStats: { selfTrust: 50, momentumRaw: 0, momentumDisplayed: 0, lastComputedDateKey: "2000-01-01" },
    });
    useStore.getState().ensureStatsFresh();
    expect(useStore.getState().profileStats.lastComputedDateKey).toBe(todayKey());
  });

  it("recomputes when the cached score looks corrupt (drifted from the ledger)", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    const correct = useStore.getState().profileStats.selfTrust;

    // Simulate drift/corruption.
    useStore.setState((s) => ({ profileStats: { ...s.profileStats, selfTrust: 12.3456 } }));
    useStore.getState().ensureStatsFresh();
    expect(useStore.getState().profileStats.selfTrust).toBeCloseTo(correct);
  });

  it("is a no-op when the cache is already fresh and correct", () => {
    const habit = seedHabit();
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    const before = useStore.getState().profileStats;
    useStore.getState().ensureStatsFresh();
    expect(useStore.getState().profileStats).toEqual(before);
  });
});

// --- M5: Put-off list ---

describe("Put-off list: add / clear / release", () => {
  it("adds an item with no clearedAt/releasedAt", () => {
    const item = useStore.getState().addPutOffItem("that phone call");
    expect(item.clearedAt).toBeUndefined();
    expect(item.releasedAt).toBeUndefined();
    expect(useStore.getState().putOffItems).toHaveLength(1);
  });

  it("clearing stamps clearedAt, appends a fast-ATFT event, and creates Evidence", () => {
    const item = useStore.getState().addPutOffItem("that phone call");
    useStore.getState().clearPutOffItem(item.id);

    const state = useStore.getState();
    const updated = state.putOffItems.find((p) => p.id === item.id);
    expect(updated?.clearedAt).toBeGreaterThan(0);
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.selfTrustLedger[0].kind).toBe("ATFT");
    expect(state.selfTrustLedger[0].sourceType).toBe("putOffItemCleared");
    expect(state.evidenceEntries).toHaveLength(1);
    expect(state.evidenceEntries[0].sourceType).toBe("putOffItemCleared");
    expect(state.profileStats.selfTrust).toBeCloseTo(applySelfTrustEvent(50, "ATFT"));
  });

  it("clearing twice does not double-count (no-op guard)", () => {
    const item = useStore.getState().addPutOffItem("that phone call");
    useStore.getState().clearPutOffItem(item.id);
    useStore.getState().clearPutOffItem(item.id);
    expect(useStore.getState().selfTrustLedger).toHaveLength(1);
  });

  it("releasing is neutral: no ledger event, no Evidence, no penalty — never an ITFT", () => {
    const item = useStore.getState().addPutOffItem("that phone call");
    useStore.getState().releasePutOffItem(item.id);

    const state = useStore.getState();
    expect(state.putOffItems.find((p) => p.id === item.id)?.releasedAt).toBeGreaterThan(0);
    expect(state.selfTrustLedger).toHaveLength(0);
    expect(state.evidenceEntries).toHaveLength(0);
    expect(state.profileStats.selfTrust).toBe(50);
  });

  it("releasing an already-cleared item is a no-op", () => {
    const item = useStore.getState().addPutOffItem("that phone call");
    useStore.getState().clearPutOffItem(item.id);
    useStore.getState().releasePutOffItem(item.id);
    expect(useStore.getState().putOffItems[0].releasedAt).toBeUndefined();
  });
});

// --- M5: Relax-first gate + Settings ---

describe("Relax-first gate + Settings", () => {
  it("completeRelaxGate stamps relaxGateCompletedAt on the matching session", () => {
    const session = useStore.getState().startExerciseSession({ type: "polarityTransmutation" });
    useStore.getState().completeRelaxGate(session.id);
    const updated = useStore
      .getState()
      .exerciseSessions.find((s) => s.id === session.id);
    expect(updated?.relaxGateCompletedAt).toBeGreaterThan(0);
  });

  it("updateSettings patches settings without touching other fields", () => {
    useStore.getState().updateSettings({ relaxGateEnabled: false });
    expect(useStore.getState().settings.relaxGateEnabled).toBe(false);
    expect(useStore.getState().settings.languageMode).toBe("bookVocabulary");
  });
});

// --- M5: Export / import round trip (CRITICAL, engineering-plan M5 QA line) ---

describe("Export -> clear -> import round trip", () => {
  it("reproduces the exact original state after export, clear, and import", () => {
    // Build up a varied, non-trivial state across every entity type.
    const dr = useStore.getState().addDesiredReality({
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: true,
    });
    const habit = useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "Stillness",
      tier: "inner",
      actionType: "start",
      isKeystone: true,
      schedule: { kind: "daily" },
    });
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    useStore.getState().addCheckIn({ baseState: "at ease" });
    const nudge = useStore.getState().addMentalNudge("message Sam");
    useStore.getState().markNudgeActedOn(nudge.id);
    const putOff = useStore.getState().addPutOffItem("that phone call");
    useStore.getState().clearPutOffItem(putOff.id);
    const session = useStore.getState().startExerciseSession({ type: "polarityTransmutation" });
    useStore.getState().completeRelaxGate(session.id);
    useStore.getState().completeExerciseSession(
      session.id,
      [{ stepKey: "nameFeeling", value: "unseen" }],
      ["A friend thanked me publicly"]
    );
    useStore.getState().updateSettings({ relaxGateEnabled: false });

    const original = useStore.getState().exportStateJSON();
    const originalParsed = JSON.parse(original);

    useStore.getState().reset();
    expect(useStore.getState().desiredRealities).toHaveLength(0);

    useStore.getState().importState(original);
    const restored = useStore.getState().exportStateJSON();
    const restoredParsed = JSON.parse(restored);

    expect(restoredParsed).toEqual(originalParsed);
  });

  it("importState throws on unrecognizable JSON and leaves current state untouched", () => {
    useStore.getState().addDesiredReality({
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: false,
    });
    const before = useStore.getState().desiredRealities;

    expect(() => useStore.getState().importState("{\"not\":\"an envelope\"}")).toThrow();
    expect(useStore.getState().desiredRealities).toBe(before);
  });

  it("importState recomputes stats from the ledger as an integrity check", () => {
    const dr = useStore.getState().addDesiredReality({
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: false,
    });
    const habit = useStore.getState().addHabit({
      desiredRealityId: dr.id,
      name: "Stillness",
      tier: "inner",
      actionType: "start",
      isKeystone: false,
      schedule: { kind: "daily" },
    });
    useStore.getState().recordHabitCompletion({ habitId: habit.id, kept: true });
    const json = useStore.getState().exportStateJSON();

    // Corrupt the exported cache to prove import recomputes rather than trusts it blindly.
    const corrupted = JSON.parse(json);
    corrupted.data.profileStats.selfTrust = 1;
    corrupted.data.profileStats.momentumRaw = 999;

    useStore.getState().importState(JSON.stringify(corrupted));
    expect(useStore.getState().profileStats.selfTrust).toBeCloseTo(
      applySelfTrustEvent(50, "ATFT")
    );
  });
});
