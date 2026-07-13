// Today view (v1.4, SPEC 11.2): the daily-discipline screen. Date heading +
// all-charts streak, a "Top 3 for today" MIT picker with one-tap completion, a
// daily-habits list, and an evening reflection. MIT completion is always DERIVED
// from the referenced action; dangling references are dropped on render; picks
// are keyed per LOCAL day so yesterday's picks never leak into today.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isHabitCheckedToday, localDayKey, streakAcrossCharts } from '../model/completions';
import { MAX_MITS } from '../model/journal';
import { setActionStatus, toggleHabitToday } from '../model/operations';
import { findActionById, isActionDone, isActionFilled } from '../model/progress';
import type { Action, Chart, DayPlan } from '../model/types';
import { useStore } from '../state/store';
import { RewardToast, type RewardToastData } from './RewardToast';

interface TodayViewProps {
  onClose: () => void;
}

interface Candidate {
  chartId: string;
  chartTitle: string;
  pillarName: string;
  action: Action;
}

function nowIso(): string {
  return new Date().toISOString();
}

function chartTitleOf(chart: Chart): string {
  return chart.goal.trim() || 'Untitled chart';
}

/** Filled, not-done, not-established actions across all charts (SPEC 11.2 picker). */
function collectCandidates(charts: readonly Chart[]): Candidate[] {
  const out: Candidate[] = [];
  for (const chart of charts) {
    for (const pillar of chart.pillars) {
      for (const action of pillar.actions) {
        if (isActionFilled(action) && !isActionDone(action)) {
          out.push({
            chartId: chart.id,
            chartTitle: chartTitleOf(chart),
            pillarName: pillar.name.trim() || 'Unnamed pillar',
            action,
          });
        }
      }
    }
  }
  return out;
}

export function TodayView({ onClose }: TodayViewProps) {
  const { state, mutateChart, setDayPlan } = useStore();
  const charts = state.charts;
  const [toast, setToast] = useState<RewardToastData | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = new Date();
  const todayKey = localDayKey(today);
  const plan: DayPlan = state.days[todayKey] ?? { mits: [], note: '', updatedAt: '' };

  const dateHeading = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const streak = useMemo(() => streakAcrossCharts(charts, today), [charts, today]);

  const savePlan = useCallback(
    (patch: Partial<DayPlan>) => {
      const current = state.days[todayKey] ?? { mits: [], note: '', updatedAt: '' };
      setDayPlan(todayKey, {
        mits: patch.mits ?? current.mits,
        note: patch.note ?? current.note,
        updatedAt: nowIso(),
      });
    },
    [state.days, todayKey, setDayPlan],
  );

  // One-tap completion, reusing the existing reward-toast behaviour (SPEC 11.2).
  const toggleComplete = useCallback(
    (chartId: string, pillarIndex: number, actionIndex: number, action: Action) => {
      if (action.habit) {
        const willCheck = !isHabitCheckedToday(action);
        if (willCheck && action.reward.trim() !== '') {
          setToast({ id: Date.now(), kind: 'reward', message: action.reward.trim() });
        }
        mutateChart(chartId, (c) => toggleHabitToday(c, pillarIndex, actionIndex));
      } else {
        const isDone = action.status === 'done';
        const target = isDone ? 'todo' : 'done';
        if (target === 'done' && action.reward.trim() !== '') {
          setToast({ id: Date.now(), kind: 'reward', message: action.reward.trim() });
        }
        mutateChart(chartId, (c) => setActionStatus(c, pillarIndex, actionIndex, target));
      }
    },
    [mutateChart],
  );

  // Resolve MIT references to live actions, dropping dangling ones (SPEC 11.2).
  const mitRows = useMemo(() => {
    return plan.mits.flatMap((ref) => {
      const chart = charts.find((c) => c.id === ref.chartId);
      if (!chart) return [];
      const located = findActionById(chart, ref.actionId);
      if (!located) return [];
      return [{ chart, located }];
    });
  }, [plan.mits, charts]);

  // Daily habits: every non-established, filled habit across all charts.
  const habitRows = useMemo(() => {
    const rows: { chart: Chart; pillarIndex: number; actionIndex: number; pillarName: string; action: Action }[] = [];
    for (const chart of charts) {
      chart.pillars.forEach((pillar, pillarIndex) => {
        pillar.actions.forEach((action, actionIndex) => {
          if (action.habit && !action.established && isActionFilled(action)) {
            rows.push({
              chart,
              pillarIndex,
              actionIndex,
              pillarName: pillar.name.trim() || 'Unnamed pillar',
              action,
            });
          }
        });
      });
    }
    return rows;
  }, [charts]);

  // Auto summary: what actually got done today across all charts.
  const doneToday = useMemo(() => {
    const names: string[] = [];
    for (const chart of charts) {
      for (const pillar of chart.pillars) {
        for (const action of pillar.actions) {
          if (!isActionFilled(action)) continue;
          const did = action.habit
            ? isHabitCheckedToday(action, today)
            : action.completedAt !== null &&
              localDayKey(new Date(action.completedAt)) === todayKey;
          if (did) names.push(action.text.trim());
        }
      }
    }
    return names;
  }, [charts, today, todayKey]);

  return (
    <div className="today" data-theme="minimal" aria-label="Today view">
      <header className="today__header">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          aria-label="Back to your charts"
        >
          <span aria-hidden="true">‹</span> Charts
        </button>
        <span className="today__brand">VisionSense</span>
        <span className="today__spacer" />
      </header>

      <div className="today__hero">
        <div>
          <p className="today__eyebrow">Today</p>
          <h1 className="today__date">{dateHeading}</h1>
        </div>
        <div className="today__streak" aria-label={`${streak} day streak across all charts`}>
          <span className="today__streak-num">{streak}</span>
          <span className="today__streak-unit">day{streak === 1 ? '' : 's'} streak</span>
        </div>
      </div>

      {/* Top 3 for today (MITs) */}
      <section className="today__section" aria-labelledby="today-mits-h">
        <div className="today__section-head">
          <h2 className="today__section-title" id="today-mits-h">
            Top 3 for today
          </h2>
          <button
            type="button"
            className="btn btn--primary today__pick"
            aria-label="Pick today's top 3"
            onClick={() => setPickerOpen(true)}
          >
            {mitRows.length > 0 ? 'Edit picks' : 'Pick top 3'}
          </button>
        </div>

        {mitRows.length === 0 ? (
          <p className="today__empty">
            The 99% start their day without a plan. Pick the 3 actions that will make today count.
          </p>
        ) : (
          <ul className="mit-list">
            {mitRows.map(({ chart, located }) => {
              const { action, pillarIndex, actionIndex, pillar } = located;
              const done = action.habit ? isHabitCheckedToday(action, today) : action.status === 'done';
              return (
                <li key={`${chart.id}:${action.id}`} className={`mit ${done ? 'is-done' : ''}`.trim()}>
                  <button
                    type="button"
                    className="mit__check"
                    aria-pressed={done}
                    aria-label={`${done ? 'Undo' : 'Complete'} “${action.text.trim() || 'action'}”`}
                    onClick={() => toggleComplete(chart.id, pillarIndex, actionIndex, action)}
                  >
                    <span aria-hidden="true">{done ? '✓' : ''}</span>
                  </button>
                  <div className="mit__body">
                    <span className="mit__text">{action.text.trim() || 'Untitled action'}</span>
                    <span className="mit__context">
                      {chartTitleOf(chart)} · {pillar.name.trim() || 'Unnamed pillar'}
                    </span>
                    {action.cue.trim() !== '' && (
                      <span className="mit__cue">
                        <span aria-hidden="true">⏱ </span>
                        {action.cue.trim()}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Daily habits */}
      <section className="today__section" aria-labelledby="today-habits-h">
        <h2 className="today__section-title" id="today-habits-h">
          Daily habits
        </h2>
        {habitRows.length === 0 ? (
          <p className="today__empty">
            No daily habits yet. Turn any action into a habit from its detail dialog to check it off
            here each day.
          </p>
        ) : (
          <ul className="mit-list">
            {habitRows.map(({ chart, pillarIndex, actionIndex, pillarName, action }) => {
              const checked = isHabitCheckedToday(action, today);
              return (
                <li key={`${chart.id}:${action.id}`} className={`mit ${checked ? 'is-done' : ''}`.trim()}>
                  <button
                    type="button"
                    className="mit__check"
                    aria-pressed={checked}
                    aria-label={`${checked ? 'Undo today for' : 'Did it today:'} “${action.text.trim() || 'habit'}”`}
                    onClick={() => toggleComplete(chart.id, pillarIndex, actionIndex, action)}
                  >
                    <span aria-hidden="true">{checked ? '✓' : ''}</span>
                  </button>
                  <div className="mit__body">
                    <span className="mit__text">{action.text.trim() || 'Untitled habit'}</span>
                    <span className="mit__context">
                      {chartTitleOf(chart)} · {pillarName}
                    </span>
                    {action.cue.trim() !== '' && (
                      <span className="mit__cue">
                        <span aria-hidden="true">⏱ </span>
                        {action.cue.trim()}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Evening reflection */}
      <section className="today__section" aria-labelledby="today-reflect-h">
        <h2 className="today__section-title" id="today-reflect-h">
          Evening reflection
        </h2>
        <label className="field">
          <span className="field__label">What did you learn today?</span>
          <textarea
            className="field__input field__textarea"
            rows={2}
            value={plan.note}
            onChange={(e) => savePlan({ note: e.target.value })}
            placeholder="One line is enough."
          />
        </label>
        <p className="today__summary">
          {doneToday.length === 0
            ? 'Nothing marked done yet today.'
            : `Done today (${doneToday.length}): ${doneToday.join(', ')}`}
        </p>
      </section>

      {pickerOpen && (
        <MitPicker
          charts={charts}
          mits={plan.mits}
          onToggle={(chartId, actionId) => {
            const exists = plan.mits.some((m) => m.chartId === chartId && m.actionId === actionId);
            let mits;
            if (exists) {
              mits = plan.mits.filter((m) => !(m.chartId === chartId && m.actionId === actionId));
            } else {
              if (plan.mits.length >= MAX_MITS) return;
              mits = [...plan.mits, { chartId, actionId }];
            }
            savePlan({ mits });
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <RewardToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/** The MIT picker dialog: candidates grouped chart -> pillar, capped at 3 picks. */
function MitPicker({
  charts,
  mits,
  onToggle,
  onClose,
}: {
  charts: readonly Chart[];
  mits: DayPlan['mits'];
  onToggle: (chartId: string, actionId: string) => void;
  onClose: () => void;
}) {
  // Native <dialog> modal, matching every other modal in the app (ConfirmDialog,
  // ActionDetailDialog, TemplatePicker, ProgressDialog) so it gets correct
  // centering/backdrop/Esc-to-close for free instead of a bespoke overlay.
  const ref = useRef<HTMLDialogElement>(null);

  // Track onClose in a ref so the dialog effect runs exactly once on mount.
  // Re-running it on parent re-renders (picking an item updates the day plan)
  // would close/reopen the <dialog>, and the queued 'close' event would then
  // hit the freshly attached listener and dismiss the picker after one pick.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    dialog.showModal();
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  const candidates = useMemo(() => collectCandidates(charts), [charts]);
  const atCap = mits.length >= MAX_MITS;

  // Group by chart, then pillar, preserving order.
  const groups = useMemo(() => {
    const byChart = new Map<string, { title: string; pillars: Map<string, Candidate[]> }>();
    for (const c of candidates) {
      let g = byChart.get(c.chartId);
      if (!g) {
        g = { title: c.chartTitle, pillars: new Map() };
        byChart.set(c.chartId, g);
      }
      const arr = g.pillars.get(c.pillarName) ?? [];
      arr.push(c);
      g.pillars.set(c.pillarName, arr);
    }
    return byChart;
  }, [candidates]);

  return (
    <dialog
      ref={ref}
      className="modal-overlay"
      aria-label="Pick today's top 3"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="modal modal--picker">
        <div className="modal__header">
          <h2 className="modal__title">Pick today&apos;s top 3</h2>
          <button
            type="button"
            className="btn btn--ghost modal__close"
            onClick={() => ref.current?.close()}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="modal__eyebrow">
          {mits.length}/{MAX_MITS} chosen — the actions that will make today count.
        </p>

        {candidates.length === 0 ? (
          <p className="today__empty">
            No available actions. Fill in some actions on a chart first, then plan your day here.
          </p>
        ) : (
          <div className="picker__scroll">
            {[...groups.entries()].map(([chartId, g]) => (
              <div key={chartId} className="picker__chart">
                <h3 className="picker__chart-title">{g.title}</h3>
                {[...g.pillars.entries()].map(([pillarName, items]) => (
                  <div key={pillarName} className="picker__pillar">
                    <p className="picker__pillar-name">{pillarName}</p>
                    <ul className="picker__list">
                      {items.map((c) => {
                        const selected = mits.some(
                          (m) => m.chartId === c.chartId && m.actionId === c.action.id,
                        );
                        const disabled = !selected && atCap;
                        return (
                          <li key={c.action.id}>
                            <button
                              type="button"
                              className={`picker__item ${selected ? 'is-selected' : ''}`.trim()}
                              aria-pressed={selected}
                              disabled={disabled}
                              onClick={() => onToggle(c.chartId, c.action.id)}
                            >
                              <span className="picker__box" aria-hidden="true">
                                {selected ? '✓' : ''}
                              </span>
                              <span className="picker__item-body">
                                <span className="picker__item-text">
                                  {c.action.text.trim() || 'Untitled action'}
                                </span>
                                {c.action.cue.trim() !== '' && (
                                  <span className="picker__item-cue">{c.action.cue.trim()}</span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--primary" onClick={() => ref.current?.close()}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
