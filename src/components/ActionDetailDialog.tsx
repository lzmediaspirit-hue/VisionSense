import { useEffect, useRef, useState } from 'react';
import { weekCompletions } from '../model/journal';
import type { Action, StoredStatus } from '../model/types';

interface ActionDetailDialogProps {
  /** The action being edited, or null when the dialog is closed. */
  action: Action | null;
  pillarIndex: number | null;
  actionIndex: number | null;
  onCommitText: (text: string) => void;
  onCommitDetails: (details: { description?: string; reward?: string; cue?: string }) => void;
  onSetStatus: (status: StoredStatus) => void;
  /** Turn habit tracking on/off (v1.2). */
  onSetHabit: (habit: boolean) => void;
  /** Set a habit's weekly cadence: 0 = daily, N = target days/week (v1.5). */
  onSetCadence: (weeklyTarget: number) => void;
  /** Mark/un-mark an established habit (v1.2). */
  onSetEstablished: (established: boolean) => void;
  onClose: () => void;
}

const STATUS_ORDER: readonly StoredStatus[] = ['todo', 'doing', 'done'];
const STATUS_LABEL: Record<StoredStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
};

/**
 * Action detail dialog (SPEC 7.1): edit the title, a long description, a reward,
 * and the status behind a single action cell. Reuses the native <dialog> modal
 * pattern from ConfirmDialog. Text fields keep local drafts committed on blur (and
 * flushed on close); the status control writes through immediately so completion
 * side-effects (completedAt + reward toast) fire live.
 */
export function ActionDetailDialog({
  action,
  pillarIndex,
  actionIndex,
  onCommitText,
  onCommitDetails,
  onSetStatus,
  onSetHabit,
  onSetCadence,
  onSetEstablished,
  onClose,
}: ActionDetailDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = action !== null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [cue, setCue] = useState('');
  // Track what we opened with, so blur/close only commits genuine changes.
  const base = useRef({ title: '', description: '', reward: '', cue: '' });

  // Sync drafts from the action whenever the dialog (re)opens on a new action.
  useEffect(() => {
    if (!action) return;
    setTitle(action.text);
    setDescription(action.description);
    setReward(action.reward);
    setCue(action.cue);
    base.current = {
      title: action.text,
      description: action.description,
      reward: action.reward,
      cue: action.cue,
    };
  }, [action?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = () => {
    if (title !== base.current.title) {
      onCommitText(title);
      base.current.title = title;
    }
    const details: { description?: string; reward?: string; cue?: string } = {};
    if (description !== base.current.description) details.description = description;
    if (reward !== base.current.reward) details.reward = reward;
    if (cue !== base.current.cue) details.cue = cue;
    if (
      details.description !== undefined ||
      details.reward !== undefined ||
      details.cue !== undefined
    ) {
      onCommitDetails(details);
      base.current.description = description;
      base.current.reward = reward;
      base.current.cue = cue;
    }
  };

  // Esc / backdrop / native dismissal fires 'close' — flush drafts, then notify.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      flush();
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const status = action?.status ?? 'todo';
  const isHabit = action?.habit ?? false;
  const established = action?.established ?? false;
  const completionCount = action?.completions.length ?? 0;
  const weeklyTarget = action?.weeklyTarget ?? 0;
  const label =
    pillarIndex !== null && actionIndex !== null
      ? `Pillar ${pillarIndex + 1}, action ${actionIndex + 1}`
      : 'Action';

  return (
    <dialog
      ref={ref}
      className="modal-overlay"
      aria-label="Action details"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="modal modal--detail">
        <div className="modal__header">
          <h2 className="modal__title">Action details</h2>
          <button
            type="button"
            className="btn btn--ghost modal__close"
            onClick={() => ref.current?.close()}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="modal__eyebrow">{label}</p>

        <label className="field">
          <span className="field__label">Title</span>
          <input
            type="text"
            className="field__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={flush}
            placeholder="A measurable behaviour"
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="field__input field__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={flush}
            rows={4}
            placeholder="The detail behind this action — the how, the why, the specifics."
          />
        </label>

        <label className="field">
          <span className="field__label">When &amp; where?</span>
          <input
            type="text"
            className="field__input"
            value={cue}
            onChange={(e) => setCue(e.target.value)}
            onBlur={flush}
            placeholder="After breakfast, at the park"
          />
          <span className="field__hint">
            An if-then plan: pre-decide the moment you&apos;ll act. Shown in Today.
          </span>
        </label>

        <label className="field">
          <span className="field__label">Reward</span>
          <input
            type="text"
            className="field__input"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            onBlur={flush}
            placeholder="Celebrate this when you complete it"
          />
          <span className="field__hint">Shown as a toast when you mark this done.</span>
        </label>

        {/* Habit layer (v1.2): track as a recurring behaviour, and graduate it. */}
        <div className="field">
          <label className="switch">
            <input
              type="checkbox"
              className="switch__input"
              role="switch"
              checked={isHabit}
              onChange={(e) => onSetHabit(e.target.checked)}
            />
            <span className="switch__track" aria-hidden="true" />
            <span className="switch__label">Track as a habit</span>
          </label>
          <span className="field__hint">
            A habit is a recurring behaviour you check off — every day, or a few set days a week.
          </span>
        </div>

        {isHabit ? (
          <>
            {/* Weekly cadence (v1.5, SPEC 12): daily by default, or N days/week. */}
            <label className="field">
              <span className="field__label">How often?</span>
              <select
                className="field__input"
                value={weeklyTarget}
                onChange={(e) => onSetCadence(Number(e.target.value))}
              >
                <option value={0}>Every day</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}× a week
                  </option>
                ))}
              </select>
              <span className="field__hint">
                {weeklyTarget >= 1
                  ? `Aim for ${weeklyTarget} day${weeklyTarget === 1 ? '' : 's'} each week. This week: ${
                      action ? weekCompletions(action, new Date()) : 0
                    } / ${weeklyTarget}.`
                  : 'Check it off every day.'}
              </span>
            </label>

            <div className="field">
              <label className="switch">
                <input
                  type="checkbox"
                  className="switch__input"
                  role="switch"
                  checked={established}
                  onChange={(e) => onSetEstablished(e.target.checked)}
                />
                <span className="switch__track" aria-hidden="true" />
                <span className="switch__label">Mark as established — no more check-ins</span>
              </label>
              <span className="field__hint">
                {established
                  ? 'This habit is achieved: it counts as done and stops asking for check-ins. Turn off to resume tracking.'
                  : 'When a habit is second nature, establish it. It counts as done toward your progress.'}
                {completionCount > 0 &&
                  ` ${completionCount} check-in${completionCount === 1 ? '' : 's'} recorded.`}
              </span>
            </div>
          </>
        ) : (
          <div className="field">
            <span className="field__label" id="detail-status-label">
              Status
            </span>
            <div
              className="status-seg"
              role="group"
              aria-labelledby="detail-status-label"
            >
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`status-seg__btn status-seg__btn--${s} ${
                    status === s ? 'is-active' : ''
                  }`.trim()}
                  aria-pressed={status === s}
                  onClick={() => onSetStatus(s)}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {action?.completedAt && (
              <span className="field__hint">
                Completed {new Date(action.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
