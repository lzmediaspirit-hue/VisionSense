import { useEffect } from 'react';

/**
 * A single celebration toast. `kind` selects the copy + glyph:
 *   - 'reward'    — "Reward unlocked: {message}" (SPEC 7.3), fired on each
 *                   task completion and each habit daily check.
 *   - 'establish' — "Habit established: {message}" (SPEC 8.2), the graduation
 *                   moment when a habit is first marked established.
 */
export interface RewardToastData {
  /** Fresh id per firing so re-triggering the same toast restarts the timer. */
  id: number;
  kind: 'reward' | 'establish';
  /** The reward text (reward kind) or the habit title (establish kind). */
  message: string;
}

interface RewardToastProps {
  toast: RewardToastData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

/**
 * Celebration toast (SPEC 7.3 + 8.2). Quiet and tasteful: one at a time,
 * auto-dismisses after ~5s, manually dismissible, announced via aria-live
 * polite, and honours prefers-reduced-motion (the entrance animation is gated
 * in CSS). Rendered as a live region that is always present so screen readers
 * pick up the change even as content swaps in.
 */
export function RewardToast({ toast, onDismiss }: RewardToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const isEstablish = toast?.kind === 'establish';

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div className={`toast ${isEstablish ? 'toast--establish' : ''}`.trim()} role="status" key={toast.id}>
          <span className="toast__glyph" aria-hidden="true">
            {isEstablish ? (
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
            {isEstablish ? 'Habit established: ' : 'Reward unlocked: '}
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
