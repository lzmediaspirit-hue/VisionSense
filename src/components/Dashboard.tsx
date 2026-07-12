// Phase-1 placeholder landing screen. Phase 2 replaces this with the real
// dashboard (templates, duplicate/delete, theme swatches). Kept intentionally
// minimal: a "your charts" list + a "New blank chart" button.

import { chartProgress } from '../model/progress';
import { useStore } from '../state/store';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Dashboard() {
  const { state, createBlankChart, openChart } = useStore();
  const charts = state.charts;

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
        <button type="button" className="btn btn--primary" onClick={() => createBlankChart()}>
          + New blank chart
        </button>
      </header>

      {charts.length === 0 ? (
        <div className="dashboard__empty">
          <p className="dashboard__empty-title">No charts yet</p>
          <p className="dashboard__empty-body">
            A Mandala chart sets one goal at the centre, surrounded by exactly 8 pillars,
            each broken into 8 concrete actions. Start with a blank chart.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => createBlankChart()}
          >
            + New blank chart
          </button>
        </div>
      ) : (
        <ul className="chart-list">
          {charts.map((chart) => {
            const { filled, done, total } = chartProgress(chart);
            const title = chart.goal.trim() || 'Untitled chart';
            return (
              <li key={chart.id}>
                <button
                  type="button"
                  className="chart-card"
                  onClick={() => openChart(chart.id)}
                >
                  <span className="chart-card__title">{title}</span>
                  <span className="chart-card__meta">
                    {filled}/{total} filled · {done} done
                  </span>
                  <span className="chart-card__date">Updated {formatDate(chart.updatedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
