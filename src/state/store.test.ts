import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../model/factory';
import { EXAMPLE_SEEDED_KEY, getFlag } from '../model/onboarding';
import { EXAMPLE_CHART_ID } from '../templates/example';
import { seedFirstRun } from './store';

describe('seedFirstRun (v1.6, SPEC 13)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('seeds the example chart when charts are empty and the flag is unset, and sets the flag', () => {
    const state = seedFirstRun(createInitialState());
    expect(state.charts).toHaveLength(1);
    expect(state.charts[0].id).toBe(EXAMPLE_CHART_ID);
    // Dashboard-first: seeding never opens the example on its own.
    expect(state.activeChartId).toBeNull();
    expect(getFlag(EXAMPLE_SEEDED_KEY)).toBe(true);
  });

  it('leaves state unchanged when charts already exist (never resurrects, never overwrites)', () => {
    const initial = createInitialState();
    const withChart = {
      ...initial,
      charts: [{ id: 'x' } as unknown as (typeof initial.charts)[number]],
    };
    const state = seedFirstRun(withChart);
    expect(state).toBe(withChart);
    // A returning/synced user is never even asked to set the flag.
    expect(getFlag(EXAMPLE_SEEDED_KEY)).toBe(false);
  });

  it('leaves state unchanged when the flag is already set, even with zero charts', () => {
    localStorage.setItem(EXAMPLE_SEEDED_KEY, '1');
    const initial = createInitialState();
    const state = seedFirstRun(initial);
    expect(state).toBe(initial);
    expect(state.charts).toHaveLength(0);
  });
});
