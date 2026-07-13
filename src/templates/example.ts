// The first-run example chart (v1.6, SPEC 13): a fully-filled "Finish my
// first marathon" Mandala chart, seeded once on a brand-new device so new
// users see a worked example instead of a blank 9x9 grid. Built entirely from
// createChart/createAction SPREADS (never a hand-rolled object literal) so it
// always matches the current Action/Chart shape — a future field addition to
// factory.ts is picked up here automatically via the spread + defaults below.

import { createAction, createChart } from '../model/factory';
import type { Action, Chart, StoredStatus } from '../model/types';

/** Fixed id: there is ever only one example chart per device (SPEC 13). */
export const EXAMPLE_CHART_ID = 'example-marathon';

/** Sentinel stored in `templateId` marking this chart as the example. Reuses
 * the existing "provenance only" field — no schema change. */
export const EXAMPLE_TEMPLATE_ID = 'example';

interface ActionSpec {
  text: string;
  /** Daily habit (weeklyTarget 0) or weekly habit (weeklyTarget 1..7). */
  habit?: boolean;
  weeklyTarget?: number;
  cue?: string;
  reward?: string;
  status?: StoredStatus;
}

interface PillarSpec {
  name: string;
  actions: readonly ActionSpec[];
}

// 8 pillars x 8 actions (Rule of 8), transcribed verbatim from SPEC 13.
const PILLARS: readonly PillarSpec[] = [
  {
    name: 'Endurance',
    actions: [
      {
        text: 'Long run once a week',
        habit: true,
        weeklyTarget: 1,
        cue: 'Saturday morning, from the park gate',
        reward: 'Pancake brunch',
      },
      { text: 'Three easy runs a week', habit: true, weeklyTarget: 3 },
      { text: 'Follow a 16-week training plan', status: 'doing' },
      { text: 'Build up to a 20-mile long run' },
      { text: 'Practice goal marathon pace' },
      { text: 'One tempo run each week' },
      { text: 'Keep a mileage log', status: 'doing' },
      { text: 'Try run–walk pacing on long days' },
    ],
  },
  {
    name: 'Strength & mobility',
    actions: [
      { text: 'Strength session twice a week', habit: true, weeklyTarget: 2, reward: 'Protein shake' },
      { text: 'Stretch every morning', habit: true, cue: 'Right after I wake up' },
      { text: 'Core workout' },
      { text: 'Foam-roll tight calves', habit: true },
      { text: 'Hip mobility drills' },
      { text: 'Single-leg balance work' },
      { text: 'Book a sports massage' },
      { text: 'Glute activation before runs', status: 'doing' },
    ],
  },
  {
    name: 'Nutrition & hydration',
    actions: [
      { text: 'Carb-load before long runs' },
      { text: 'Practice race-day breakfast' },
      { text: 'Drink water through the day', habit: true, cue: 'A glass with every meal' },
      { text: 'Test energy gels on long runs', status: 'doing' },
      { text: 'Eat protein after training', habit: true },
      { text: 'Cut late-night snacking' },
      { text: "Plan the week's meals", habit: true, weeklyTarget: 1 },
      { text: 'Limit alcohol during training' },
    ],
  },
  {
    name: 'Recovery & sleep',
    actions: [
      { text: 'Sleep 8 hours a night', habit: true, cue: 'Lights out by 10:30' },
      { text: 'Take one full rest day a week', habit: true, weeklyTarget: 1 },
      { text: 'Ice bath after long runs' },
      { text: 'Legs up the wall for 10 min' },
      { text: 'No screens before bed', habit: true },
      { text: 'Track resting heart rate', habit: true },
      { text: 'Deload every fourth week' },
      { text: 'Nap after the long run' },
    ],
  },
  {
    name: 'Mindset',
    actions: [
      { text: 'Visualise the finish line', habit: true, cue: 'On the walk to work' },
      { text: 'Set a realistic finish-time goal', status: 'done' },
      { text: 'Pick a mantra for the wall at mile 20' },
      { text: 'Journal after each long run', habit: true, weeklyTarget: 1 },
      { text: 'Reframe bad runs as data' },
      { text: 'Celebrate the small wins', status: 'doing' },
      { text: 'Practise being uncomfortable on purpose' },
      { text: 'Read one running memoir' },
    ],
  },
  {
    name: 'Injury prevention',
    actions: [
      { text: 'Warm up before every run', habit: true },
      { text: 'Replace shoes every 400 miles' },
      { text: 'Follow the 10%-a-week mileage rule', status: 'doing' },
      { text: 'Address niggles early' },
      { text: 'Strengthen ankles and feet' },
      { text: 'Run on soft surfaces sometimes' },
      { text: 'Book a physio check-up' },
      { text: 'Rest at the first real sign of pain' },
    ],
  },
  {
    name: 'Gear & logistics',
    actions: [
      { text: 'Get fitted for proper running shoes', status: 'done' },
      { text: 'Break in the race-day shoes', status: 'doing' },
      { text: 'Test kit for chafing on long runs' },
      { text: 'Buy anti-blister socks', status: 'done' },
      { text: 'Set up the running watch / app', status: 'done' },
      { text: 'Plan wet-weather gear' },
      { text: 'Charge all devices the night before' },
      { text: 'Lay out kit the night before', habit: true, cue: 'After dinner' },
    ],
  },
  {
    name: 'Race-day prep',
    actions: [
      { text: 'Register for the marathon', status: 'done' },
      { text: 'Study the course map' },
      { text: 'Plan the pacing strategy' },
      { text: 'Arrange travel and lodging' },
      { text: 'Practise the fuelling schedule', status: 'doing' },
      { text: 'Plan start-line logistics' },
      { text: 'Tell friends where to cheer' },
      { text: 'Write a post-race reward list', reward: 'Book the celebration dinner' },
    ],
  },
];

/** Build one live Action from a spec, spreading over createAction() so every
 * current/future Action field gets its factory default unless overridden. */
function buildAction(spec: ActionSpec, ts: string): Action {
  const status: StoredStatus = spec.status ?? 'todo';
  return {
    ...createAction(),
    text: spec.text,
    status,
    // Mirror operations.ts's withStatus contract: completedAt is set only
    // when the stored status is 'done'.
    completedAt: status === 'done' ? ts : null,
    habit: spec.habit ?? false,
    weeklyTarget: spec.weeklyTarget ?? 0,
    cue: spec.cue ?? '',
    reward: spec.reward ?? '',
  };
}

/** Replace the completions of the (unique, by text) action matching `text`. */
function withCompletions(chart: Chart, text: string, completions: string[]): Chart {
  return {
    ...chart,
    pillars: chart.pillars.map((pillar) => ({
      ...pillar,
      actions: pillar.actions.map((action) =>
        action.text === text ? { ...action, completions } : action,
      ),
    })),
  };
}

/** Noon on `today` minus `daysAgo` local days, as an ISO string (noon avoids
 * DST-transition edge cases when stepping back local calendar days). */
function noonDaysAgo(today: Date, daysAgo: number): string {
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - daysAgo,
    12,
    0,
    0,
  ).toISOString();
}

/**
 * Build the seeded example chart (v1.6, SPEC 13): "Finish my first marathon",
 * 8 pillars x 8 actions, with a light spread of habits/cues/rewards/statuses
 * and a few LIVE completions (seeded relative to `today`, so the demo never
 * looks stale). `now`/`today` are injectable for deterministic tests.
 */
export function buildExampleChart(
  now: () => string = () => new Date().toISOString(),
  today: Date = new Date(),
): Chart {
  const ts = now();
  const base = createChart({
    goal: 'Finish my first marathon',
    themeId: 'stadium',
    templateId: EXAMPLE_TEMPLATE_ID,
    pillarNames: PILLARS.map((p) => p.name),
    now: () => ts,
  });

  let chart: Chart = {
    ...base,
    id: EXAMPLE_CHART_ID,
    pillars: base.pillars.map((pillar, pillarIndex) => ({
      ...pillar,
      actions: pillar.actions.map((_action, actionIndex) =>
        buildAction(PILLARS[pillarIndex].actions[actionIndex], ts),
      ),
    })),
  };

  // Seed light, live completions so the example never looks stale (SPEC 13):
  // a 3-day streak for the two daily habits, and a single today-only
  // check-off for the two weekly habits (satisfying the 1x/week target while
  // leaving the 3x/week one visibly "in progress").
  const dailyStreak = [0, 1, 2].map((daysAgo) => noonDaysAgo(today, daysAgo));
  const todayOnly = [noonDaysAgo(today, 0)];
  chart = withCompletions(chart, 'Stretch every morning', dailyStreak);
  chart = withCompletions(chart, 'Warm up before every run', dailyStreak);
  chart = withCompletions(chart, 'Long run once a week', todayOnly);
  chart = withCompletions(chart, 'Three easy runs a week', todayOnly);

  return chart;
}
