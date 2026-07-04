import { describe, expect, it } from "vitest";
import {
  cachedStats,
  habitsDueToday,
  isHabitDueOn,
} from "./selectors";
import { createEmptyState } from "./storage";
import type { AppStateV1, Habit } from "../types";

function makeHabit(partial: Partial<Habit>): Habit {
  return {
    id: partial.id ?? "h",
    desiredRealityId: partial.desiredRealityId ?? "dr",
    name: partial.name ?? "Habit",
    tier: partial.tier ?? "inner",
    actionType: partial.actionType ?? "start",
    isKeystone: partial.isKeystone ?? false,
    schedule: partial.schedule ?? { kind: "daily" },
    active: partial.active ?? true,
    createdAt: partial.createdAt ?? 1,
    archivedAt: partial.archivedAt,
  };
}

describe("isHabitDueOn", () => {
  it("daily habits are due every day", () => {
    const h = makeHabit({ schedule: { kind: "daily" } });
    expect(isHabitDueOn(h, new Date(2025, 0, 1))).toBe(true);
  });

  it("weekly habits are due only on listed days of week", () => {
    // 2025-01-01 is a Wednesday (getDay() === 3).
    const wed = new Date(2025, 0, 1);
    expect(isHabitDueOn(makeHabit({ schedule: { kind: "weekly", daysOfWeek: [3] } }), wed)).toBe(true);
    expect(isHabitDueOn(makeHabit({ schedule: { kind: "weekly", daysOfWeek: [1] } }), wed)).toBe(false);
  });

  it("oneOff habits are due on their target date (or when undated)", () => {
    const day = new Date(2025, 0, 1);
    expect(
      isHabitDueOn(
        makeHabit({ schedule: { kind: "oneOff", targetDate: "2025-01-01" } }),
        day
      )
    ).toBe(true);
    expect(
      isHabitDueOn(
        makeHabit({ schedule: { kind: "oneOff", targetDate: "2025-02-01" } }),
        day
      )
    ).toBe(false);
    expect(
      isHabitDueOn(makeHabit({ schedule: { kind: "oneOff" } }), day)
    ).toBe(true);
  });
});

describe("habitsDueToday", () => {
  function stateWith(habits: Habit[]): AppStateV1 {
    const s = createEmptyState();
    s.desiredRealities.push({
      id: "dr",
      title: "Goal",
      targetFeeling: "calm",
      normalizeIt: false,
      createdAt: 1,
    });
    s.habits.push(...habits);
    return s;
  }

  it("orders inner habits above outer habits", () => {
    const s = stateWith([
      makeHabit({ id: "o", tier: "outer" }),
      makeHabit({ id: "i", tier: "inner" }),
    ]);
    expect(habitsDueToday(s).map((h) => h.id)).toEqual(["i", "o"]);
  });

  it("excludes archived habits and habits under archived goals", () => {
    const s = stateWith([
      makeHabit({ id: "a", archivedAt: 5 }),
      makeHabit({ id: "b" }),
    ]);
    s.desiredRealities[0].archivedAt = 9; // archive the goal
    expect(habitsDueToday(s)).toHaveLength(0);
  });
});

describe("cachedStats", () => {
  it("defaults to selfTrust 50 and momentum 0 for a fresh state", () => {
    expect(cachedStats(createEmptyState())).toEqual({
      selfTrust: 50,
      momentum: 0,
    });
  });
});
