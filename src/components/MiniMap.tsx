import { CENTER_BLOCK, orderToPillarIndex } from '../model/grid';
import { pillarProgress } from '../model/progress';
import type { Chart } from '../model/types';

interface MiniMapProps {
  chart: Chart;
  position: number; // currently-shown block position 0..8
  onNavigate: (position: number) => void;
}

/** 3x3 mini-map for navigating between blocks in mobile block view. */
export function MiniMap({ chart, position, onNavigate }: MiniMapProps) {
  return (
    <nav className="minimap" aria-label="Block navigation">
      {Array.from({ length: 9 }, (_, p) => {
        const isCenter = p === CENTER_BLOCK;
        const pillarIndex = isCenter ? null : orderToPillarIndex(p);
        const isCurrent = p === position;
        const prog = pillarIndex !== null ? pillarProgress(chart.pillars[pillarIndex]) : null;
        const ratio = prog && prog.filled > 0 ? prog.done / prog.filled : 0;
        const label = isCenter
          ? 'Center hub'
          : `Pillar ${pillarIndex! + 1}${
              chart.pillars[pillarIndex!].name.trim()
                ? `: ${chart.pillars[pillarIndex!].name}`
                : ''
            }`;
        return (
          <button
            key={p}
            type="button"
            className={`minimap__cell ${isCenter ? 'minimap__cell--center' : ''} ${
              isCurrent ? 'is-current' : ''
            }`}
            style={
              pillarIndex !== null
                ? ({
                    ['--cell-accent' as string]: chart.pillars[pillarIndex].color,
                  } as React.CSSProperties)
                : undefined
            }
            aria-label={label}
            aria-current={isCurrent ? 'true' : undefined}
            onClick={() => onNavigate(p)}
          >
            {isCenter ? (
              <span className="minimap__dot" aria-hidden="true">
                ◆
              </span>
            ) : (
              <span
                className="minimap__fill"
                style={{ transform: `scaleY(${ratio})` }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
