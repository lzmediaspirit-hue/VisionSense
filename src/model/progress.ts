// Derived, read-only progress helpers. 'empty' status is derived from empty text.

import {
  RULE_OF_8,
  TOTAL_ACTIONS,
  type Action,
  type ActionStatus,
  type Chart,
  type Pillar,
} from './types';

/** Derived status: an action with empty text is 'empty' regardless of stored status. */
export function actionStatus(action: Action): ActionStatus {
  return action.text.trim() === '' ? 'empty' : action.status;
}

export function isActionFilled(action: Action): boolean {
  return action.text.trim() !== '';
}

/**
 * Whether an action counts as "done" toward chart/pillar progress (SPEC 8.3): a
 * task is done when `status === 'done'`; a habit is done when it is established
 * (the habit is achieved), regardless of its now-ignored stored status.
 */
export function isActionDone(action: Action): boolean {
  return action.habit ? action.established : action.status === 'done';
}

/**
 * Whether a habit is tracked on a weekly cadence rather than daily (v1.5,
 * SPEC 12): a habit with a weekly target of >= 1 check-off days per ISO week.
 * `weeklyTarget` is meaningless for a non-habit, so this is always false then.
 */
export function isWeeklyHabit(action: Action): boolean {
  return action.habit && action.weeklyTarget >= 1;
}

export interface Progress {
  filled: number;
  done: number;
  total: number;
}

export function pillarProgress(pillar: Pillar): Progress {
  let filled = 0;
  let done = 0;
  for (const action of pillar.actions) {
    if (isActionFilled(action)) {
      filled++;
      if (isActionDone(action)) done++;
    }
  }
  return { filled, done, total: RULE_OF_8 };
}

/** Whether every one of a pillar's 8 action cells is filled AND done (v1.10, SPEC 17). */
export function isPillarComplete(progress: Progress): boolean {
  return progress.filled === RULE_OF_8 && progress.done === RULE_OF_8;
}

export function chartProgress(chart: Chart): Progress {
  let filled = 0;
  let done = 0;
  for (const pillar of chart.pillars) {
    const p = pillarProgress(pillar);
    filled += p.filled;
    done += p.done;
  }
  return { filled, done, total: TOTAL_ACTIONS };
}

/** Fraction 0..1 of filled actions that are done (0 when nothing filled). */
export function completionRatio(progress: Progress): number {
  if (progress.filled === 0) return 0;
  return progress.done / progress.filled;
}

export interface LocatedAction {
  pillarIndex: number;
  actionIndex: number;
  pillar: Pillar;
  action: Action;
}

export interface PillarRadarPoint {
  name: string;
  filled: number;
  done: number;
}

/**
 * One entry per pillar (in chart order) for the Progress dialog's Radar tab
 * (v2.3, SPEC 21): `filled`/`done` are the same counts as `pillarProgress`
 * (0..8), reusing isActionFilled/isActionDone so the radar's semantics never
 * drift from the bar chart's. `name` falls back to 'Pillar N' (1-based) for an
 * unnamed pillar, matching the fallback used elsewhere (e.g. BlockView).
 */
export function pillarRadar(chart: Chart): PillarRadarPoint[] {
  return chart.pillars.map((pillar, i) => {
    const { filled, done } = pillarProgress(pillar);
    return { name: pillar.name.trim() || `Pillar ${i + 1}`, filled, done };
  });
}

/**
 * Find an action by id within a chart, returning its indices and the live
 * pillar/action (or null if absent). Used by the Today view, which references
 * actions by id across charts rather than by grid position.
 */
export function findActionById(chart: Chart, actionId: string): LocatedAction | null {
  for (let p = 0; p < chart.pillars.length; p++) {
    const pillar = chart.pillars[p];
    for (let a = 0; a < pillar.actions.length; a++) {
      if (pillar.actions[a].id === actionId) {
        return { pillarIndex: p, actionIndex: a, pillar, action: pillar.actions[a] };
      }
    }
  }
  return null;
}
