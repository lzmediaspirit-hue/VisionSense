import { describe, expect, it } from 'vitest';
import { createChart } from './factory';
import {
  cycleActionStatus,
  nextStatus,
  renamePillar,
  setActionStatus,
  setActionText,
  setGoal,
  swapActions,
  swapPillars,
} from './operations';

const CLOCK = () => '2021-06-06T00:00:00.000Z';

describe('operations', () => {
  it('setGoal returns a new chart and bumps updatedAt', () => {
    const chart = createChart({ now: () => '2020-01-01T00:00:00.000Z' });
    const next = setGoal(chart, 'Win Nationals', CLOCK);
    expect(next).not.toBe(chart);
    expect(next.goal).toBe('Win Nationals');
    expect(next.updatedAt).toBe('2021-06-06T00:00:00.000Z');
    expect(chart.goal).toBe(''); // input untouched
  });

  it('no-op mutations return the same reference', () => {
    const chart = createChart();
    expect(setGoal(chart, '', CLOCK)).toBe(chart);
    expect(renamePillar(chart, 0, '', CLOCK)).toBe(chart);
    expect(setActionText(chart, 0, 0, '', CLOCK)).toBe(chart);
  });

  it('renamePillar updates the single datum (mirrored in the UI via grid)', () => {
    const chart = createChart();
    const next = renamePillar(chart, 3, 'Nutrition', CLOCK);
    expect(next.pillars[3].name).toBe('Nutrition');
    expect(chart.pillars[3].name).toBe('');
  });

  it('setActionText sets text without disturbing status', () => {
    const chart = createChart();
    const next = setActionText(chart, 2, 5, 'Sprint 3x/week', CLOCK);
    expect(next.pillars[2].actions[5].text).toBe('Sprint 3x/week');
    expect(next.pillars[2].actions[5].status).toBe('todo');
  });

  it('cycles status todo -> doing -> done -> todo', () => {
    expect(nextStatus('todo')).toBe('doing');
    expect(nextStatus('doing')).toBe('done');
    expect(nextStatus('done')).toBe('todo');

    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'x', CLOCK);
    chart = cycleActionStatus(chart, 0, 0, CLOCK);
    expect(chart.pillars[0].actions[0].status).toBe('doing');
    chart = cycleActionStatus(chart, 0, 0, CLOCK);
    expect(chart.pillars[0].actions[0].status).toBe('done');
    chart = cycleActionStatus(chart, 0, 0, CLOCK);
    expect(chart.pillars[0].actions[0].status).toBe('todo');
  });

  it('setActionStatus sets explicitly', () => {
    const chart = setActionStatus(createChart(), 1, 1, 'done', CLOCK);
    expect(chart.pillars[1].actions[1].status).toBe('done');
  });

  it('ignores out-of-range indices (Rule of 8 boundary)', () => {
    const chart = createChart();
    expect(renamePillar(chart, 8, 'x', CLOCK)).toBe(chart);
    expect(renamePillar(chart, -1, 'x', CLOCK)).toBe(chart);
    expect(setActionText(chart, 0, 8, 'x', CLOCK)).toBe(chart);
    expect(cycleActionStatus(chart, 0, 99, CLOCK)).toBe(chart);
  });

  it('swapPillars reorders without adding/removing', () => {
    let chart = createChart();
    chart = renamePillar(chart, 0, 'A', CLOCK);
    chart = renamePillar(chart, 1, 'B', CLOCK);
    const next = swapPillars(chart, 0, 1, CLOCK);
    expect(next.pillars[0].name).toBe('B');
    expect(next.pillars[1].name).toBe('A');
    expect(next.pillars).toHaveLength(8);
    expect(swapPillars(chart, 2, 2, CLOCK)).toBe(chart);
  });

  it('swapActions reorders within a pillar', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'first', CLOCK);
    chart = setActionText(chart, 0, 1, 'second', CLOCK);
    const next = swapActions(chart, 0, 0, 1, CLOCK);
    expect(next.pillars[0].actions[0].text).toBe('second');
    expect(next.pillars[0].actions[1].text).toBe('first');
    expect(next.pillars[0].actions).toHaveLength(8);
  });
});
