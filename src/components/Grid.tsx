import { useCallback, useRef, useState } from 'react';
import { buildBlocks, GRID_SIZE, type GridCell } from '../model/grid';
import { pillarProgress, type Progress } from '../model/progress';
import type { Chart } from '../model/types';
import { Cell } from './Cell';

interface GridProps {
  chart: Chart;
  onCommitText: (cell: GridCell, text: string) => void;
  onCycleStatus: (cell: GridCell) => void;
  onExpand: (cell: GridCell) => void;
}

/** Full 9x9 desktop grid with roving-tabindex arrow-key navigation. */
export function Grid({ chart, onCommitText, onCycleStatus, onExpand }: GridProps) {
  const blocks = buildBlocks(chart);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [focused, setFocused] = useState<{ row: number; col: number }>({ row: 4, col: 4 });

  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const registerRef = useCallback((row: number, col: number, el: HTMLDivElement | null) => {
    const key = `${row},${col}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    const el = cellRefs.current.get(`${row},${col}`);
    if (el) el.focus();
  }, []);

  const onFocusCell = useCallback((row: number, col: number) => {
    setFocused({ row, col });
  }, []);

  const pillarProgresses: Progress[] = chart.pillars.map(pillarProgress);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLTextAreaElement) return; // editing — let text handle keys
    let { row, col } = focused;
    switch (e.key) {
      case 'ArrowRight':
        col = Math.min(GRID_SIZE - 1, col + 1);
        break;
      case 'ArrowLeft':
        col = Math.max(0, col - 1);
        break;
      case 'ArrowDown':
        row = Math.min(GRID_SIZE - 1, row + 1);
        break;
      case 'ArrowUp':
        row = Math.max(0, row - 1);
        break;
      case 'Home':
        col = 0;
        break;
      case 'End':
        col = GRID_SIZE - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setFocused({ row, col });
    focusCell(row, col);
  };

  return (
    <div
      className="grid"
      role="grid"
      aria-label="Mandala chart, 9 by 9 grid"
      onKeyDown={onKeyDown}
    >
      {blocks.map((block) => {
        const blockRow = Math.floor(block.position / 3);
        const blockCol = block.position % 3;
        const blockHighlighted = block.pillarIndex !== null && block.pillarIndex === highlight;
        const blockClass = [
          'block',
          block.isCenter ? 'block--center' : 'block--pillar',
          blockHighlighted ? 'is-highlighted' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const blockStyle =
          block.color !== null
            ? ({ ['--cell-accent' as string]: block.color } as React.CSSProperties)
            : undefined;
        return (
          <div key={block.position} className={blockClass} style={blockStyle} role="presentation">
            {block.cells.map((cell, offset) => {
              const row = blockRow * 3 + Math.floor(offset / 3);
              const col = blockCol * 3 + (offset % 3);
              const isActive = focused.row === row && focused.col === col;
              const progress =
                cell.kind === 'pillar' && cell.pillarIndex !== null
                  ? pillarProgresses[cell.pillarIndex]
                  : undefined;
              return (
                <Cell
                  key={cell.key}
                  cell={cell}
                  row={row}
                  col={col}
                  tabIndex={isActive ? 0 : -1}
                  registerRef={registerRef}
                  onCommitText={onCommitText}
                  onCycleStatus={onCycleStatus}
                  onExpand={onExpand}
                  onHighlightPillar={setHighlight}
                  onFocusCell={onFocusCell}
                  progress={progress}
                  highlighted={cell.pillarIndex !== null && cell.pillarIndex === highlight}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
