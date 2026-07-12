// The 9x9 Mandala grid mapping (SPEC 4.1). Pure geometry — no React.
//
// The grid is a 3x3 arrangement of 3x3 blocks. Positions within any 3x3 are
// numbered 0..8 in reading order; position 4 is the center.
//
//   Block positions (0..8), block 4 is the center block holding the goal:
//     0 1 2
//     3 4 5
//     6 7 8
//
// Pillar i (0..7) lives at block position BLOCK_ORDER[i]. Its NAME appears twice:
//   - as the center cell (offset 4) of that outer block, and
//   - as its "mirror" cell inside the center block, at the SAME offset
//     BLOCK_ORDER[i].
// Both are the same datum (single source of truth): editing either renames the
// pillar. The 8 non-center cells of the outer block are that pillar's actions,
// action j at offset BLOCK_ORDER[j].

import type { Chart, StoredStatus } from './types';

/** The 8 non-center positions/offsets in reading order (center = 4 omitted). */
export const BLOCK_ORDER: readonly number[] = [0, 1, 2, 3, 5, 6, 7, 8];

export const CENTER_BLOCK = 4;
export const CENTER_OFFSET = 4;
export const GRID_SIZE = 9;

/** Block position (0..8) for pillar i (0..7). */
export function pillarToBlockPosition(pillarIndex: number): number {
  return BLOCK_ORDER[pillarIndex];
}

/** Pillar index (0..7) for a non-center block-order value, or -1 otherwise. */
export function orderToPillarIndex(orderValue: number): number {
  return BLOCK_ORDER.indexOf(orderValue);
}

export type CellKind = 'goal' | 'pillar' | 'action';

export interface GridCell {
  /** Stable-ish key for React. */
  key: string;
  kind: CellKind;
  /** null only for the goal cell. */
  pillarIndex: number | null;
  /** Set only for action cells. */
  actionIndex: number | null;
  /** true for the pillar's mirror inside the center block (hub). */
  isHub: boolean;
  offset: number; // 0..8 within its block
  text: string;
  /** Present for action cells. */
  status: StoredStatus | null;
  /** Pillar color token (for pillar + action cells). */
  color: string | null;
  /** Action detail fields (v1.1); null for non-action cells. */
  description: string | null;
  reward: string | null;
  completedAt: string | null;
  /** Habit fields (v1.2). For non-action cells: false / false / []. */
  habit: boolean;
  established: boolean;
  completions: string[];
}

export interface GridBlock {
  position: number; // 0..8
  isCenter: boolean;
  /** null for the center block; else the pillar this block belongs to. */
  pillarIndex: number | null;
  color: string | null;
  cells: GridCell[]; // length 9, reading order
}

function centerBlockCell(chart: Chart, offset: number): GridCell {
  if (offset === CENTER_OFFSET) {
    return {
      key: 'goal',
      kind: 'goal',
      pillarIndex: null,
      actionIndex: null,
      isHub: false,
      offset,
      text: chart.goal,
      status: null,
      color: null,
      description: null,
      reward: null,
      completedAt: null,
      habit: false,
      established: false,
      completions: [],
    };
  }
  const pillarIndex = orderToPillarIndex(offset);
  const pillar = chart.pillars[pillarIndex];
  return {
    key: `hub-pillar-${pillarIndex}`,
    kind: 'pillar',
    pillarIndex,
    actionIndex: null,
    isHub: true,
    offset,
    text: pillar.name,
    status: null,
    color: pillar.color,
    description: null,
    reward: null,
    completedAt: null,
    habit: false,
    established: false,
    completions: [],
  };
}

function outerBlockCell(chart: Chart, pillarIndex: number, offset: number): GridCell {
  const pillar = chart.pillars[pillarIndex];
  if (offset === CENTER_OFFSET) {
    return {
      key: `center-pillar-${pillarIndex}`,
      kind: 'pillar',
      pillarIndex,
      actionIndex: null,
      isHub: false,
      offset,
      text: pillar.name,
      status: null,
      color: pillar.color,
      description: null,
      reward: null,
      completedAt: null,
      habit: false,
      established: false,
      completions: [],
    };
  }
  const actionIndex = orderToPillarIndex(offset);
  const action = pillar.actions[actionIndex];
  return {
    key: `action-${pillarIndex}-${actionIndex}`,
    kind: 'action',
    pillarIndex,
    actionIndex,
    isHub: false,
    offset,
    text: action.text,
    status: action.status,
    color: pillar.color,
    description: action.description,
    reward: action.reward,
    completedAt: action.completedAt,
    habit: action.habit,
    established: action.established,
    completions: action.completions,
  };
}

/** Build one block (0..8) with its 9 cells in reading order. */
export function buildBlock(chart: Chart, position: number): GridBlock {
  if (position === CENTER_BLOCK) {
    const cells: GridCell[] = [];
    for (let offset = 0; offset < 9; offset++) cells.push(centerBlockCell(chart, offset));
    return { position, isCenter: true, pillarIndex: null, color: null, cells };
  }
  const pillarIndex = orderToPillarIndex(position);
  const pillar = chart.pillars[pillarIndex];
  const cells: GridCell[] = [];
  for (let offset = 0; offset < 9; offset++) {
    cells.push(outerBlockCell(chart, pillarIndex, offset));
  }
  return { position, isCenter: false, pillarIndex, color: pillar.color, cells };
}

/** Build all 9 blocks in reading order. */
export function buildBlocks(chart: Chart): GridBlock[] {
  const blocks: GridBlock[] = [];
  for (let position = 0; position < 9; position++) blocks.push(buildBlock(chart, position));
  return blocks;
}

/** The full 9x9 grid as 81 cells in row-major (page reading) order. */
export function buildGridCells(chart: Chart): GridCell[] {
  const blocks = buildBlocks(chart);
  const cells: GridCell[] = new Array(81);
  for (const block of blocks) {
    const blockRow = Math.floor(block.position / 3);
    const blockCol = block.position % 3;
    for (let offset = 0; offset < 9; offset++) {
      const row = blockRow * 3 + Math.floor(offset / 3);
      const col = blockCol * 3 + (offset % 3);
      cells[row * GRID_SIZE + col] = block.cells[offset];
    }
  }
  return cells;
}
