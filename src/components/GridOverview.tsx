import { localDayKey } from '../model/completions';
import { buildBlocks, type GridBlock, type GridCell } from '../model/grid';
import type { Chart } from '../model/types';

interface GridOverviewProps {
  chart: Chart;
  onNavigate: (position: number) => void;
}

/**
 * Mobile "full grid" overview (SPEC 4.1 responsive strategy, extended): all
 * 81 cells at a glance, scaled to the viewport width with no page scroll.
 * Read-only — tapping/activating a block jumps into that block in the
 * normal (editable) block view, same as the mini-map. Reuses the grid
 * mapping from ../model/grid rather than re-deriving block/pillar geometry.
 */
export function GridOverview({ chart, onNavigate }: GridOverviewProps) {
  const blocks = buildBlocks(chart);
  return (
    <div className="overview" role="group" aria-label="Full 9 by 9 grid overview">
      {blocks.map((block) => (
        <button
          key={block.position}
          type="button"
          className={`overview__block block ${block.isCenter ? 'block--center' : 'block--pillar'}`}
          style={
            block.color
              ? ({ ['--cell-accent' as string]: block.color } as React.CSSProperties)
              : undefined
          }
          onClick={() => onNavigate(block.position)}
          aria-label={blockLabel(chart, block)}
        >
          {block.cells.map((cell) => (
            <OverviewCell key={cell.key} cell={cell} />
          ))}
        </button>
      ))}
    </div>
  );
}

function OverviewCell({ cell }: { cell: GridCell }) {
  const isFilled = cell.text.trim() !== '';
  const classNames = ['cell', `cell--${cell.kind}`];
  classNames.push(isFilled ? 'is-filled' : 'is-empty');
  if (cell.kind === 'action' && isFilled) {
    if (cell.habit) {
      classNames.push('is-habit');
      if (cell.established) classNames.push('is-established');
      // A habit reads done when established or checked today (SPEC 8.1/8.2).
      if (cell.established || checkedToday(cell.completions)) classNames.push('status-done');
    } else {
      classNames.push(`status-${cell.status}`);
    }
  }

  const style =
    cell.color && cell.kind !== 'goal'
      ? ({ ['--cell-accent' as string]: cell.color } as React.CSSProperties)
      : undefined;

  return (
    <div className={classNames.join(' ')} style={style} aria-hidden="true">
      {isFilled && <span className="cell__text">{cell.text}</span>}
    </div>
  );
}

/** Whether a completions history has an entry on the local day of now. */
function checkedToday(completions: string[]): boolean {
  const today = localDayKey(new Date());
  return completions.some((c) => {
    const d = new Date(c);
    return !Number.isNaN(d.getTime()) && localDayKey(d) === today;
  });
}

function blockLabel(chart: Chart, block: GridBlock): string {
  if (block.isCenter) return 'Center hub: goal and pillars — open in block view';
  const pillar = chart.pillars[block.pillarIndex!];
  const name = pillar.name.trim();
  return `Pillar ${block.pillarIndex! + 1}${name ? `: ${name}` : ''} — open in block view`;
}
