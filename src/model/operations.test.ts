import { describe, expect, it } from 'vitest';
import { createChart } from './factory';
import {
  cycleActionStatus,
  nextStatus,
  renamePillar,
  setActionCadence,
  setActionDetails,
  setActionEstablished,
  setActionHabit,
  setActionStatus,
  setActionText,
  setGoal,
  swapActions,
  swapPillars,
  toggleHabitToday,
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

  it('setActionDetails sets description and reward (v1.1), leaving status intact', () => {
    let chart = setActionText(createChart(), 0, 0, 'Run', CLOCK);
    chart = setActionDetails(chart, 0, 0, { description: 'Easy 5k', reward: 'Smoothie' }, CLOCK);
    const action = chart.pillars[0].actions[0];
    expect(action.description).toBe('Easy 5k');
    expect(action.reward).toBe('Smoothie');
    expect(action.status).toBe('todo');
    // Partial update only touches the provided field.
    const next = setActionDetails(chart, 0, 0, { reward: 'Movie night' }, CLOCK);
    expect(next.pillars[0].actions[0].description).toBe('Easy 5k');
    expect(next.pillars[0].actions[0].reward).toBe('Movie night');
    // No-op when nothing changes.
    expect(setActionDetails(next, 0, 0, { reward: 'Movie night' }, CLOCK)).toBe(next);
    expect(setActionDetails(next, 0, 0, {}, CLOCK)).toBe(next);
  });

  it('stamps completedAt when entering done and clears it when leaving (honest history)', () => {
    const DONE_AT = () => '2021-07-07T09:00:00.000Z';
    let chart = setActionText(createChart(), 0, 0, 'Sprint', CLOCK);
    expect(chart.pillars[0].actions[0].completedAt).toBeNull();

    // todo -> doing: not done, still null.
    chart = cycleActionStatus(chart, 0, 0, DONE_AT);
    expect(chart.pillars[0].actions[0].status).toBe('doing');
    expect(chart.pillars[0].actions[0].completedAt).toBeNull();

    // doing -> done: stamped with the clock.
    chart = cycleActionStatus(chart, 0, 0, DONE_AT);
    expect(chart.pillars[0].actions[0].status).toBe('done');
    expect(chart.pillars[0].actions[0].completedAt).toBe('2021-07-07T09:00:00.000Z');

    // done -> todo: cleared.
    chart = cycleActionStatus(chart, 0, 0, DONE_AT);
    expect(chart.pillars[0].actions[0].status).toBe('todo');
    expect(chart.pillars[0].actions[0].completedAt).toBeNull();
  });

  it('setActionStatus also maintains completedAt', () => {
    const AT = () => '2021-08-08T00:00:00.000Z';
    let chart = setActionText(createChart(), 2, 3, 'Lift', CLOCK);
    chart = setActionStatus(chart, 2, 3, 'done', AT);
    expect(chart.pillars[2].actions[3].completedAt).toBe('2021-08-08T00:00:00.000Z');
    chart = setActionStatus(chart, 2, 3, 'doing', CLOCK);
    expect(chart.pillars[2].actions[3].completedAt).toBeNull();
  });

  // --- Habits (v1.2) ---------------------------------------------------------

  it('setActionHabit toggles the habit flag (idempotent no-op)', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    expect(chart.pillars[0].actions[0].habit).toBe(true);
    // No-op returns same reference.
    expect(setActionHabit(chart, 0, 0, true, CLOCK)).toBe(chart);
  });

  it('un-marking a habit keeps completions but clears established', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    chart = toggleHabitToday(chart, 0, 0, () => '2024-06-01T08:00:00.000Z');
    chart = setActionEstablished(chart, 0, 0, true, CLOCK);
    expect(chart.pillars[0].actions[0].completions).toHaveLength(1);

    const reverted = setActionHabit(chart, 0, 0, false, CLOCK);
    expect(reverted.pillars[0].actions[0].habit).toBe(false);
    expect(reverted.pillars[0].actions[0].established).toBe(false); // established cleared
    expect(reverted.pillars[0].actions[0].completions).toHaveLength(1); // history preserved
  });

  it('setActionEstablished does not clear completion history', () => {
    let chart = setActionText(createChart(), 0, 0, 'Run', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    chart = toggleHabitToday(chart, 0, 0, () => '2024-06-01T08:00:00.000Z');
    chart = setActionEstablished(chart, 0, 0, true, CLOCK);
    expect(chart.pillars[0].actions[0].established).toBe(true);
    expect(chart.pillars[0].actions[0].completions).toEqual(['2024-06-01T08:00:00.000Z']);
    // Un-establish returns to daily tracking, history intact.
    const back = setActionEstablished(chart, 0, 0, false, CLOCK);
    expect(back.pillars[0].actions[0].established).toBe(false);
    expect(back.pillars[0].actions[0].completions).toHaveLength(1);
  });

  it('toggleHabitToday adds one completion per local day and removes on re-toggle', () => {
    let chart = setActionText(createChart(), 0, 0, 'Stretch', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);

    // Check off at 08:00 local -> one completion.
    const morning = () => new Date(2024, 5, 1, 8, 0).toISOString();
    chart = toggleHabitToday(chart, 0, 0, morning);
    expect(chart.pillars[0].actions[0].completions).toHaveLength(1);

    // Toggling again LATER the same local day removes that day's entry.
    const evening = () => new Date(2024, 5, 1, 22, 0).toISOString();
    chart = toggleHabitToday(chart, 0, 0, evening);
    expect(chart.pillars[0].actions[0].completions).toHaveLength(0);

    // A different local day is independent and additive.
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2024, 5, 1, 9, 0).toISOString());
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2024, 5, 2, 9, 0).toISOString());
    expect(chart.pillars[0].actions[0].completions).toHaveLength(2);
  });

  it('toggleHabitToday keeps at most one completion per local day even across existing entries', () => {
    let chart = setActionText(createChart(), 0, 0, 'Read', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    // Seed two same-day entries directly (e.g. legacy data), then toggle: both go.
    const pillars = chart.pillars.slice();
    pillars[0] = {
      ...pillars[0],
      actions: pillars[0].actions.map((a, i) =>
        i === 0
          ? {
              ...a,
              completions: [
                new Date(2024, 5, 1, 8, 0).toISOString(),
                new Date(2024, 5, 1, 20, 0).toISOString(),
              ],
            }
          : a,
      ),
    };
    chart = { ...chart, pillars };
    const toggled = toggleHabitToday(chart, 0, 0, () => new Date(2024, 5, 1, 12, 0).toISOString());
    expect(toggled.pillars[0].actions[0].completions).toHaveLength(0);
  });

  // --- Weekly cadence (v1.5) -------------------------------------------------

  it('setActionCadence sets the weekly target', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    chart = setActionCadence(chart, 0, 0, 3, CLOCK);
    expect(chart.pillars[0].actions[0].weeklyTarget).toBe(3);
  });

  it('setActionCadence clamps out-of-range values into [0, 7]', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym', CLOCK);
    chart = setActionCadence(chart, 0, 0, -5, CLOCK);
    expect(chart.pillars[0].actions[0].weeklyTarget).toBe(0);
    chart = setActionCadence(chart, 0, 0, 99, CLOCK);
    expect(chart.pillars[0].actions[0].weeklyTarget).toBe(7);
    chart = setActionCadence(chart, 0, 0, NaN, CLOCK);
    expect(chart.pillars[0].actions[0].weeklyTarget).toBe(0);
  });

  it('setActionCadence rounds a float', () => {
    const chart = setActionCadence(createChart(), 0, 0, 3.6, CLOCK);
    expect(chart.pillars[0].actions[0].weeklyTarget).toBe(4);
  });

  it('setActionCadence is a no-op (same reference) when unchanged', () => {
    const chart = createChart();
    expect(setActionCadence(chart, 0, 0, 0, CLOCK)).toBe(chart);
    const withTarget = setActionCadence(chart, 0, 0, 3, CLOCK);
    expect(setActionCadence(withTarget, 0, 0, 3, CLOCK)).toBe(withTarget);
  });

  it('setActionCadence preserves completions/established/habit', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym', CLOCK);
    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    chart = toggleHabitToday(chart, 0, 0, () => '2024-06-01T08:00:00.000Z');
    chart = setActionEstablished(chart, 0, 0, true, CLOCK);
    const next = setActionCadence(chart, 0, 0, 3, CLOCK);
    expect(next.pillars[0].actions[0].habit).toBe(true);
    expect(next.pillars[0].actions[0].established).toBe(true);
    expect(next.pillars[0].actions[0].completions).toEqual(['2024-06-01T08:00:00.000Z']);
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

  // --- Per-action sync stamp (v2.2, SPEC 20) ---------------------------------

  it('content-mutating ops stamp the touched action.updatedAt, not other actions', () => {
    let chart = createChart();
    expect(chart.pillars[0].actions[0].updatedAt).toBe('');
    chart = setActionText(chart, 0, 0, 'Run', CLOCK);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(CLOCK());
    // A sibling action untouched by the mutation keeps its '' stamp.
    expect(chart.pillars[0].actions[1].updatedAt).toBe('');
  });

  it('setActionDetails, setActionStatus, cycleActionStatus, habit ops, and cadence all stamp the action', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'Meditate', CLOCK);
    const AFTER = () => '2021-06-06T01:00:00.000Z';

    chart = setActionDetails(chart, 0, 0, { description: 'x' }, AFTER);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(AFTER());

    chart = setActionStatus(chart, 0, 0, 'doing', CLOCK);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(CLOCK());

    chart = cycleActionStatus(chart, 0, 0, AFTER);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(AFTER());

    chart = setActionHabit(chart, 0, 0, true, CLOCK);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(CLOCK());

    chart = setActionEstablished(chart, 0, 0, true, AFTER);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(AFTER());

    chart = toggleHabitToday(chart, 0, 0, CLOCK);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(CLOCK());

    chart = setActionCadence(chart, 0, 0, 3, AFTER);
    expect(chart.pillars[0].actions[0].updatedAt).toBe(AFTER());
  });

  it('no-op action mutations do not stamp updatedAt', () => {
    const chart = createChart();
    expect(setActionText(chart, 0, 0, '', CLOCK).pillars[0].actions[0].updatedAt).toBe('');
  });

  it('chart-level-only ops (goal/theme/pillar rename) do not stamp any action', () => {
    let chart = createChart();
    chart = setGoal(chart, 'New goal', CLOCK);
    chart = renamePillar(chart, 0, 'Pillar A', CLOCK);
    for (const pillar of chart.pillars) {
      for (const action of pillar.actions) {
        expect(action.updatedAt).toBe('');
      }
    }
  });

  it('swapActions/swapPillars reposition actions without re-stamping them', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'first', CLOCK);
    const stampedAt = chart.pillars[0].actions[0].updatedAt;
    chart = swapActions(chart, 0, 0, 1, CLOCK);
    // The stamped action moved to index 1 but keeps its original stamp.
    expect(chart.pillars[0].actions[1].updatedAt).toBe(stampedAt);
    expect(chart.pillars[0].actions[0].updatedAt).toBe('');
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
