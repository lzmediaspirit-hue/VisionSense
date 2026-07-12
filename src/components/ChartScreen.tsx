import { useCallback } from 'react';
import type { GridCell } from '../model/grid';
import {
  cycleActionStatus,
  renamePillar,
  setActionText,
  setGoal,
} from '../model/operations';
import type { Chart } from '../model/types';
import { useIsCompact } from '../hooks/useMediaQuery';
import { useStore } from '../state/store';
import { BlockView } from './BlockView';
import { Grid } from './Grid';
import { ProgressStrip } from './ProgressStrip';

export function ChartScreen({ chart }: { chart: Chart }) {
  const { mutateActive, closeChart } = useStore();
  const compact = useIsCompact();

  const onCommitText = useCallback(
    (cell: GridCell, text: string) => {
      mutateActive((c) => {
        if (cell.kind === 'goal') return setGoal(c, text);
        if (cell.kind === 'pillar' && cell.pillarIndex !== null) {
          return renamePillar(c, cell.pillarIndex, text);
        }
        if (cell.kind === 'action' && cell.pillarIndex !== null && cell.actionIndex !== null) {
          return setActionText(c, cell.pillarIndex, cell.actionIndex, text);
        }
        return c;
      });
    },
    [mutateActive],
  );

  const onCycleStatus = useCallback(
    (cell: GridCell) => {
      if (cell.pillarIndex === null || cell.actionIndex === null) return;
      const { pillarIndex, actionIndex } = cell;
      mutateActive((c) => cycleActionStatus(c, pillarIndex, actionIndex));
    },
    [mutateActive],
  );

  return (
    <div className="chart-screen" data-theme={chart.themeId}>
      <header className="chart-header">
        <div className="chart-header__row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={closeChart}
            aria-label="Back to your charts"
          >
            <span aria-hidden="true">‹</span> Charts
          </button>
          <span className="chart-header__brand">VisionSense</span>
          <span className="chart-header__spacer" />
        </div>
        <ProgressStrip chart={chart} />
        <p className="chart-header__hint">
          8 pillars, exactly — if you have 9, merge two. Actions should be measurable behaviours.
        </p>
      </header>

      <main className="chart-main">
        {compact ? (
          <BlockView chart={chart} onCommitText={onCommitText} onCycleStatus={onCycleStatus} />
        ) : (
          <Grid chart={chart} onCommitText={onCommitText} onCycleStatus={onCycleStatus} />
        )}
      </main>
    </div>
  );
}
