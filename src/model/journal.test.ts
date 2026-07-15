// Pure unit tests for the v1.4 journal layer (SPEC 11.2/11.3): validation
// defaults, the local-day/MIT/ISO-week helpers, day pruning, and the weekly
// review "due" signal.

import { describe, expect, it } from 'vitest';
import { localDayKey, streakAcrossCharts } from './completions';
import { createAction, createChart } from './factory';
import {
  DAY_MAX_AGE_DAYS,
  dueHabitCount,
  isoWeekKey,
  isoWeekLabel,
  isReviewDue,
  isWeeklySatisfied,
  MAX_MITS,
  pruneDays,
  splitPicks,
  validateDayPlan,
  validateDays,
  validateReview,
  validateReviews,
  weekCompletions,
  weekEvidence,
} from './journal';
import {
  setActionCadence,
  setActionEstablished,
  setActionHabit,
  setActionStatus,
  setActionText,
  toggleHabitToday,
} from './operations';
import type { Action, Chart, DayPlan, Review } from './types';

describe('validateDayPlan / validateDays', () => {
  it('defaults every field on a bare object', () => {
    expect(validateDayPlan({})).toEqual({ mits: [], note: '', updatedAt: expect.any(String) });
  });

  it('returns null for non-objects', () => {
    expect(validateDayPlan(null)).toBeNull();
    expect(validateDayPlan('nope')).toBeNull();
    expect(validateDayPlan([1, 2])).toBeNull();
  });

  it('does not cap mits — bonus picks beyond MAX_MITS survive, in order (v2.4)', () => {
    const mits = Array.from({ length: 6 }, (_, i) => ({ chartId: 'c', actionId: `a${i}` }));
    const plan = validateDayPlan({ mits, note: '', updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(plan?.mits.length).toBeGreaterThan(MAX_MITS);
    expect(plan?.mits).toHaveLength(6);
    expect(plan?.mits).toEqual(mits);
  });

  it('drops malformed mit entries but keeps well-formed ones', () => {
    const plan = validateDayPlan({
      mits: [{ chartId: 'c', actionId: 'a' }, { chartId: 'c' }, 'nope', 42, null],
    });
    expect(plan?.mits).toEqual([{ chartId: 'c', actionId: 'a' }]);
  });

  it('validateDays drops unparseable entries but keeps good ones', () => {
    const days = validateDays({
      '2026-07-10': { mits: [], note: 'hi', updatedAt: '2026-07-10T00:00:00.000Z' },
      '2026-07-11': null,
      '2026-07-12': 'nope',
    });
    expect(Object.keys(days)).toEqual(['2026-07-10']);
    expect(days['2026-07-10'].note).toBe('hi');
  });

  it('validateDays returns {} for non-objects', () => {
    expect(validateDays(null)).toEqual({});
    expect(validateDays('nope')).toEqual({});
    expect(validateDays([1, 2])).toEqual({});
  });
});

describe('splitPicks', () => {
  it('splits 0 picks into two empty arrays', () => {
    expect(splitPicks([])).toEqual({ top: [], bonus: [] });
  });

  it('splits exactly MAX_MITS picks into all-top, no bonus', () => {
    const picks = Array.from({ length: MAX_MITS }, (_, i) => String.fromCharCode(97 + i));
    expect(picks).toEqual(['a', 'b', 'c']);
    expect(splitPicks(picks)).toEqual({ top: ['a', 'b', 'c'], bonus: [] });
  });

  it('splits 5 picks into the first 3 top and the rest bonus, order preserved', () => {
    const picks = ['a', 'b', 'c', 'd', 'e'];
    expect(splitPicks(picks)).toEqual({ top: ['a', 'b', 'c'], bonus: ['d', 'e'] });
  });

  it('does not mutate the input array', () => {
    const picks = ['a', 'b', 'c', 'd'];
    const { top, bonus } = splitPicks(picks);
    expect(picks).toEqual(['a', 'b', 'c', 'd']);
    expect(top).not.toBe(picks);
    expect(bonus).not.toBe(picks);
  });
});

describe('validateReview / validateReviews', () => {
  it('defaults every field on a bare object', () => {
    expect(validateReview({})).toEqual({
      wins: '',
      obstacle: '',
      change: '',
      focus: '',
      updatedAt: expect.any(String),
    });
  });

  it('returns null for non-objects', () => {
    expect(validateReview(null)).toBeNull();
    expect(validateReview(42)).toBeNull();
  });

  it('preserves well-typed fields and defaults wrong-typed ones', () => {
    const review = validateReview({
      wins: 'shipped it',
      obstacle: 42, // wrong type -> defaulted
      change: 'sleep more',
      focus: 'ship v1.4',
      updatedAt: '2026-07-10T00:00:00.000Z',
    });
    expect(review).toEqual({
      wins: 'shipped it',
      obstacle: '',
      change: 'sleep more',
      focus: 'ship v1.4',
      updatedAt: '2026-07-10T00:00:00.000Z',
    });
  });

  it('validateReviews drops unparseable entries', () => {
    const reviews = validateReviews({
      '2026-W28': { wins: 'ok', updatedAt: '2026-07-10T00:00:00.000Z' },
      '2026-W27': null,
    });
    expect(Object.keys(reviews)).toEqual(['2026-W28']);
  });

  it('validateReviews returns {} for non-objects', () => {
    expect(validateReviews(undefined)).toEqual({});
  });
});

describe('pruneDays', () => {
  const NOW = new Date(2026, 6, 13); // local July 13, 2026

  function plan(): DayPlan {
    return { mits: [], note: '', updatedAt: '2026-01-01T00:00:00.000Z' };
  }

  it('drops day keys older than the max age and keeps the rest', () => {
    const old = localDayKey(new Date(2025, 0, 1)); // ~560 days before NOW
    const recent = localDayKey(new Date(2026, 6, 1));
    const days = { [old]: plan(), [recent]: plan() };
    const pruned = pruneDays(days, NOW, DAY_MAX_AGE_DAYS);
    expect(Object.keys(pruned)).toEqual([recent]);
  });

  it('returns the SAME reference when nothing is pruned', () => {
    const recent = localDayKey(new Date(2026, 6, 1));
    const days = { [recent]: plan() };
    expect(pruneDays(days, NOW, DAY_MAX_AGE_DAYS)).toBe(days);
  });

  it('keeps a non-date-shaped key rather than silently discarding it', () => {
    const days = { 'not-a-date-key': plan() };
    expect(pruneDays(days, NOW, DAY_MAX_AGE_DAYS)).toEqual(days);
  });

  it('keeps a day exactly at the cutoff, drops one day older (boundary is exclusive)', () => {
    const cutoffKey = localDayKey(new Date(2026, 6, 13 - DAY_MAX_AGE_DAYS));
    const olderKey = localDayKey(new Date(2026, 6, 13 - DAY_MAX_AGE_DAYS - 1));
    const days = { [cutoffKey]: plan(), [olderKey]: plan() };
    expect(pruneDays(days, NOW, DAY_MAX_AGE_DAYS)).toEqual({ [cutoffKey]: plan() });
  });
});

describe('isoWeekKey / isoWeekLabel', () => {
  it('formats a mid-week Monday-start ISO week', () => {
    // Monday July 13, 2026 is in ISO week 29 of 2026.
    expect(isoWeekKey(new Date(2026, 6, 13))).toBe('2026-W29');
  });

  it('a Sunday belongs to the same ISO week as the preceding Monday', () => {
    // Sunday July 19, 2026 is still ISO week 29.
    expect(isoWeekKey(new Date(2026, 6, 19))).toBe('2026-W29');
    // Monday July 20, 2026 rolls to week 30.
    expect(isoWeekKey(new Date(2026, 6, 20))).toBe('2026-W30');
  });

  it('handles a year boundary (late-Dec date can belong to next ISO year week 1)', () => {
    // Dec 31, 2029 is a Monday and starts ISO week 1 of 2030.
    expect(isoWeekKey(new Date(2029, 11, 31))).toBe('2030-W01');
  });

  it('isoWeekLabel renders a human label from the machine key', () => {
    expect(isoWeekLabel('2026-W29')).toBe('Week 29, 2026');
  });

  it('isoWeekLabel falls back to the raw key when malformed', () => {
    expect(isoWeekLabel('not-a-week-key')).toBe('not-a-week-key');
  });
});

describe('weekCompletions / isWeeklySatisfied (v1.5)', () => {
  const NOW = new Date(2026, 6, 13); // Monday, ISO week 2026-W29

  function habitAction(completions: string[], weeklyTarget = 3): Action {
    return { ...createAction(), habit: true, weeklyTarget, completions };
  }

  it('counts distinct local days in the current ISO week', () => {
    const action = habitAction([
      new Date(2026, 6, 13, 8, 0).toISOString(), // Mon (this week)
      new Date(2026, 6, 13, 20, 0).toISOString(), // Mon again — same local day
      new Date(2026, 6, 15, 9, 0).toISOString(), // Wed (this week)
    ]);
    expect(weekCompletions(action, NOW)).toBe(2);
  });

  it('ignores completions from other weeks', () => {
    const action = habitAction([
      new Date(2026, 6, 13, 8, 0).toISOString(), // Mon, this week
      new Date(2026, 6, 6, 8, 0).toISOString(), // Mon, last week (2026-W28)
      new Date(2026, 6, 20, 8, 0).toISOString(), // Mon, next week (2026-W30)
    ]);
    expect(weekCompletions(action, NOW)).toBe(1);
  });

  it('isWeeklySatisfied is false below target and true at/above target', () => {
    const belowTarget = habitAction([new Date(2026, 6, 13, 8, 0).toISOString()], 3);
    expect(isWeeklySatisfied(belowTarget, NOW)).toBe(false);

    const atTarget = habitAction(
      [
        new Date(2026, 6, 13, 8, 0).toISOString(),
        new Date(2026, 6, 14, 8, 0).toISOString(),
        new Date(2026, 6, 15, 8, 0).toISOString(),
      ],
      3,
    );
    expect(isWeeklySatisfied(atTarget, NOW)).toBe(true);

    const aboveTarget = habitAction(
      [
        new Date(2026, 6, 13, 8, 0).toISOString(),
        new Date(2026, 6, 14, 8, 0).toISOString(),
        new Date(2026, 6, 15, 8, 0).toISOString(),
        new Date(2026, 6, 16, 8, 0).toISOString(),
      ],
      3,
    );
    expect(isWeeklySatisfied(aboveTarget, NOW)).toBe(true);
  });

  it('is always false when weeklyTarget is 0, no matter the completions', () => {
    const action = habitAction(
      [
        new Date(2026, 6, 13, 8, 0).toISOString(),
        new Date(2026, 6, 14, 8, 0).toISOString(),
        new Date(2026, 6, 15, 8, 0).toISOString(),
      ],
      0,
    );
    expect(isWeeklySatisfied(action, NOW)).toBe(false);
  });
});

describe('dueHabitCount (v2.1)', () => {
  const NOW = new Date(2026, 6, 13); // Monday, ISO week 2026-W29

  it('counts a daily habit not yet checked off today', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate');
    chart = setActionHabit(chart, 0, 0, true);
    expect(dueHabitCount(chart, NOW)).toBe(1);
  });

  it('does not count a daily habit already checked off today', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate');
    chart = setActionHabit(chart, 0, 0, true);
    chart = toggleHabitToday(chart, 0, 0, () => NOW.toISOString());
    expect(dueHabitCount(chart, NOW)).toBe(0);
  });

  it('does not count a weekly habit that has met its target this week', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym');
    chart = setActionHabit(chart, 0, 0, true);
    chart = setActionCadence(chart, 0, 0, 2);
    // Checked off two days this week, satisfying the target — but NEITHER is
    // "today" (Mon the 13th), so the "checked off today" exemption isn't what's
    // masking it; the satisfied-target rule alone must be doing the work.
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2026, 6, 14, 8, 0).toISOString()); // Tue, this week
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2026, 6, 15, 8, 0).toISOString()); // Wed, this week
    expect(isWeeklySatisfied(chart.pillars[0].actions[0], NOW)).toBe(true);
    expect(dueHabitCount(chart, NOW)).toBe(0);
  });

  it('does not count a weekly habit already checked off today, even if unsatisfied', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym');
    chart = setActionHabit(chart, 0, 0, true);
    chart = setActionCadence(chart, 0, 0, 3);
    chart = toggleHabitToday(chart, 0, 0, () => NOW.toISOString());
    expect(dueHabitCount(chart, NOW)).toBe(0);
  });

  it('counts a weekly habit that is unsatisfied and not checked off today', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym');
    chart = setActionHabit(chart, 0, 0, true);
    chart = setActionCadence(chart, 0, 0, 3);
    expect(dueHabitCount(chart, NOW)).toBe(1);
  });

  it('never counts an established habit, an empty (unfilled) habit action, or a non-habit action', () => {
    let chart = setActionText(createChart(), 0, 0, 'Established habit');
    chart = setActionHabit(chart, 0, 0, true);
    chart = setActionEstablished(chart, 0, 0, true);
    chart = setActionHabit(chart, 0, 1, true); // unfilled: text is still ''
    chart = setActionText(chart, 0, 2, 'Plain task'); // filled but not a habit
    expect(dueHabitCount(chart, NOW)).toBe(0);
  });
});

describe('isReviewDue', () => {
  const NOW = new Date(2026, 6, 13); // Monday, ISO week 2026-W29

  function review(updatedAt: string): Review {
    return { wins: '', obstacle: '', change: '', focus: '', updatedAt };
  }

  it('is due when there are no reviews at all', () => {
    expect(isReviewDue({}, NOW)).toBe(true);
  });

  it('is NOT due when the current week already has a review', () => {
    const reviews = { [isoWeekKey(NOW)]: review(NOW.toISOString()) };
    expect(isReviewDue(reviews, NOW)).toBe(false);
  });

  it('is due when the newest review is 7+ days old and the current week has none', () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const reviews = { '2026-W27': review(eightDaysAgo) };
    expect(isReviewDue(reviews, NOW)).toBe(true);
  });

  it('is NOT due when the newest review is under 7 days old, even without a current-week review', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const reviews = { '2026-W28': review(twoDaysAgo) };
    expect(isReviewDue(reviews, NOW)).toBe(false);
  });
});

describe('weekEvidence (v1.9)', () => {
  const NOW = new Date(2026, 6, 13); // Monday, ISO week 2026-W29

  it('a daily habit (weeklyTarget 0) gets target 7', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate');
    chart = setActionHabit(chart, 0, 0, true);
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2026, 6, 13, 8, 0).toISOString());
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.habits).toEqual([{ name: 'Meditate', days: 1, target: 7 }]);
  });

  it('a weekly-cadence habit gets its own weeklyTarget', () => {
    let chart = setActionText(createChart(), 0, 0, 'Gym');
    chart = setActionHabit(chart, 0, 0, true);
    chart = setActionCadence(chart, 0, 0, 3);
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.habits).toEqual([{ name: 'Gym', days: 0, target: 3 }]);
  });

  it('excludes completions from other ISO weeks when counting a habit\'s days', () => {
    let chart = setActionText(createChart(), 0, 0, 'Read');
    chart = setActionHabit(chart, 0, 0, true);
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2026, 6, 13, 8, 0).toISOString()); // this week (Mon)
    chart = toggleHabitToday(chart, 0, 0, () => new Date(2026, 6, 6, 8, 0).toISOString()); // last week (Mon)
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.habits).toEqual([{ name: 'Read', days: 1, target: 7 }]);
  });

  it('tasksDone counts only non-habit tasks completed within the current ISO week', () => {
    let chart = setActionText(createChart(), 0, 0, 'Ship v1');
    chart = setActionStatus(chart, 0, 0, 'done', () => new Date(2026, 6, 14, 9, 0).toISOString()); // this week (Tue)
    chart = setActionText(chart, 0, 1, 'Old task');
    chart = setActionStatus(chart, 0, 1, 'done', () => new Date(2026, 5, 1, 9, 0).toISOString()); // a different week
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.tasksDone).toBe(1);
  });

  it('excludes established and unfilled habits from the habits list', () => {
    let chart = setActionText(createChart(), 0, 0, 'Established habit');
    chart = setActionHabit(chart, 0, 0, true);
    chart = setActionEstablished(chart, 0, 0, true);
    chart = setActionHabit(chart, 0, 1, true); // unfilled: text is still ''
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.habits).toEqual([]);
  });

  it('an empty charts array yields empty habits and zero tasksDone', () => {
    expect(weekEvidence([], NOW)).toEqual({ habits: [], tasksDone: 0, streak: 0 });
  });

  it('a chart with no filled actions yields empty habits and zero tasksDone', () => {
    const chart: Chart = createChart();
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.habits).toEqual([]);
    expect(evidence.tasksDone).toBe(0);
  });

  it('streak reuses streakAcrossCharts', () => {
    let chart = setActionText(createChart(), 0, 0, 'Meditate');
    chart = setActionHabit(chart, 0, 0, true);
    chart = toggleHabitToday(chart, 0, 0, () => NOW.toISOString());
    const evidence = weekEvidence([chart], NOW);
    expect(evidence.streak).toBe(streakAcrossCharts([chart], NOW));
  });
});
