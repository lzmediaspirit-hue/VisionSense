import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bucketsFor,
  calendarMonthFor,
  completionSummary,
  dayAtOffset,
  pillarActivity,
  shortDayLabel,
  stepMonth,
  type CalendarMonth,
  type CompletionBucket,
  type PillarActivityPoint,
  type ProgressView,
} from '../model/completions';
import { pillarRadar, type PillarRadarPoint } from '../model/progress';
import { RULE_OF_8, type Chart, type Pillar } from '../model/types';

/** The Progress dialog's tabs: the three bar-chart views, the radar/scatter pair, and the calendar. */
type Tab = ProgressView | 'radar' | 'scatter' | 'calendar';

interface ProgressDialogProps {
  open: boolean;
  chart: Chart;
  onClose: () => void;
}

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'radar', label: 'Radar' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'calendar', label: 'Calendar' },
];

/** Days of history shown on the Scatter ("Activity") tab (SPEC 21). */
const SCATTER_DAYS = 90;

const VIEW_CAPTION: Record<ProgressView, string> = {
  daily: 'Events per day, last 30 days',
  monthly: 'Events per month, last 12 months',
  yearly: 'Events per year',
};

/**
 * Progress dialog (SPEC 7.2): Daily / Monthly / Yearly completion history as a
 * hand-rolled SVG bar chart (no chart libraries), themed via the existing CSS
 * custom properties, with an overall summary and a visually-hidden data table as
 * the accessible text alternative.
 */
export function ProgressDialog({ open, chart, onClose }: ProgressDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('daily');
  // Calendar navigation: which month is shown (defaults to the current month).
  const [cal, setCal] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

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

  // Reset the calendar to the current month each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setCal({ year: now.getFullYear(), month: now.getMonth() });
  }, [open]);

  const isCalendar = tab === 'calendar';
  const isRadar = tab === 'radar';
  const isScatter = tab === 'scatter';
  // The bar chart only owns the three bucketed views — the radar/scatter/calendar
  // tabs have their own data shapes, so bucketsFor never runs for them.
  const isBarView = !isCalendar && !isRadar && !isScatter;

  // Recompute against "now" each time the dialog is (re)opened or the tab/chart
  // changes. A fresh Date is fine — bucketing is pure and cheap.
  const buckets = useMemo(
    () => (open && isBarView ? bucketsFor(chart, tab as ProgressView, new Date()) : []),
    [open, chart, tab, isBarView],
  );
  const summary = useMemo(
    () => (open ? completionSummary(chart, new Date()) : null),
    [open, chart],
  );
  const calendarMonth = useMemo(
    () => (open && isCalendar ? calendarMonthFor(chart, cal.year, cal.month, new Date()) : null),
    [open, chart, isCalendar, cal.year, cal.month],
  );
  const radarData = useMemo(
    () => (open && isRadar ? pillarRadar(chart) : []),
    [open, chart, isRadar],
  );
  const scatterNow = useMemo(() => new Date(), [open, chart, isScatter]);
  const scatterData = useMemo(
    () => (open && isScatter ? pillarActivity(chart, scatterNow, SCATTER_DAYS) : []),
    [open, chart, isScatter, scatterNow],
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
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`progress-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="progress-panel"
              className={`progress-tabs__tab ${tab === t.id ? 'is-active' : ''}`.trim()}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          id="progress-panel"
          role="tabpanel"
          aria-labelledby={`progress-tab-${tab}`}
          className="progress-panel"
        >
          {isCalendar && calendarMonth ? (
            <CalendarView
              month={calendarMonth}
              onPrev={() => setCal((c) => stepMonth(c.year, c.month, -1))}
              onNext={() => setCal((c) => stepMonth(c.year, c.month, 1))}
            />
          ) : isRadar ? (
            <RadarChart data={radarData} />
          ) : isScatter ? (
            <ScatterChart
              points={scatterData}
              pillars={chart.pillars}
              now={scatterNow}
              days={SCATTER_DAYS}
            />
          ) : (
            <BarChart
              buckets={buckets}
              caption={VIEW_CAPTION[tab as ProgressView]}
              totalInView={totalInView}
            />
          )}
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

// --- Radar tab (v2.3, SPEC 21) -----------------------------------------------

const RADAR_VB_W = 360;
const RADAR_VB_H = 320;
const RADAR_CX = 180;
const RADAR_CY = 150;
const RADAR_R = 88; // radius of the outer (8/8) ring
const RADAR_LABEL_R = 106; // radius of the axis-label ring, just outside the grid
const RADAR_RINGS = [2, 4, 6, 8]; // 25/50/75/100%

/** Angle (radians) of axis `i` of `count`, starting at 12 o'clock, going clockwise. */
function radarAngle(i: number, count: number): number {
  return (Math.PI * 2 * i) / count - Math.PI / 2;
}

function radarPoint(angle: number, r: number): { x: number; y: number } {
  return { x: RADAR_CX + r * Math.cos(angle), y: RADAR_CY + r * Math.sin(angle) };
}

function radarPolygon(points: Array<{ x: number; y: number }>): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function truncateLabel(name: string, max = 12): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

/**
 * Radar tab ("Pillar balance", v2.3 SPEC 21): an 8-axis radar comparing filled
 * vs done actions per pillar. `RULE_OF_8` is the fixed per-axis max (never 0),
 * so every coordinate divides by a constant and can't go NaN even when a
 * pillar's filled/done are both 0 — the polygon just collapses to the center.
 */
function RadarChart({ data }: { data: PillarRadarPoint[] }) {
  // Chart.pillars is always length 8 (invariant), but guard anyway so a stray
  // empty array can never divide-by-zero into a NaN angle.
  const n = Math.max(1, data.length);
  const filledPts = data.map((p, i) => radarPoint(radarAngle(i, n), (p.filled / RULE_OF_8) * RADAR_R));
  const donePts = data.map((p, i) => radarPoint(radarAngle(i, n), (p.done / RULE_OF_8) * RADAR_R));
  const totalFilled = data.reduce((s, p) => s + p.filled, 0);
  const totalDone = data.reduce((s, p) => s + p.done, 0);

  return (
    <figure className="radar">
      <svg
        className="radar__svg"
        viewBox={`0 0 ${RADAR_VB_W} ${RADAR_VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Pillar balance. ${totalDone} of ${totalFilled} planned actions done, across ${n} pillars.`}
      >
        {/* Recessive grid: concentric rings + spokes, same faint treatment as the bar chart's axis. */}
        {RADAR_RINGS.map((level) => (
          <polygon
            key={level}
            points={radarPolygon(data.map((_, i) => radarPoint(radarAngle(i, n), (level / RULE_OF_8) * RADAR_R)))}
            className="radar__grid"
          />
        ))}
        {data.map((_, i) => {
          const outer = radarPoint(radarAngle(i, n), RADAR_R);
          return (
            <line key={`spoke-${i}`} x1={RADAR_CX} y1={RADAR_CY} x2={outer.x} y2={outer.y} className="radar__grid" />
          );
        })}

        {/* "Filled" series: dashed outline, no fill. */}
        <polygon points={radarPolygon(filledPts)} className="radar__series radar__series--filled" />

        {/* "Done" series: solid accent outline with a low-alpha fill. */}
        <polygon points={radarPolygon(donePts)} className="radar__series radar__series--done" />
        {data.map((p, i) => (
          <circle key={p.name + i} cx={donePts[i].x} cy={donePts[i].y} r={4.5} className="radar__vertex">
            <title>{`${p.name}: ${p.done} of ${RULE_OF_8} done, ${p.filled} filled`}</title>
          </circle>
        ))}

        {/* Axis labels. */}
        {data.map((p, i) => {
          const angle = radarAngle(i, n);
          const pos = radarPoint(angle, RADAR_LABEL_R);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
          const dy = sin < -0.5 ? -2 : sin > 0.5 ? 8 : 3;
          return (
            <text
              key={p.name + i}
              x={pos.x}
              y={pos.y + dy}
              textAnchor={anchor}
              className="radar__label"
            >
              {truncateLabel(p.name)}
            </text>
          );
        })}
      </svg>

      <div className="radar__legend">
        <span className="radar__legend-item">
          <svg width="20" height="10" aria-hidden="true" focusable="false">
            <line x1="0" y1="5" x2="20" y2="5" className="radar__swatch radar__swatch--filled" />
          </svg>
          Filled
        </span>
        <span className="radar__legend-item">
          <svg width="20" height="10" aria-hidden="true" focusable="false">
            <line x1="0" y1="5" x2="20" y2="5" className="radar__swatch radar__swatch--done" />
          </svg>
          Done
        </span>
      </div>

      <figcaption className="radar__caption">Planned (filled) vs executed (done) actions per pillar.</figcaption>

      <table className="visually-hidden">
        <caption>Planned (filled) vs executed (done) actions per pillar.</caption>
        <thead>
          <tr>
            <th scope="col">Pillar</th>
            <th scope="col">Filled</th>
            <th scope="col">Done</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.name + i}>
              <th scope="row">{p.name}</th>
              <td>{p.filled}</td>
              <td>{p.done}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// --- Scatter tab (v2.3, SPEC 21) ---------------------------------------------

const SCATTER_VB_W = 640;
const SCATTER_VB_H = 260;
const SCATTER_PAD_L = 72;
const SCATTER_PAD_R = 10;
const SCATTER_PAD_T = 10;
const SCATTER_PAD_B = 26;
const SCATTER_TICKS = 6;

/** Dot radius: base 4 for count 1, area (~r^2) scales with count, capped at 9. */
function scatterRadius(count: number): number {
  return Math.min(9, 4 * Math.sqrt(count));
}

/**
 * Scatter tab ("Activity", v2.3 SPEC 21): one row per pillar, one dot per
 * (day, pillar) with events, sized by that day's event count. Identity is
 * encoded by ROW POSITION + the row label — the pillar color on each dot is
 * redundant reinforcement, not the primary channel, so (per the design rules)
 * there is no legend here, unlike the two-series radar.
 */
function ScatterChart({
  points,
  pillars,
  now,
  days,
}: {
  points: PillarActivityPoint[];
  pillars: readonly Pillar[];
  now: Date;
  days: number;
}) {
  const names = pillars.map((p, i) => p.name.trim() || `Pillar ${i + 1}`);
  const plotW = SCATTER_VB_W - SCATTER_PAD_L - SCATTER_PAD_R;
  const plotH = SCATTER_VB_H - SCATTER_PAD_T - SCATTER_PAD_B;
  const rowH = plotH / RULE_OF_8;
  const baselineY = SCATTER_PAD_T + plotH;
  const rowY = (i: number) => SCATTER_PAD_T + rowH * (i + 0.5);
  const dayX = (offset: number) =>
    SCATTER_PAD_L + (days > 1 ? offset / (days - 1) : 0.5) * plotW;

  const ticks = Array.from({ length: SCATTER_TICKS }, (_, k) => {
    const offset = Math.round((k * (days - 1)) / (SCATTER_TICKS - 1));
    return { offset, label: shortDayLabel(dayAtOffset(now, days, offset)) };
  });
  const todayOffset = days - 1;
  const totalEvents = points.reduce((s, p) => s + p.count, 0);

  if (points.length === 0) {
    return (
      <div className="scatter">
        <p className="scatter__empty">
          No activity in the last {days} days. Habit check-ins and completed actions will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <figure className="scatter">
      <svg
        className="scatter__svg"
        viewBox={`0 0 ${SCATTER_VB_W} ${SCATTER_VB_H}`}
        role="img"
        aria-label={`Activity, last ${days} days. ${totalEvents} completion event${
          totalEvents === 1 ? '' : 's'
        } shown.`}
      >
        {/* Today's column: a very faint vertical guide. */}
        <line
          x1={dayX(todayOffset)}
          y1={SCATTER_PAD_T}
          x2={dayX(todayOffset)}
          y2={baselineY}
          className="scatter__today"
        />

        {/* One faint horizontal guide per pillar row, plus its label. */}
        {names.map((name, i) => (
          <g key={name + i}>
            <line
              x1={SCATTER_PAD_L}
              y1={rowY(i)}
              x2={SCATTER_VB_W - SCATTER_PAD_R}
              y2={rowY(i)}
              className="scatter__axis"
            />
            <text x={SCATTER_PAD_L - 8} y={rowY(i) + 3} textAnchor="end" className="scatter__rowlabel">
              {truncateLabel(name, 10)}
            </text>
          </g>
        ))}

        {/* Recessive x-axis baseline + date ticks. */}
        <line x1={SCATTER_PAD_L} y1={baselineY} x2={SCATTER_VB_W - SCATTER_PAD_R} y2={baselineY} className="scatter__axis" />
        {ticks.map((t) => (
          <text
            key={t.offset}
            x={dayX(t.offset)}
            y={SCATTER_VB_H - 8}
            textAnchor="middle"
            className="scatter__label"
          >
            {t.label}
          </text>
        ))}

        {points.map((pt) => {
          const pillar = pillars[pt.pillarIndex];
          const name = names[pt.pillarIndex];
          return (
            <circle
              key={`${pt.dayOffset}-${pt.pillarIndex}`}
              cx={dayX(pt.dayOffset)}
              cy={rowY(pt.pillarIndex)}
              r={scatterRadius(pt.count)}
              className="scatter__dot"
              style={{ fill: pillar.color }}
            >
              <title>{`${name} — ${pt.fullLabel}: ${pt.count} event${pt.count === 1 ? '' : 's'}`}</title>
            </circle>
          );
        })}
      </svg>

      <figcaption className="scatter__caption">
        Each dot is a day's completions in that pillar — bigger dot, more events. Last {days} days.
      </figcaption>

      <table className="visually-hidden">
        <caption>Activity by day and pillar, last {days} days.</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Pillar</th>
            <th scope="col">Events</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt) => (
            <tr key={`${pt.dayOffset}-${pt.pillarIndex}`}>
              <th scope="row">{pt.fullLabel}</th>
              <td>{names[pt.pillarIndex]}</td>
              <td>{pt.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Calendar tab (SPEC 8.4): a month grid where each day is shaded by that day's
 * event count using the theme accent, today outlined, with month back/forward
 * navigation and per-day aria-labels. Pure HTML/CSS grid — no libraries.
 */
function CalendarView({
  month,
  onPrev,
  onNext,
}: {
  month: CalendarMonth;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Normalize shade intensity to the busiest day so the scale always spans the
  // theme accent from faint to strong, regardless of absolute counts.
  const maxCount = Math.max(1, ...month.weeks.flat().map((d) => d.count));

  return (
    <figure className="calendar">
      <div className="calendar__nav">
        <button type="button" className="btn btn--ghost calendar__navbtn" onClick={onPrev} aria-label="Previous month">
          <span aria-hidden="true">‹</span>
        </button>
        <h3 className="calendar__month" aria-live="polite">
          {month.label}
        </h3>
        <button type="button" className="btn btn--ghost calendar__navbtn" onClick={onNext} aria-label="Next month">
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="calendar__grid" role="group" aria-label={`${month.label} — daily events`}>
        {month.weekdayHeaders.map((w) => (
          <div key={w} className="calendar__weekday" aria-hidden="true">
            {w}
          </div>
        ))}
        {month.weeks.flat().map((day) => {
          if (day.day === null) {
            return <div key={day.key} className="calendar__day calendar__day--pad" aria-hidden="true" />;
          }
          const intensity = day.count > 0 ? 20 + Math.round((day.count / maxCount) * 60) : 0;
          const style =
            day.count > 0
              ? ({ background: `color-mix(in srgb, var(--accent) ${intensity}%, var(--surface))` } as React.CSSProperties)
              : undefined;
          const label = `${day.fullLabel}: ${day.count} completion${day.count === 1 ? '' : 's'}`;
          return (
            <div
              key={day.key}
              className={`calendar__day ${day.isToday ? 'is-today' : ''} ${day.count > 0 ? 'has-events' : ''}`.trim()}
              style={style}
              title={label}
              aria-label={label}
            >
              <span className="calendar__daynum">{day.day}</span>
            </div>
          );
        })}
      </div>

      <figcaption className="calendar__caption">
        {month.totalCount} completion{month.totalCount === 1 ? '' : 's'} in {month.label}. Days are
        shaded by event count; today is outlined.
      </figcaption>
    </figure>
  );
}
