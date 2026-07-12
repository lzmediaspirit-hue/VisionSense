import { useEffect } from 'react';

export interface RewardToastData {
  /** Fresh id per firing so re-triggering the same reward restarts the timer. */
  id: number;
  reward: string;
}

interface RewardToastProps {
  toast: RewardToastData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

/**
 * Reward celebration toast (SPEC 7.3). Quiet and tasteful: one at a time,
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

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span className="toast__glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                d="M12 3l2.3 4.7 5.2.8-3.8 3.6.9 5.1L12 15l-4.6 2.4.9-5.1L4.5 8.5l5.2-.8L12 3z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="toast__text">
            Reward unlocked: <strong>{toast.reward}</strong>
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
