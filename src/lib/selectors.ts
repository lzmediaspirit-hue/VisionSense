import type { AppStateV1, DesiredReality, Habit, ID } from "../types";

/** Non-archived desired realities, newest first. */
export function activeDesiredRealities(state: AppStateV1): DesiredReality[] {
  return state.desiredRealities
    .filter((dr) => dr.archivedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function desiredRealityById(
  state: AppStateV1,
  id: ID | undefined
): DesiredReality | undefined {
  if (!id) return undefined;
  return state.desiredRealities.find((dr) => dr.id === id);
}

/** Inner habits sort above outer habits everywhere (C10). Stable within a tier. */
export function sortInnerFirst(habits: Habit[]): Habit[] {
  const rank = (h: Habit) => (h.tier === "inner" ? 0 : 1);
  return [...habits].sort((a, b) => {
    const t = rank(a) - rank(b);
    return t !== 0 ? t : a.createdAt - b.createdAt;
  });
}

/** Active (non-archived) habits scoped to a desired reality, inner-first. */
export function habitsForReality(state: AppStateV1, drId: ID): Habit[] {
  return sortInnerFirst(
    state.habits.filter((h) => h.desiredRealityId === drId && h.archivedAt == null)
  );
}
