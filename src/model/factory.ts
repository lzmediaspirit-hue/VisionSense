// Pure factories that enforce the "Rule of 8" structurally: every chart is
// created with exactly 8 pillars, each holding exactly 8 actions. There is no
// add/remove API anywhere in the model — see operations.ts for the only allowed
// mutations (rename / setText / setStatus / swap).

import { newId } from './id';
import { RULE_OF_8, type Action, type Chart, type Pillar, type ThemeId } from './types';

/**
 * The default per-pillar color for slot `index`. Stored as a CSS custom-property
 * reference so that switching themes re-resolves the actual color while the
 * stored value stays stable and theme-agnostic.
 */
export function defaultPillarColor(index: number): string {
  return `var(--pillar-color-${index % RULE_OF_8})`;
}

export function createAction(): Action {
  return {
    id: newId(),
    text: '',
    status: 'todo',
    description: '',
    reward: '',
    completedAt: null,
    habit: false,
    established: false,
    completions: [],
    cue: '',
    weeklyTarget: 0,
  };
}

/** Build a fixed-length-8 array of empty actions. */
function createActions(): Action[] {
  const actions: Action[] = [];
  for (let i = 0; i < RULE_OF_8; i++) actions.push(createAction());
  return actions;
}

export function createPillar(index: number, name = ''): Pillar {
  return {
    id: newId(),
    name,
    color: defaultPillarColor(index),
    actions: createActions(),
  };
}

/** Build a fixed-length-8 array of empty pillars. */
function createPillars(names?: readonly string[]): Pillar[] {
  const pillars: Pillar[] = [];
  for (let i = 0; i < RULE_OF_8; i++) {
    pillars.push(createPillar(i, names?.[i] ?? ''));
  }
  return pillars;
}

export interface CreateChartOptions {
  goal?: string;
  themeId?: ThemeId;
  templateId?: string | null;
  /** Optional 8 pillar names (extra entries ignored, missing ones left empty). */
  pillarNames?: readonly string[];
  /** Injectable clock for deterministic tests. */
  now?: () => string;
}

export function createChart(options: CreateChartOptions = {}): Chart {
  const now = options.now ?? (() => new Date().toISOString());
  const ts = now();
  return {
    id: newId(),
    goal: options.goal ?? '',
    themeId: options.themeId ?? 'minimal',
    templateId: options.templateId ?? null,
    pillars: createPillars(options.pillarNames),
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * Duplicate a chart: a fresh id/timestamps and fresh ids for every pillar and
 * action (so the copy never shares identity with the original), but otherwise
 * identical content (goal, names, actions, statuses, theme).
 */
export function duplicateChart(chart: Chart, now: () => string = () => new Date().toISOString()): Chart {
  const ts = now();
  return {
    ...chart,
    id: newId(),
    pillars: chart.pillars.map((pillar) => ({
      ...pillar,
      id: newId(),
      actions: pillar.actions.map((action) => ({ ...action, id: newId() })),
    })),
    createdAt: ts,
    updatedAt: ts,
  };
}

export function createInitialState(): {
  schemaVersion: 1;
  charts: Chart[];
  activeChartId: string | null;
  days: Record<string, never>;
  reviews: Record<string, never>;
} {
  return { schemaVersion: 1, charts: [], activeChartId: null, days: {}, reviews: {} };
}
