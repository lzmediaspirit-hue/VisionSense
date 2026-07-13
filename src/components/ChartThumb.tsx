// Dashboard chart-card thumbnail (design review #9): a live 3x3 mini-mandala
// of the chart's actual progress, replacing the flat theme-swatch dot. Maps
// grid order (center = goal, the 8 others = pillars) the same way MiniMap
// does, via ../model/grid's block-position <-> pillar-index helpers.

import { CENTER_BLOCK, orderToPillarIndex } from '../model/grid';
import { pillarProgress } from '../model/progress';
import type { Chart } from '../model/types';

interface ChartThumbProps {
  chart: Chart;
}

export function ChartThumb({ chart }: ChartThumbProps) {
  return (
    <span className="chart-thumb" data-theme={chart.themeId} aria-hidden="true">
      {Array.from({ length: 9 }, (_, p) => {
        if (p === CENTER_BLOCK) {
          return <span key={p} className="chart-thumb__tile chart-thumb__tile--center" />;
        }
        const pillarIndex = orderToPillarIndex(p);
        const pillar = chart.pillars[pillarIndex];
        const { filled, done } = pillarProgress(pillar);
        const ratio = filled > 0 ? done / filled : 0;
        return (
          <span
            key={p}
            className={`chart-thumb__tile ${filled === 0 ? 'is-empty' : ''}`}
            style={{ ['--tile-accent' as string]: pillar.color } as React.CSSProperties}
          >
            <span className="chart-thumb__fill" style={{ height: `${ratio * 100}%` }} />
          </span>
        );
      })}
    </span>
  );
}
