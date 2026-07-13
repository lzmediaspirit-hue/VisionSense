// The ONLY allowed mutations on a chart. Every function is pure: it returns a new
// Chart (or the same reference when nothing changed) and never mutates its input.
// There is deliberately no addPillar/addAction/removePillar/removeAction — the
// Rule of 8 is structural (see factory.ts).

import { localDayKey } from './completions';
import {
  RULE_OF_8,
  type Action,
  type Chart,
  type Pillar,
  type StoredStatus,
  type ThemeId,
} from './types';

type Clock = () => string;

function touch(chart: Chart, now: Clock): Chart {
  return { ...chart, updatedAt: now() };
}

const defaultNow: Clock = () => new Date().toISOString();

function inRange(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < RULE_OF_8;
}

/** Set the center goal. */
export function setGoal(chart: Chart, goal: string, now: Clock = defaultNow): Chart {
  if (chart.goal === goal) return chart;
  return touch({ ...chart, goal }, now);
}

/** Switch a chart's theme ("costume"). Pure CSS — no effect on stored data. */
export function setTheme(chart: Chart, themeId: ThemeId, now: Clock = defaultNow): Chart {
  if (chart.themeId === themeId) return chart;
  return touch({ ...chart, themeId }, now);
}

/** Rename a pillar (single source of truth for hub + outer-block center). */
export function renamePillar(
  chart: Chart,
  pillarIndex: number,
  name: string,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex)) return chart;
  const pillar = chart.pillars[pillarIndex];
  if (pillar.name === name) return chart;
  const pillars = chart.pillars.slice();
  pillars[pillarIndex] = { ...pillar, name };
  return touch({ ...chart, pillars }, now);
}

function replaceAction(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  next: Action,
  now: Clock,
): Chart {
  const pillar = chart.pillars[pillarIndex];
  const actions = pillar.actions.slice();
  actions[actionIndex] = next;
  const pillars = chart.pillars.slice();
  pillars[pillarIndex] = { ...pillar, actions };
  return touch({ ...chart, pillars }, now);
}

/** Set an action's text. */
export function setActionText(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  text: string,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  if (action.text === text) return chart;
  return replaceAction(chart, pillarIndex, actionIndex, { ...action, text }, now);
}

/** Set an action's free-text details (description / reward / if-then cue). Only
 * provided fields change; passing none is a no-op. Does not touch status. */
export function setActionDetails(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  details: { description?: string; reward?: string; cue?: string },
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  const description = details.description ?? action.description;
  const reward = details.reward ?? action.reward;
  const cue = details.cue ?? action.cue;
  if (description === action.description && reward === action.reward && cue === action.cue) {
    return chart;
  }
  return replaceAction(
    chart,
    pillarIndex,
    actionIndex,
    { ...action, description, reward, cue },
    now,
  );
}

/**
 * Apply a status transition to an action, keeping `completedAt` honest:
 * entering 'done' stamps it with `now()`, leaving 'done' clears it to null.
 * Re-entering 'done' from 'done' would be a no-op upstream, so its existing
 * timestamp is preserved.
 */
function withStatus(action: Action, status: StoredStatus, now: Clock): Action {
  const completedAt = status === 'done' ? now() : null;
  return { ...action, status, completedAt };
}

/** Set an action's stored status explicitly (maintains `completedAt`). */
export function setActionStatus(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  status: StoredStatus,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  if (action.status === status) return chart;
  return replaceAction(chart, pillarIndex, actionIndex, withStatus(action, status, now), now);
}

/** The next status in the todo -> doing -> done -> todo cycle. */
export function nextStatus(status: StoredStatus): StoredStatus {
  switch (status) {
    case 'todo':
      return 'doing';
    case 'doing':
      return 'done';
    case 'done':
      return 'todo';
  }
}

/** Cycle an action's status todo -> doing -> done -> todo. */
export function cycleActionStatus(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  return replaceAction(
    chart,
    pillarIndex,
    actionIndex,
    withStatus(action, nextStatus(action.status), now),
    now,
  );
}

// --- Habits (v1.2) -----------------------------------------------------------

/** Whether an ISO timestamp falls on the given local day key (bad dates: false). */
function isOnLocalDay(iso: string, dayKey: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return localDayKey(d) === dayKey;
}

/**
 * Turn daily habit tracking on/off for an action (SPEC 8.1). Turning it OFF
 * keeps the completion history (honest — it just reverts to task semantics using
 * the stored status) but also clears `established`, which is only meaningful
 * while an action is a habit.
 */
export function setActionHabit(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  habit: boolean,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  const established = habit ? action.established : false;
  if (action.habit === habit && action.established === established) return chart;
  return replaceAction(chart, pillarIndex, actionIndex, { ...action, habit, established }, now);
}

/**
 * Mark/un-mark a habit as established (SPEC 8.2). Marking established never
 * clears the completion history — the graph/calendar keep it. Un-establishing
 * returns the action to daily tracking.
 */
export function setActionEstablished(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  established: boolean,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  if (action.established === established) return chart;
  return replaceAction(chart, pillarIndex, actionIndex, { ...action, established }, now);
}

/**
 * Toggle a habit's "did it today" check (SPEC 8.1). If the action already has a
 * completion on the local day of `now()`, that day's entries are removed;
 * otherwise `now()` is appended. At most one completion per local day.
 */
export function toggleHabitToday(
  chart: Chart,
  pillarIndex: number,
  actionIndex: number,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(actionIndex)) return chart;
  const action = chart.pillars[pillarIndex].actions[actionIndex];
  const nowIso = now();
  const today = localDayKey(new Date(nowIso));
  const checkedToday = action.completions.some((c) => isOnLocalDay(c, today));
  const completions = checkedToday
    ? action.completions.filter((c) => !isOnLocalDay(c, today))
    : [...action.completions, nowIso];
  return replaceAction(chart, pillarIndex, actionIndex, { ...action, completions }, now);
}

/** Swap (reorder) two pillars by index. */
export function swapPillars(
  chart: Chart,
  a: number,
  b: number,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(a) || !inRange(b) || a === b) return chart;
  const pillars = chart.pillars.slice();
  const tmp = pillars[a];
  pillars[a] = pillars[b];
  pillars[b] = tmp;
  return touch({ ...chart, pillars }, now);
}

/** Swap (reorder) two actions within a pillar. */
export function swapActions(
  chart: Chart,
  pillarIndex: number,
  a: number,
  b: number,
  now: Clock = defaultNow,
): Chart {
  if (!inRange(pillarIndex) || !inRange(a) || !inRange(b) || a === b) return chart;
  const pillar = chart.pillars[pillarIndex];
  const actions = pillar.actions.slice();
  const tmp = actions[a];
  actions[a] = actions[b];
  actions[b] = tmp;
  const pillars = chart.pillars.slice();
  pillars[pillarIndex] = { ...pillar, actions };
  return touch({ ...chart, pillars }, now);
}

export function isPillarPresent(pillar: Pillar): boolean {
  return pillar.name.trim() !== '';
}
