import { useRef, useState } from 'react';
import {
  buildBlock,
  CENTER_BLOCK,
  orderToPillarIndex,
  pillarToBlockPosition,
  type GridCell,
} from '../model/grid';
import { pillarProgress } from '../model/progress';
import { RULE_OF_8, type Chart } from '../model/types';
import { Cell } from './Cell';
import { GridOverview } from './GridOverview';
import { MiniMap } from './MiniMap';

interface BlockViewProps {
  chart: Chart;
  onCommitText: (cell: GridCell, text: string) => void;
  onCycleStatus: (cell: GridCell) => void;
  onToggleHabitToday: (cell: GridCell) => void;
  onExpand: (cell: GridCell) => void;
}

const SWIPE_THRESHOLD = 48;

/** Mobile "block view": one 3x3 block at a time, hub-based navigation. */
export function BlockView({
  chart,
  onCommitText,
  onCycleStatus,
  onToggleHabitToday,
  onExpand,
}: BlockViewProps) {
  const [position, setPosition] = useState<number>(CENTER_BLOCK); // start at the hub
  // Ephemeral UI state only — never persisted, doesn't touch the data model.
  const [showOverview, setShowOverview] = useState(false);
  const isHub = position === CENTER_BLOCK;
  const block = buildBlock(chart, position);
  const pillarIndex = isHub ? null : orderToPillarIndex(position);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goToPillar = (index: number) => {
    const wrapped = ((index % RULE_OF_8) + RULE_OF_8) % RULE_OF_8;
    setPosition(pillarToBlockPosition(wrapped));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (isHub || pillarIndex === null) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    goToPillar(pillarIndex + (dx < 0 ? 1 : -1));
  };

  const title = showOverview
    ? 'Full grid overview'
    : isHub
      ? 'Center — goal & pillars'
      : chart.pillars[pillarIndex!].name.trim() || `Pillar ${pillarIndex! + 1}`;

  const onOverviewNavigate = (targetPosition: number) => {
    setPosition(targetPosition);
    setShowOverview(false);
  };

  return (
    <div className={`blockview ${showOverview ? 'blockview--overview' : ''}`.trim()}>
      <div className="blockview__bar">
        {!showOverview && !isHub ? (
          <button
            type="button"
            className="btn btn--ghost blockview__back"
            onClick={() => setPosition(CENTER_BLOCK)}
            aria-label="Back to center"
          >
            <span aria-hidden="true">‹</span> Hub
          </button>
        ) : (
          <span className="blockview__back-placeholder" />
        )}
        <h2 className="blockview__title">{title}</h2>
        <button
          type="button"
          className="btn btn--ghost blockview__overview-toggle"
          onClick={() => setShowOverview((v) => !v)}
          aria-label={showOverview ? 'Return to block view' : 'View all 81 cells in a full grid overview'}
        >
          {showOverview ? 'Block view' : 'Full grid'}
        </button>
      </div>

      {showOverview ? (
        <GridOverview chart={chart} onNavigate={onOverviewNavigate} />
      ) : (
        <>
          <div
            className={`block block--mobile ${isHub ? 'block--center' : 'block--pillar'}`}
            style={
              block.color
                ? ({ ['--cell-accent' as string]: block.color } as React.CSSProperties)
                : undefined
            }
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            role="group"
            aria-label={title}
          >
            {block.cells.map((cell) => {
              // In the hub, the 8 pillar cells act as navigation into their blocks.
              if (isHub && cell.kind === 'pillar' && cell.pillarIndex !== null) {
                const pIndex = cell.pillarIndex;
                const prog = pillarProgress(chart.pillars[pIndex]);
                const ratio = prog.filled > 0 ? prog.done / prog.filled : 0;
                const filled = cell.text.trim() !== '';
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={`cell cell--pillar cell--nav ${filled ? 'is-filled' : 'is-empty'}`}
                    style={
                      { ['--cell-accent' as string]: cell.color ?? '' } as React.CSSProperties
                    }
                    onClick={() => setPosition(pillarToBlockPosition(pIndex))}
                    aria-label={`Open pillar ${pIndex + 1}: ${filled ? cell.text : 'empty'}`}
                  >
                    <span className={filled ? 'cell__text' : 'cell__text cell__placeholder'}>
                      {filled ? cell.text : `Pillar ${pIndex + 1}`}
                    </span>
                    {prog.filled > 0 && (
                      <div className="cell__progress" aria-hidden="true">
                        <div
                          className="cell__progress-fill"
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                    )}
                    <span className="cell__nav-hint" aria-hidden="true">
                      ›
                    </span>
                  </button>
                );
              }
              const progress =
                cell.kind === 'pillar' && cell.pillarIndex !== null
                  ? pillarProgress(chart.pillars[cell.pillarIndex])
                  : undefined;
              return (
                <Cell
                  key={cell.key}
                  cell={cell}
                  onCommitText={onCommitText}
                  onCycleStatus={onCycleStatus}
                  onToggleHabitToday={onToggleHabitToday}
                  onExpand={onExpand}
                  progress={progress}
                />
              );
            })}
          </div>

          <MiniMap chart={chart} position={position} onNavigate={setPosition} />
        </>
      )}
    </div>
  );
}
