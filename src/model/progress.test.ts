import { describe, expect, it } from 'vitest';
import { createChart } from './factory';
import {
  setActionEstablished,
  setActionHabit,
  setActionStatus,
  setActionText,
  toggleHabitToday,
} from './operations';
import {
  actionStatus,
  chartProgress,
  completionRatio,
  isActionDone,
  pillarProgress,
} from './progress';

const CLOCK = () => '2021-01-01T00:00:00.000Z';

describe('progress', () => {
  it('derives empty status from empty text regardless of stored status', () => {
    // A stored 'done' with empty text is still derived-empty.
    const chart = setActionStatus(createChart(), 0, 0, 'done', CLOCK);
    expect(actionStatus(chart.pillars[0].actions[0])).toBe('empty');
  });

  it('reports derived status for filled cells', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'run', CLOCK);
    chart = setActionStatus(chart, 0, 0, 'doing', CLOCK);
    expect(actionStatus(chart.pillars[0].actions[0])).toBe('doing');
  });

  it('counts filled and done per pillar', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'a', CLOCK);
    chart = setActionText(chart, 0, 1, 'b', CLOCK);
    chart = setActionStatus(chart, 0, 0, 'done', CLOCK);
    const p = pillarProgress(chart.pillars[0]);
    expect(p).toEqual({ filled: 2, done: 1, total: 8 });
  });

  it('whitespace-only text does not count as filled', () => {
    const chart = setActionText(createChart(), 0, 0, '   ', CLOCK);
    expect(pillarProgress(chart.pillars[0]).filled).toBe(0);
  });

  it('aggregates chart progress across 64 actions', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'a', CLOCK);
    chart = setActionStatus(chart, 0, 0, 'done', CLOCK);
    chart = setActionText(chart, 7, 7, 'z', CLOCK);
    const c = chartProgress(chart);
    expect(c).toEqual({ filled: 2, done: 1, total: 64 });
  });

  it('a habit counts as done only when established, not merely checked today (SPEC 8.3)', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    // Checked off today but not established: filled, not done.
    chart = toggleHabitToday(chart, 0, 0, CLOCK);
    expect(isActionDone(chart.pillars[0].actions[0])).toBe(false);
    expect(pillarProgress(chart.pillars[0])).toEqual({ filled: 1, done: 0, total: 8 });

    // Establish it: now done, regardless of its (ignored) stored status.
    chart = setActionEstablished(chart, 0, 0, true, CLOCK);
    expect(isActionDone(chart.pillars[0].actions[0])).toBe(true);
    expect(pillarProgress(chart.pillars[0])).toEqual({ filled: 1, done: 1, total: 8 });
  });

  it("a habit's stored 'done' status is ignored for progress; only established counts", () => {
    let chart = setActionText(createChart(), 0, 0, 'Run', CLOCK);
    chart = setActionStatus(chart, 0, 0, 'done', CLOCK); // stored done...
    chart = setActionHabit(chart, 0, 0, true, CLOCK); // ...but now a (un-established) habit
    expect(isActionDone(chart.pillars[0].actions[0])).toBe(false);
    expect(chartProgress(chart)).toEqual({ filled: 1, done: 0, total: 64 });
  });

  it('completionRatio is 0 when nothing filled', () => {
    expect(completionRatio({ filled: 0, done: 0, total: 8 })).toBe(0);
    expect(completionRatio({ filled: 4, done: 1, total: 8 })).toBe(0.25);
  });
});
