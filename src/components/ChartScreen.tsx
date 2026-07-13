import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob, chartFileStem } from '../export/download';
import { downloadChartPng } from '../export/renderChartPng';
import { serializeChartExport } from '../model/exportImport';
import type { GridCell } from '../model/grid';
import {
  nextStatus,
  renamePillar,
  setActionCadence,
  setActionDetails,
  setActionEstablished,
  setActionHabit,
  setActionStatus,
  setActionText,
  setGoal,
  setTheme,
  toggleHabitToday,
} from '../model/operations';
import { isHabitCheckedToday } from '../model/completions';
import { EXAMPLE_BANNER_HIDDEN_KEY, getFlag, setFlag } from '../model/onboarding';
import { chartProgress } from '../model/progress';
import type { Chart, StoredStatus, ThemeId } from '../model/types';
import { useIsCompact, usePrintMode } from '../hooks/useMediaQuery';
import { useStore } from '../state/store';
import { EXAMPLE_TEMPLATE_ID } from '../templates/example';
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

export function ChartScreen({
  chart,
  onOpenToday,
}: {
  chart: Chart;
  /** Open the cross-chart Today view (v1.4, SPEC 11.2), reachable from the header. */
  onOpenToday: () => void;
}) {
  const { mutateActive, closeChart, adoptExample } = useStore();
  const compact = useIsCompact();
  const printing = usePrintMode();

  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [toast, setToast] = useState<RewardToastData | null>(null);
  // "This is an example" banner (v1.6, SPEC 13): dismissed for good via a
  // localStorage flag, so re-opening the chart never brings it back.
  const [bannerHidden, setBannerHidden] = useState(() => getFlag(EXAMPLE_BANNER_HIDDEN_KEY));
  const isExample = chart.templateId === EXAMPLE_TEMPLATE_ID;

  // Export ▾ menu (v1.7): collapses Export JSON / Export PNG / Print into one
  // ghost button + popover so the header doesn't wrap to a second row on
  // mobile. Closes on outside-click, Escape, or after choosing an item.
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exportMenuOpen]);

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
        setToast({ id: Date.now(), kind: 'reward', message: action.reward.trim() });
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

  // Check off / undo a habit for today. The reward toast fires on each daily
  // CHECK (not on undo) — that is the reinforcement loop (SPEC 8.1).
  const onToggleHabitToday = useCallback(
    (cell: GridCell) => {
      if (cell.pillarIndex === null || cell.actionIndex === null) return;
      const action = chart.pillars[cell.pillarIndex].actions[cell.actionIndex];
      const willCheck = !isHabitCheckedToday(action);
      if (willCheck && action.reward.trim() !== '') {
        setToast({ id: Date.now(), kind: 'reward', message: action.reward.trim() });
      }
      mutateActive((c) => toggleHabitToday(c, cell.pillarIndex!, cell.actionIndex!));
    },
    [chart, mutateActive],
  );

  // Turn a habit on/off from the detail dialog.
  const onSetHabit = useCallback(
    (pillarIndex: number, actionIndex: number, habit: boolean) => {
      mutateActive((c) => setActionHabit(c, pillarIndex, actionIndex, habit));
    },
    [mutateActive],
  );

  // Set a habit's weekly cadence from the detail dialog (v1.5, SPEC 12).
  const onSetCadence = useCallback(
    (pillarIndex: number, actionIndex: number, weeklyTarget: number) => {
      mutateActive((c) => setActionCadence(c, pillarIndex, actionIndex, weeklyTarget));
    },
    [mutateActive],
  );

  // Establish / un-establish a habit. First-time establish is the graduation
  // moment — celebrate it with a toast (SPEC 8.2).
  const onSetEstablished = useCallback(
    (pillarIndex: number, actionIndex: number, established: boolean) => {
      const action = chart.pillars[pillarIndex]?.actions[actionIndex];
      if (established && action && !action.established) {
        setToast({ id: Date.now(), kind: 'establish', message: action.text.trim() || 'Habit' });
      }
      mutateActive((c) => setActionEstablished(c, pillarIndex, actionIndex, established));
    },
    [chart, mutateActive],
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

  // The header shows the chart's goal as wayfinding instead of the static
  // app brand (v1.7).
  const chartTitle = chart.goal.trim() || 'Untitled chart';
  // Coaching hint auto-hides once the chart is established (v1.7) — it's a
  // build-time nudge, not permanent chrome.
  const showHint = chartProgress(chart).filled < 8;

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
          <span className="chart-header__title" title={chartTitle}>
            {chartTitle}
          </span>
          <span className="chart-header__spacer" />
        </div>

        <div className="chart-header__tools">
          <ThemeSwitcher value={chart.themeId} onChange={onThemeChange} />
          <div className="chart-header__actions">
            <button type="button" className="btn btn--primary" onClick={onOpenToday}>
              Today
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setProgressOpen(true)}>
              Progress
            </button>
            <div className="chart-header__menu" ref={exportMenuRef}>
              <button
                type="button"
                className="btn btn--ghost"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                Export <span aria-hidden="true">▾</span>
              </button>
              {exportMenuOpen && (
                <div className="chart-header__menu-popover" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="chart-header__menu-item"
                    onClick={() => {
                      onExportJson();
                      setExportMenuOpen(false);
                    }}
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="chart-header__menu-item"
                    onClick={() => {
                      onExportPng();
                      setExportMenuOpen(false);
                    }}
                  >
                    Export PNG
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="chart-header__menu-item"
                    onClick={() => {
                      onPrint();
                      setExportMenuOpen(false);
                    }}
                  >
                    Print
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <ProgressStrip chart={chart} />
        {showHint && (
          <p className="chart-header__hint">
            8 pillars, exactly — if you have 9, merge two. Actions should be measurable behaviours.
          </p>
        )}
      </header>

      {isExample && !bannerHidden && (
        <div className="example-banner" role="note">
          <span className="example-banner__text">
            This is an example chart — duplicate it to make it your own.
          </span>
          <div className="example-banner__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => adoptExample(chart.id)}
            >
              Duplicate &amp; edit
            </button>
            <button
              type="button"
              className="btn btn--ghost example-banner__dismiss"
              onClick={() => {
                setFlag(EXAMPLE_BANNER_HIDDEN_KEY);
                setBannerHidden(true);
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="chart-main">
        {printing ? (
          // The print stylesheet always renders the full 9x9 grid on one page,
          // regardless of the on-screen (possibly block-view) viewport.
          <Grid
            chart={chart}
            onCommitText={onCommitText}
            onCycleStatus={onCycleStatus}
            onToggleHabitToday={onToggleHabitToday}
            onExpand={onExpand}
          />
        ) : compact ? (
          <BlockView
            chart={chart}
            onCommitText={onCommitText}
            onCycleStatus={onCycleStatus}
            onToggleHabitToday={onToggleHabitToday}
            onExpand={onExpand}
          />
        ) : (
          <Grid
            chart={chart}
            onCommitText={onCommitText}
            onCycleStatus={onCycleStatus}
            onToggleHabitToday={onToggleHabitToday}
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
        onSetHabit={(habit) => {
          if (detail) onSetHabit(detail.pillarIndex, detail.actionIndex, habit);
        }}
        onSetCadence={(weeklyTarget) => {
          if (detail) onSetCadence(detail.pillarIndex, detail.actionIndex, weeklyTarget);
        }}
        onSetEstablished={(established) => {
          if (detail) onSetEstablished(detail.pillarIndex, detail.actionIndex, established);
        }}
        onClose={() => setDetail(null)}
      />

      <ProgressDialog open={progressOpen} chart={chart} onClose={() => setProgressOpen(false)} />

      <RewardToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
