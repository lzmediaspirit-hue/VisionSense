// The ONLY allowed mutations on a chart. Every function is pure: it returns a new
// Chart (or the same reference when nothing changed) and never mutates its input.
// There is deliberately no addPillar/addAction/removePillar/removeAction — the
// Rule of 8 is structural (see factory.ts).

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

/** Set an action's stored status explicitly. */
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
  return replaceAction(chart, pillarIndex, actionIndex, { ...action, status }, now);
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
    { ...action, status: nextStatus(action.status) },
    now,
  );
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
