import { describe, expect, it } from 'vitest';
import { createChart } from './factory';
import { renamePillar, setActionText } from './operations';
import {
  BLOCK_ORDER,
  buildBlocks,
  buildGridCells,
  CENTER_BLOCK,
  CENTER_OFFSET,
  orderToPillarIndex,
  pillarToBlockPosition,
} from './grid';

describe('grid mapping', () => {
  it('maps pillars to the 8 non-center block positions', () => {
    expect([...BLOCK_ORDER]).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(pillarToBlockPosition(0)).toBe(0);
    expect(pillarToBlockPosition(3)).toBe(3);
    expect(pillarToBlockPosition(4)).toBe(5); // skips the center block
    expect(orderToPillarIndex(5)).toBe(4);
  });

  it('places the goal at the center of the center block', () => {
    const chart = createChart({ goal: 'GOAL' });
    const blocks = buildBlocks(chart);
    const center = blocks[CENTER_BLOCK];
    expect(center.isCenter).toBe(true);
    const goalCell = center.cells[CENTER_OFFSET];
    expect(goalCell.kind).toBe('goal');
    expect(goalCell.text).toBe('GOAL');
  });

  it('mirrors a pillar name between the hub and its outer block center', () => {
    let chart = createChart();
    chart = renamePillar(chart, 4, 'Recovery');
    const blocks = buildBlocks(chart);

    // Hub mirror: inside center block at the pillar's block-order offset.
    const hubOffset = pillarToBlockPosition(4); // 5
    const hubCell = blocks[CENTER_BLOCK].cells[hubOffset];
    expect(hubCell.kind).toBe('pillar');
    expect(hubCell.isHub).toBe(true);
    expect(hubCell.pillarIndex).toBe(4);
    expect(hubCell.text).toBe('Recovery');

    // Outer block center for the same pillar.
    const outer = blocks[pillarToBlockPosition(4)];
    const outerCenter = outer.cells[CENTER_OFFSET];
    expect(outerCenter.kind).toBe('pillar');
    expect(outerCenter.isHub).toBe(false);
    expect(outerCenter.pillarIndex).toBe(4);
    expect(outerCenter.text).toBe('Recovery');
  });

  it('places a pillar actions around its outer block center', () => {
    let chart = createChart();
    chart = setActionText(chart, 0, 0, 'Action-0');
    chart = setActionText(chart, 0, 7, 'Action-7');
    const blocks = buildBlocks(chart);
    const block = blocks[pillarToBlockPosition(0)]; // block position 0

    const a0 = block.cells[BLOCK_ORDER[0]];
    expect(a0.kind).toBe('action');
    expect(a0.pillarIndex).toBe(0);
    expect(a0.actionIndex).toBe(0);
    expect(a0.text).toBe('Action-0');

    const a7 = block.cells[BLOCK_ORDER[7]];
    expect(a7.actionIndex).toBe(7);
    expect(a7.text).toBe('Action-7');
  });

  it('builds a full 81-cell row-major grid', () => {
    const chart = createChart({ goal: 'G' });
    const cells = buildGridCells(chart);
    expect(cells).toHaveLength(81);
    // Global center of the 9x9 (row 4, col 4) is the goal.
    expect(cells[4 * 9 + 4].kind).toBe('goal');
    // Every cell is defined.
    expect(cells.every((c) => c !== undefined)).toBe(true);
    // Exactly 64 action cells, 16 pillar cells (8 hub + 8 outer), 1 goal.
    const counts = { goal: 0, pillar: 0, action: 0 };
    for (const c of cells) counts[c.kind]++;
    expect(counts).toEqual({ goal: 1, pillar: 16, action: 64 });
  });
});
