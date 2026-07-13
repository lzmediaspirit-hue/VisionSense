import { useEffect } from 'react';

/**
 * A single celebration toast. `kind` selects the copy + glyph:
 *   - 'reward'    — "Reward unlocked: {message}" (SPEC 7.3), fired on each
 *                   task completion and each habit daily check.
 *   - 'establish' — "Habit established: {message}" (SPEC 8.2), the graduation
 *                   moment when a habit is first marked established.
 *   - 'pillar'    — "Pillar complete: {message}" (v1.10, SPEC 17), fired once
 *                   when a pillar's 8 actions all become filled and done.
 */
export interface RewardToastData {
  /** Fresh id per firing so re-triggering the same toast restarts the timer. */
  id: number;
  kind: 'reward' | 'establish' | 'pillar';
  /** The reward text (reward kind), habit title (establish kind), or pillar name (pillar kind). */
  message: string;
  /** Optional accent color (e.g. the pillar's color) for the toast's left border (v1.10). */
  accent?: string;
}

interface RewardToastProps {
  toast: RewardToastData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

/**
 * Celebration toast (SPEC 7.3 + 8.2 + 17). Quiet and tasteful: one at a time,
 * auto-dismisses after ~5s, manually dismissible, announced via aria-live
 * polite, and honours prefers-reduced-motion (the entrance animation is gated
 * in CSS). Rendered as a live region that is always present so screen readers
 * pick up the change even as content swaps in. An optional `accent` (v1.10)
 * paints a colored left border via `--toast-accent`.
 */
export function RewardToast({ toast, onDismiss }: RewardToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const kind = toast?.kind;
  const prefix =
    kind === 'establish' ? 'Habit established: ' : kind === 'pillar' ? 'Pillar complete: ' : 'Reward unlocked: ';
  const style =
    toast?.accent !== undefined ? ({ ['--toast-accent' as string]: toast.accent } as React.CSSProperties) : undefined;

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div
          className={[
            'toast',
            kind === 'establish' ? 'toast--establish' : '',
            kind === 'pillar' ? 'toast--pillar' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={style}
          role="status"
          key={toast.id}
        >
          <span className="toast__glyph" aria-hidden="true">
            {kind === 'establish' ? (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="12" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M9 10l2 2 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 15.5L8 21l4-2 4 2-1.5-5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            ) : kind === 'pillar' ? (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M12 2l2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 15.4 6.8 18.2l1-5.8L3.5 8.2l5.9-.9L12 2z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M12 3l2.3 4.7 5.2.8-3.8 3.6.9 5.1L12 15l-4.6 2.4.9-5.1L4.5 8.5l5.2-.8L12 3z"
                  fill="currentColor"
                />
              </svg>
            )}
          </span>
          <span className="toast__text">
            {prefix}
            <strong>{toast.message}</strong>
          </span>
          <button
            type="button"
            className="toast__close"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </div>
  );
}
