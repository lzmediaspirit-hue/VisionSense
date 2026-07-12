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
      if (action.status === 'done') done++;
    }
  }
  return { filled, done, total: RULE_OF_8 };
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
