import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bucketsFor,
  completionSummary,
  type CompletionBucket,
  type ProgressView,
} from '../model/completions';
import type { Chart } from '../model/types';

interface ProgressDialogProps {
  open: boolean;
  chart: Chart;
  onClose: () => void;
}

const VIEWS: readonly { id: ProgressView; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

const VIEW_CAPTION: Record<ProgressView, string> = {
  daily: 'Completions per day, last 30 days',
  monthly: 'Completions per month, last 12 months',
  yearly: 'Completions per year',
};

/**
 * Progress dialog (SPEC 7.2): Daily / Monthly / Yearly completion history as a
 * hand-rolled SVG bar chart (no chart libraries), themed via the existing CSS
 * custom properties, with an overall summary and a visually-hidden data table as
 * the accessible text alternative.
 */
export function ProgressDialog({ open, chart, onClose }: ProgressDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<ProgressView>('daily');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Recompute against "now" each time the dialog is (re)opened or the view/chart
  // changes. A fresh Date is fine — bucketing is pure and cheap.
  const buckets = useMemo(
    () => (open ? bucketsFor(chart, view, new Date()) : []),
    [open, chart, view],
  );
  const summary = useMemo(
    () => (open ? completionSummary(chart, new Date()) : null),
    [open, chart],
  );

  const totalInView = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <dialog
      ref={ref}
      className="modal-overlay modal-overlay--wide"
      aria-label="Progress"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="modal modal--progress">
        <div className="modal__header">
          <h2 className="modal__title">Progress</h2>
          <button
            type="button"
            className="btn btn--ghost modal__close"
            onClick={() => ref.current?.close()}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {summary && (
          <div className="progress-summary">
            <div className="progress-summary__stat">
              <span className="progress-summary__num">{summary.totalDone}</span>
              <span className="progress-summary__unit">/ {summary.total} done</span>
            </div>
            <div className="progress-summary__stat">
              <span className="progress-summary__num">{summary.currentStreak}</span>
              <span className="progress-summary__unit">
                day{summary.currentStreak === 1 ? '' : 's'} streak
              </span>
            </div>
          </div>
        )}

        <div className="progress-tabs" role="tablist" aria-label="Progress view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              id={`progress-tab-${v.id}`}
              aria-selected={view === v.id}
              aria-controls="progress-panel"
              className={`progress-tabs__tab ${view === v.id ? 'is-active' : ''}`.trim()}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div
          id="progress-panel"
          role="tabpanel"
          aria-labelledby={`progress-tab-${view}`}
          className="progress-panel"
        >
          <BarChart buckets={buckets} caption={VIEW_CAPTION[view]} totalInView={totalInView} />
        </div>
      </div>
    </dialog>
  );
}

const VB_W = 640;
const VB_H = 200;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 14;
const PAD_B = 20;

/** A top-rounded bar path anchored to the baseline (rounds only the data end). */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(3, w / 2, h);
  if (h <= 0) return '';
  return [
    `M${x},${y + h}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ');
}

function BarChart({
  buckets,
  caption,
  totalInView,
}: {
  buckets: CompletionBucket[];
  caption: string;
  totalInView: number;
}) {
  const n = buckets.length;
  const plotW = VB_W - PAD_L - PAD_R;
  const plotH = VB_H - PAD_T - PAD_B;
  const baselineY = PAD_T + plotH;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const step = n > 0 ? plotW / n : plotW;
  // Thin marks with a 2px surface gap between adjacent bars.
  const barW = Math.max(2, step - 2);

  // Label only a readable subset on dense (daily) axes; show all when sparse.
  const labelEvery = n > 14 ? Math.ceil(n / 6) : 1;

  return (
    <figure className="barchart">
      <svg
        className="barchart__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${caption}. ${totalInView} completion${
          totalInView === 1 ? '' : 's'
        } shown, peak ${maxCount} in a single bucket.`}
      >
        {/* Recessive baseline. */}
        <line
          x1={PAD_L}
          y1={baselineY}
          x2={VB_W - PAD_R}
          y2={baselineY}
          className="barchart__axis"
        />
        {buckets.map((b, i) => {
          const h = (b.count / maxCount) * plotH;
          const x = PAD_L + i * step + (step - barW) / 2;
          const y = baselineY - h;
          return (
            <g key={b.key}>
              {b.count > 0 && (
                <path d={barPath(x, y, barW, h)} className="barchart__bar">
                  <title>{`${b.fullLabel}: ${b.count} completion${
                    b.count === 1 ? '' : 's'
                  }`}</title>
                </path>
              )}
              {i % labelEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={VB_H - 6}
                  className="barchart__label"
                  textAnchor="middle"
                >
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="barchart__caption">{caption}</figcaption>

      {/* Accessible text alternative: the same data as a table. */}
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Completions</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.fullLabel}</th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
