import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./store";
import { createEmptyState } from "../lib/storage";
import { habitsForReality } from "../lib/selectors";

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
