import { useCallback } from 'react';
import { downloadBlob, chartFileStem } from '../export/download';
import { downloadChartPng } from '../export/renderChartPng';
import { serializeChartExport } from '../model/exportImport';
import type { GridCell } from '../model/grid';
import {
  cycleActionStatus,
  renamePillar,
  setActionText,
  setGoal,
  setTheme,
} from '../model/operations';
import type { Chart, ThemeId } from '../model/types';
import { useIsCompact, usePrintMode } from '../hooks/useMediaQuery';
import { useStore } from '../state/store';
import { BlockView } from './BlockView';
import { Grid } from './Grid';
import { ProgressStrip } from './ProgressStrip';
import { ThemeSwitcher } from './ThemeSwitcher';

export function ChartScreen({ chart }: { chart: Chart }) {
  const { mutateActive, closeChart } = useStore();
  const compact = useIsCompact();
  const printing = usePrintMode();

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

  const onThemeChange = useCallback(
    (themeId: ThemeId) => {
      mutateActive((c) => setTheme(c, themeId));
    },
    [mutateActive],
  );

  const onExportJson = useCallback(() => {
    const json = serializeChartExport(chart);
    downloadBlob(
      new Blob([json], { type: 'application/json' }),
      `${chartFileStem(chart.goal)}.json`,
    );
  }, [chart]);

  const onExportPng = useCallback(() => {
    downloadChartPng(chart);
  }, [chart]);

  const onPrint = useCallback(() => {
    window.print();
  }, []);

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

        <div className="chart-header__tools">
          <ThemeSwitcher value={chart.themeId} onChange={onThemeChange} />
          <div className="chart-header__actions">
            <button type="button" className="btn btn--ghost" onClick={onExportJson}>
              Export JSON
            </button>
            <button type="button" className="btn btn--ghost" onClick={onExportPng}>
              Export PNG
            </button>
            <button type="button" className="btn btn--ghost" onClick={onPrint}>
              Print
            </button>
          </div>
        </div>

        <ProgressStrip chart={chart} />
        <p className="chart-header__hint">
          8 pillars, exactly — if you have 9, merge two. Actions should be measurable behaviours.
        </p>
      </header>

      <main className="chart-main">
        {printing ? (
          // The print stylesheet always renders the full 9x9 grid on one page,
          // regardless of the on-screen (possibly block-view) viewport.
          <Grid chart={chart} onCommitText={onCommitText} onCycleStatus={onCycleStatus} />
        ) : compact ? (
          <BlockView chart={chart} onCommitText={onCommitText} onCycleStatus={onCycleStatus} />
        ) : (
          <Grid chart={chart} onCommitText={onCommitText} onCycleStatus={onCycleStatus} />
        )}
      </main>
    </div>
  );
}
