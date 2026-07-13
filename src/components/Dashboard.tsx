// Landing screen (SPEC 4.2): saved charts as cards (title/goal, theme swatch,
// progress, updated date), create-from-template, duplicate, delete (confirm),
// and JSON import. Export (JSON/PNG) and print live in ChartScreen's header
// since they act on the chart currently open there.

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { parseChartImport } from '../model/exportImport';
import { isReviewDue } from '../model/journal';
import { getFlag, HELP_SEEN_KEY, setFlag } from '../model/onboarding';
import { chartProgress } from '../model/progress';
import { useStore } from '../state/store';
import { EXAMPLE_TEMPLATE_ID } from '../templates/example';
import type { Template } from '../templates/templates';
import { ChartThumb } from './ChartThumb';
import { ConfirmDialog } from './ConfirmDialog';
import { HowItWorksDialog } from './HowItWorksDialog';
import { SyncWidget } from './SyncWidget';
import { TemplatePicker } from './TemplatePicker';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface DashboardProps {
  /** Open the cross-chart Today view (v1.4, SPEC 11.2). */
  onOpenToday: () => void;
  /** Open the weekly review screen (v1.4, SPEC 11.3). */
  onOpenReview: () => void;
}

export function Dashboard({ onOpenToday, onOpenReview }: DashboardProps) {
  const { state, createBlankChart, importChart, openChart, duplicateChart, deleteChart } =
    useStore();
  const charts = state.charts;
  const reviewDue = isReviewDue(state.reviews);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-show "How it works" exactly once, ever, and ONLY for a genuine
  // first-run user (v1.6, SPEC 13). A ref guard (not state) so this only ever
  // fires on the initial mount, never again on re-renders — mirrors the sync
  // controller's `didInit` pattern. First run is detected by the presence of
  // the seeded example chart: existing users (who upgraded into this version
  // and already have their own charts) are never seeded, so the dialog must
  // not pop for them even though they've never set HELP_SEEN_KEY.
  const didAutoShowHelp = useRef(false);
  useEffect(() => {
    if (didAutoShowHelp.current) return;
    didAutoShowHelp.current = true;
    const isFirstRun = charts.some((c) => c.templateId === EXAMPLE_TEMPLATE_ID);
    if (isFirstRun && !getFlag(HELP_SEEN_KEY)) {
      setHelpOpen(true);
      setFlag(HELP_SEEN_KEY);
    }
  }, [charts]);

  const onOpenExample = useCallback(() => {
    const example = charts.find((c) => c.templateId === EXAMPLE_TEMPLATE_ID);
    if (example) openChart(example.id);
  }, [charts, openChart]);

  const onPickTemplate = useCallback(
    (template: Template) => {
      createBlankChart({
        pillarNames: template.pillarNames,
        themeId: template.defaultThemeId,
        templateId: template.id,
      });
      setPickerOpen(false);
    },
    [createBlankChart],
  );

  const onImportClick = () => fileInputRef.current?.click();

  const onImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = parseChartImport(text);
      if (result.ok) {
        setImportError(null);
        importChart(result.chart);
      } else {
        setImportError(result.error);
      }
    };
    reader.onerror = () => setImportError('Could not read that file.');
    reader.readAsText(file);
  };

  const deleteTarget = confirmDeleteId
    ? (charts.find((c) => c.id === confirmDeleteId) ?? null)
    : null;

  return (
    <div className="dashboard" data-theme="minimal">
      <header className="dashboard__header">
        <div className="dashboard__brand">
          <span className="dashboard__logo" aria-hidden="true">
            ◆
          </span>
          <div>
            <h1 className="dashboard__title">VisionSense</h1>
            <p className="dashboard__subtitle">Your Mandala charts</p>
          </div>
        </div>
        <div className="dashboard__header-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setHelpOpen(true)}
            aria-label="How it works"
          >
            ?
          </button>
          <button type="button" className="btn btn--ghost" onClick={onImportClick}>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={onImportFile}
            aria-label="Import chart from JSON file"
          />
          <button type="button" className="btn btn--primary" onClick={() => setPickerOpen(true)}>
            + New chart
          </button>
        </div>
      </header>

      <div className="dashboard__cta">
        <button type="button" className="btn btn--primary dashboard__cta-today" onClick={onOpenToday}>
          <span aria-hidden="true">☀</span> Today
        </button>
        <button
          type="button"
          className="btn btn--ghost dashboard__cta-review"
          onClick={onOpenReview}
          aria-label={reviewDue ? 'Review (due)' : 'Review'}
        >
          Review
          {reviewDue && (
            <span className="due-badge" aria-hidden="true">
              1
            </span>
          )}
        </button>
      </div>

      {importError && (
        <p className="dashboard__error" role="alert">
          <span>{importError}</span>
          <button type="button" className="btn btn--ghost" onClick={() => setImportError(null)}>
            Dismiss
          </button>
        </p>
      )}

      {charts.length === 0 ? (
        <div className="dashboard__empty">
          <p className="dashboard__empty-title">No charts yet</p>
          <p className="dashboard__empty-body">
            A Mandala chart sets one goal at the centre, surrounded by exactly 8 pillars, each
            broken into 8 concrete actions. Start from a template, or a blank chart.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setPickerOpen(true)}>
            + New chart
          </button>
        </div>
      ) : (
        <ul className="chart-list">
          {charts.map((chart) => {
            const { filled, done, total } = chartProgress(chart);
            const title = chart.goal.trim() || 'Untitled chart';
            const filledRatio = filled / total;
            const doneRatio = filled > 0 ? done / filled : 0;
            return (
              <li key={chart.id}>
                <div className="chart-card">
                  <button
                    type="button"
                    className="chart-card__open"
                    onClick={() => openChart(chart.id)}
                  >
                    <ChartThumb chart={chart} />
                    <span className="chart-card__body">
                      <span className="chart-card__title-row">
                        <span className="chart-card__title">{title}</span>
                        {chart.templateId === EXAMPLE_TEMPLATE_ID && (
                          <span className="chart-card__badge">Example</span>
                        )}
                      </span>
                      <span className="chart-card__meta">
                        {filled}/{total} filled · {done} done
                      </span>
                      <span className="chart-card__progress" aria-hidden="true">
                        <span
                          className="chart-card__progress-fill"
                          style={{ width: `${filledRatio * 100}%` }}
                        >
                          <span
                            className="chart-card__progress-done"
                            style={{ width: `${doneRatio * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="chart-card__date">Updated {formatDate(chart.updatedAt)}</span>
                    </span>
                  </button>
                  <div className="chart-card__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => duplicateChart(chart.id)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger-text"
                      onClick={() => setConfirmDeleteId(chart.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SyncWidget />

      <TemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickTemplate}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this chart?"
        body={`"${deleteTarget?.goal.trim() || 'Untitled chart'}" and all of its pillars and actions will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDeleteId) deleteChart(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <HowItWorksDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onOpenExample={onOpenExample}
      />
    </div>
  );
}
