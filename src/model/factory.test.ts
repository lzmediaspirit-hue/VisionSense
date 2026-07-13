import { describe, expect, it } from 'vitest';
import { createChart, createInitialState, defaultPillarColor } from './factory';
import { RULE_OF_8 } from './types';

describe('factory / Rule of 8', () => {
  it('creates a chart with exactly 8 pillars, each with exactly 8 actions', () => {
    const chart = createChart();
    expect(chart.pillars).toHaveLength(RULE_OF_8);
    for (const pillar of chart.pillars) {
      expect(pillar.actions).toHaveLength(RULE_OF_8);
      for (const action of pillar.actions) {
        expect(action.text).toBe('');
        expect(action.status).toBe('todo');
        expect(typeof action.id).toBe('string');
        // v1.1 fields default to empty / null.
        expect(action.description).toBe('');
        expect(action.reward).toBe('');
        expect(action.completedAt).toBeNull();
        // v1.2 habit fields default to off / empty.
        expect(action.habit).toBe(false);
        expect(action.established).toBe(false);
        expect(action.completions).toEqual([]);
      }
    }
  });

  it('gives each pillar a distinct, stable id', () => {
    const chart = createChart();
    const ids = new Set(chart.pillars.map((p) => p.id));
    expect(ids.size).toBe(RULE_OF_8);
    const actionIds = new Set(chart.pillars.flatMap((p) => p.actions.map((a) => a.id)));
    expect(actionIds.size).toBe(RULE_OF_8 * RULE_OF_8);
  });

  it('defaults theme to minimal and templateId to null', () => {
    const chart = createChart();
    expect(chart.themeId).toBe('minimal');
    expect(chart.templateId).toBeNull();
  });

  it('applies optional pillar names by index and ignores overflow', () => {
    const chart = createChart({ pillarNames: ['Body', 'Mind', 'Skill'] });
    expect(chart.pillars[0].name).toBe('Body');
    expect(chart.pillars[1].name).toBe('Mind');
    expect(chart.pillars[2].name).toBe('Skill');
    expect(chart.pillars[3].name).toBe('');
  });

  it('derives pillar color from index as a css custom property reference', () => {
    expect(defaultPillarColor(0)).toBe('var(--pillar-color-0)');
    expect(defaultPillarColor(7)).toBe('var(--pillar-color-7)');
    expect(defaultPillarColor(8)).toBe('var(--pillar-color-0)');
  });

  it('uses an injectable clock for createdAt/updatedAt', () => {
    const chart = createChart({ now: () => '2020-01-01T00:00:00.000Z' });
    expect(chart.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(chart.updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('creates an empty initial state', () => {
    expect(createInitialState()).toEqual({
      schemaVersion: 1,
      charts: [],
      activeChartId: null,
      days: {},
      reviews: {},
    });
  });

  it('exposes no add/remove APIs (Rule of 8 is structural)', async () => {
    const mod = await import('./index');
    const names = Object.keys(mod);
    expect(names.some((n) => /^add/i.test(n))).toBe(false);
    expect(names.some((n) => /^remove/i.test(n))).toBe(false);
  });
});
