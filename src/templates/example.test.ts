import { describe, expect, it } from 'vitest';
import { validateChart } from '../model/storage';
import { RULE_OF_8 } from '../model/types';
import { buildExampleChart, EXAMPLE_CHART_ID, EXAMPLE_TEMPLATE_ID } from './example';

describe('example chart (v1.6, SPEC 13)', () => {
  it('passes strict chart validation', () => {
    const chart = buildExampleChart();
    expect(validateChart(chart)).not.toBeNull();
  });

  it('has exactly 8 pillars x 8 actions (Rule of 8)', () => {
    const chart = buildExampleChart();
    expect(chart.pillars).toHaveLength(RULE_OF_8);
    for (const pillar of chart.pillars) {
      expect(pillar.actions).toHaveLength(RULE_OF_8);
    }
  });

  it('carries the fixed id and the example template sentinel', () => {
    const chart = buildExampleChart();
    expect(chart.id).toBe(EXAMPLE_CHART_ID);
    expect(chart.templateId).toBe(EXAMPLE_TEMPLATE_ID);
    expect(chart.goal).toBe('Finish my first marathon');
  });

  it('contains a representative spread of habit/cue/reward/status content', () => {
    const chart = buildExampleChart();
    const actions = chart.pillars.flatMap((p) => p.actions);
    expect(actions.some((a) => a.habit && a.weeklyTarget === 0)).toBe(true);
    expect(actions.some((a) => a.habit && a.weeklyTarget >= 1)).toBe(true);
    expect(actions.some((a) => a.cue.trim() !== '')).toBe(true);
    expect(actions.some((a) => a.reward.trim() !== '')).toBe(true);
    expect(actions.some((a) => a.status === 'done')).toBe(true);
  });

  it('uses an injectable clock for createdAt/updatedAt', () => {
    const chart = buildExampleChart(() => '2020-01-01T00:00:00.000Z');
    expect(chart.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(chart.updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('seeds a 3-day streak for the daily habits and a single check for the weekly ones', () => {
    const today = new Date(2026, 6, 13); // Jul 13, 2026 (local)
    const chart = buildExampleChart(() => '2026-07-13T00:00:00.000Z', today);
    const find = (text: string) =>
      chart.pillars.flatMap((p) => p.actions).find((a) => a.text === text)!;
    expect(find('Stretch every morning').completions).toHaveLength(3);
    expect(find('Warm up before every run').completions).toHaveLength(3);
    expect(find('Long run once a week').completions).toHaveLength(1);
    expect(find('Three easy runs a week').completions).toHaveLength(1);
  });
});
