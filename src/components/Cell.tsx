import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { localDayKey } from '../model/completions';
import type { GridCell } from '../model/grid';
import type { Progress } from '../model/progress';

export interface CellProps {
  cell: GridCell;
  /** Global 9x9 coordinates — used for roving focus on the desktop grid. */
  row?: number;
  col?: number;
  /** Roving tabindex: 0 for the active cell, -1 otherwise. Defaults to 0. */
  tabIndex?: number;
  registerRef?: (row: number, col: number, el: HTMLDivElement | null) => void;
  onCommitText: (cell: GridCell, text: string) => void;
  onCycleStatus: (cell: GridCell) => void;
  /** Toggle a habit action's "did it today" check (v1.2). */
  onToggleHabitToday?: (cell: GridCell) => void;
  /** Open the action detail dialog (v1.1). Provided only for action cells. */
  onExpand?: (cell: GridCell) => void;
  onHighlightPillar?: (pillarIndex: number | null) => void;
  onFocusCell?: (row: number, col: number) => void;
  /** Provided for pillar cells to render a thin completion bar. */
  progress?: Progress;
  /** true if this cell's pillar block is currently highlighted. */
  highlighted?: boolean;
}

const PLACEHOLDER: Record<GridCell['kind'], string> = {
  goal: 'Your goal',
  pillar: 'Pillar',
  action: 'Action',
};

const STATUS_LABEL: Record<'todo' | 'doing' | 'done', string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
};

function CellImpl(props: CellProps) {
  const {
    cell,
    row,
    col,
    tabIndex = 0,
    registerRef,
    onCommitText,
    onCycleStatus,
    onToggleHabitToday,
    onExpand,
    onHighlightPillar,
    onFocusCell,
    progress,
    highlighted,
  } = props;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cell.text);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isFilled = cell.text.trim() !== '';
  const isPillarName = cell.kind === 'pillar';
  const isAction = cell.kind === 'action';
  const canExpand = isAction && isFilled && !!onExpand;
  const hasDetails =
    isAction && ((cell.description ?? '').trim() !== '' || (cell.reward ?? '').trim() !== '');

  // Habit state (v1.2). "Checked today" is derived from the completions history
  // against the local day; established habits stop offering the daily check and
  // render as done.
  const isHabit = isAction && cell.habit;
  const isEstablished = isHabit && cell.established;
  const checkedToday = isHabit && !isEstablished && hasCompletionToday(cell.completions);
  const doneVisual = isHabit ? isEstablished || checkedToday : isAction && cell.status === 'done';

  // Register/unregister DOM node for grid focus management.
  useEffect(() => {
    if (registerRef && row !== undefined && col !== undefined) {
      registerRef(row, col, rootRef.current);
      return () => registerRef(row, col, null);
    }
  }, [registerRef, row, col]);

  const autosize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    if (editing) {
      const ta = textareaRef.current;
      if (ta) {
        autosize();
        ta.focus();
        ta.select();
      }
    }
  }, [editing]);

  const beginEdit = () => {
    if (editing) return;
    setDraft(cell.text);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== cell.text) onCommitText(cell, draft);
    // Return focus to the cell shell for continued keyboard nav.
    requestAnimationFrame(() => rootRef.current?.focus());
  };

  const cancel = () => {
    setDraft(cell.text);
    setEditing(false);
    requestAnimationFrame(() => rootRef.current?.focus());
  };

  const onShellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation();
      beginEdit();
    } else if ((e.key === 'e' || e.key === 'E') && canExpand) {
      // Keyboard path to the detail dialog from a focused action cell (the
      // expand button is also reachable via Tab). Documented in SPEC 7.1 notes.
      e.preventDefault();
      e.stopPropagation();
      onExpand?.(cell);
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  const highlightOn = () => {
    if (isPillarName && cell.pillarIndex !== null) onHighlightPillar?.(cell.pillarIndex);
  };
  const highlightOff = () => {
    if (isPillarName) onHighlightPillar?.(null);
  };

  const classNames = ['cell', `cell--${cell.kind}`];
  if (cell.isHub) classNames.push('cell--hub');
  if (isFilled) classNames.push('is-filled');
  else classNames.push('is-empty');
  if (isAction && isFilled) {
    if (isHabit) {
      classNames.push('is-habit');
      if (isEstablished) classNames.push('is-established');
      if (checkedToday) classNames.push('is-checked-today');
      // A checked-today or established habit reads as done (SPEC 8.1/8.2); an
      // unchecked one stays neutral (like todo) with just its recurring marker.
      if (doneVisual) classNames.push('status-done');
    } else {
      classNames.push(`status-${cell.status}`);
    }
  }
  if (highlighted) classNames.push('is-highlighted');

  const style =
    cell.color && cell.kind !== 'goal'
      ? ({ ['--cell-accent' as string]: cell.color } as React.CSSProperties)
      : undefined;

  const ratio = progress && progress.filled > 0 ? progress.done / progress.filled : 0;

  return (
    <div
      ref={rootRef}
      className={classNames.join(' ')}
      style={style}
      role="gridcell"
      tabIndex={editing ? -1 : tabIndex}
      aria-label={cellAriaLabel(cell, isFilled)}
      onClick={beginEdit}
      onKeyDown={onShellKeyDown}
      onMouseEnter={highlightOn}
      onMouseLeave={highlightOff}
      onFocus={() => {
        highlightOn();
        if (onFocusCell && row !== undefined && col !== undefined) onFocusCell(row, col);
      }}
      onBlur={highlightOff}
      data-row={row}
      data-col={col}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          className="cell__input"
          value={draft}
          rows={1}
          onChange={(e) => {
            setDraft(e.target.value);
            autosize();
          }}
          onKeyDown={onTextareaKeyDown}
          onBlur={commit}
          aria-label={`Edit ${cell.kind}`}
        />
      ) : (
        <span className={isFilled ? 'cell__text' : 'cell__text cell__placeholder'}>
          {isFilled ? cell.text : PLACEHOLDER[cell.kind]}
        </span>
      )}

      {isPillarName && progress && progress.filled > 0 && !editing && (
        <div
          className="cell__progress"
          title={`${progress.done}/${progress.filled} done`}
          aria-hidden="true"
        >
          <div className="cell__progress-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      )}

      {/* Recurring marker: a habit reads as recurring, not unstarted (SPEC 8.1). */}
      {isHabit && !isEstablished && !editing && (
        <span className="cell__habit-marker" aria-hidden="true" title="Daily habit">
          <RecurGlyph />
        </span>
      )}

      {isAction && isFilled && !editing && (
        isEstablished ? (
          // Established habit: a distinct badge, no daily control (SPEC 8.2).
          <span
            className="cell__habit-badge"
            title="Established habit"
            aria-label="Established habit"
          >
            <BadgeGlyph />
          </span>
        ) : isHabit ? (
          // "Did it today" check — distinct from the task status cycle (SPEC 8.1).
          <button
            type="button"
            className="cell__habit-check"
            onClick={(e) => {
              e.stopPropagation();
              onToggleHabitToday?.(cell);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-pressed={checkedToday}
            aria-label={
              checkedToday
                ? `Done today: ${cell.text}. Tap to undo.`
                : `Not done today: ${cell.text}. Tap to check off.`
            }
            title={checkedToday ? 'Done today' : 'Check off today'}
          >
            <HabitRing filled={checkedToday} />
          </button>
        ) : (
          <button
            type="button"
            className="cell__status"
            onClick={(e) => {
              e.stopPropagation();
              onCycleStatus(cell);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Status: ${STATUS_LABEL[cell.status ?? 'todo']}. Click to advance.`}
            title={STATUS_LABEL[cell.status ?? 'todo']}
          >
            <StatusGlyph status={cell.status ?? 'todo'} />
          </button>
        )
      )}

      {canExpand && !editing && (
        <button
          type="button"
          className="cell__expand"
          onClick={(e) => {
            e.stopPropagation();
            onExpand?.(cell);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`Open details for ${cell.text}`}
          title="Details"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M6 3.5h6.5V10 M12.5 3.5l-6 6 M8.5 12.5H3.5V7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {hasDetails && !editing && (
        <span className="cell__detail-dot" aria-hidden="true" title="Has details" />
      )}
    </div>
  );
}

function StatusGlyph({ status }: { status: 'todo' | 'doing' | 'done' }) {
  if (status === 'done') {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === 'doing') {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8 L8 3 A5 5 0 0 1 13 8 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** "Did it today" ring: an open circle that fills with a check when checked. */
function HabitRing({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
      {filled && (
        <path
          d="M5 8.2l2 2 4-4.4"
          fill="none"
          stroke="var(--surface)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Established-habit badge: a checkmark seal. */
function BadgeGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M8 1.3l1.6 1.2 2 .1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2 .1L8 14.7l-1.6-1.2-2-.1-.6-1.9L2.2 10l.6-1.9-.6-1.9 1.6-1.2.6-1.9 2-.1L8 1.3z"
        fill="currentColor"
      />
      <path
        d="M5.4 8l1.8 1.8L10.8 6"
        fill="none"
        stroke="var(--surface)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Subtle "recurring" marker (circular arrows) for habit cells. */
function RecurGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path
        d="M3.5 8a4.5 4.5 0 0 1 7.7-3.2M12.5 8a4.5 4.5 0 0 1-7.7 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M11.5 2.5v2.2H9.3M4.5 13.5v-2.2h2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Whether a completions history has an entry on the local day of now. */
function hasCompletionToday(completions: string[]): boolean {
  const today = localDayKey(new Date());
  return completions.some((c) => {
    const d = new Date(c);
    return !Number.isNaN(d.getTime()) && localDayKey(d) === today;
  });
}

function cellAriaLabel(cell: GridCell, isFilled: boolean): string {
  const value = isFilled ? cell.text : 'empty';
  switch (cell.kind) {
    case 'goal':
      return `Goal: ${value}`;
    case 'pillar':
      return `Pillar ${(cell.pillarIndex ?? 0) + 1}: ${value}`;
    case 'action':
      return `Pillar ${(cell.pillarIndex ?? 0) + 1}, action ${
        (cell.actionIndex ?? 0) + 1
      }: ${value}`;
  }
}

export const Cell = memo(CellImpl);
