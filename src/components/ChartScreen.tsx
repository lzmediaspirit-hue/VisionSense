import { useCallback, useState } from 'react';
import { downloadBlob, chartFileStem } from '../export/download';
import { downloadChartPng } from '../export/renderChartPng';
import { serializeChartExport } from '../model/exportImport';
import type { GridCell } from '../model/grid';
import {
  nextStatus,
  renamePillar,
  setActionDetails,
  setActionStatus,
  setActionText,
  setGoal,
  setTheme,
} from '../model/operations';
import type { Chart, StoredStatus, ThemeId } from '../model/types';
import { useIsCompact, usePrintMode } from '../hooks/useMediaQuery';
import { useStore } from '../state/store';
import { ActionDetailDialog } from './ActionDetailDialog';
import { BlockView } from './BlockView';
import { Grid } from './Grid';
import { ProgressDialog } from './ProgressDialog';
import { ProgressStrip } from './ProgressStrip';
import { RewardToast, type RewardToastData } from './RewardToast';
import { ThemeSwitcher } from './ThemeSwitcher';

interface DetailTarget {
  pillarIndex: number;
  actionIndex: number;
}

export function ChartScreen({ chart }: { chart: Chart }) {
  const { mutateActive, closeChart } = useStore();
  const compact = useIsCompact();
  const printing = usePrintMode();

  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [toast, setToast] = useState<RewardToastData | null>(null);

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

  // Apply a status change to an action, firing the reward toast when the action
  // transitions INTO 'done' and carries a non-empty reward (SPEC 7.3).
  const applyStatus = useCallback(
    (pillarIndex: number, actionIndex: number, target: StoredStatus) => {
      const action = chart.pillars[pillarIndex]?.actions[actionIndex];
      if (action && target === 'done' && action.status !== 'done' && action.reward.trim() !== '') {
        setToast({ id: Date.now(), reward: action.reward.trim() });
      }
      mutateActive((c) => setActionStatus(c, pillarIndex, actionIndex, target));
    },
    [chart, mutateActive],
  );

  const onCycleStatus = useCallback(
    (cell: GridCell) => {
      if (cell.pillarIndex === null || cell.actionIndex === null) return;
      const action = chart.pillars[cell.pillarIndex].actions[cell.actionIndex];
      applyStatus(cell.pillarIndex, cell.actionIndex, nextStatus(action.status));
    },
    [chart, applyStatus],
  );

  const onExpand = useCallback((cell: GridCell) => {
    if (cell.pillarIndex === null || cell.actionIndex === null) return;
    setDetail({ pillarIndex: cell.pillarIndex, actionIndex: cell.actionIndex });
  }, []);

  // Live action behind the open detail dialog (null when closed), so the dialog
  // reflects mutations (status, completedAt) as they happen.
  const detailAction = detail
    ? (chart.pillars[detail.pillarIndex]?.actions[detail.actionIndex] ?? null)
    : null;

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
            <button type="button" className="btn btn--ghost" onClick={() => setProgressOpen(true)}>
              Progress
            </button>
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
          <Grid
            chart={chart}
            onCommitText={onCommitText}
            onCycleStatus={onCycleStatus}
            onExpand={onExpand}
          />
        ) : compact ? (
          <BlockView
            chart={chart}
            onCommitText={onCommitText}
            onCycleStatus={onCycleStatus}
            onExpand={onExpand}
          />
        ) : (
          <Grid
            chart={chart}
            onCommitText={onCommitText}
            onCycleStatus={onCycleStatus}
            onExpand={onExpand}
          />
        )}
      </main>

      <ActionDetailDialog
        action={detailAction}
        pillarIndex={detail?.pillarIndex ?? null}
        actionIndex={detail?.actionIndex ?? null}
        onCommitText={(text) => {
          if (detail) mutateActive((c) => setActionText(c, detail.pillarIndex, detail.actionIndex, text));
        }}
        onCommitDetails={(details) => {
          if (detail) mutateActive((c) => setActionDetails(c, detail.pillarIndex, detail.actionIndex, details));
        }}
        onSetStatus={(status) => {
          if (detail) applyStatus(detail.pillarIndex, detail.actionIndex, status);
        }}
        onClose={() => setDetail(null)}
      />

      <ProgressDialog open={progressOpen} chart={chart} onClose={() => setProgressOpen(false)} />

      <RewardToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
