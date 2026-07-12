import { chartProgress } from '../model/progress';
import type { Chart } from '../model/types';

/** Header progress strip: overall filled/done across the 64 actions. */
export function ProgressStrip({ chart }: { chart: Chart }) {
  const { filled, done, total } = chartProgress(chart);
  const filledRatio = filled / total;
  const doneRatio = filled > 0 ? done / filled : 0;

  return (
    <div className="progress-strip" aria-label={`${filled} of ${total} actions filled, ${done} done`}>
      <div className="progress-strip__track" aria-hidden="true">
        <div className="progress-strip__filled" style={{ width: `${filledRatio * 100}%` }}>
          <div className="progress-strip__done" style={{ width: `${doneRatio * 100}%` }} />
        </div>
      </div>
      <div className="progress-strip__label">
        <strong>{filled}</strong> / {total} actions
        <span className="progress-strip__sep">·</span>
        <strong>{done}</strong> done
      </div>
    </div>
  );
}
