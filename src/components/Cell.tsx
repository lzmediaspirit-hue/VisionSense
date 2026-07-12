import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  if (isAction && isFilled) classNames.push(`status-${cell.status}`);
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

      {isAction && isFilled && !editing && (
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
