import { useEffect, useRef } from 'react';

interface HowItWorksDialogProps {
  open: boolean;
  onClose: () => void;
  /** Jump straight to the seeded example chart, when one exists (v1.6, SPEC 13). */
  onOpenExample?: () => void;
}

/**
 * "How it works" explainer (v1.6, SPEC 13): a native <dialog> modal reachable
 * from the dashboard header's "?" button, and auto-shown once on first run.
 * Reuses the ConfirmDialog/TemplatePicker modal pattern — Esc / backdrop
 * click both dismiss via the dialog's native 'close' event.
 */
export function HowItWorksDialog({ open, onClose, onOpenExample }: HowItWorksDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

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

  return (
    <dialog
      ref={ref}
      className="modal-overlay"
      aria-label="How it works"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="modal modal--wide">
        <div className="modal__header">
          <h2 className="modal__title">How it works</h2>
          <button
            type="button"
            className="btn btn--ghost modal__close"
            onClick={() => ref.current?.close()}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="hiw">
          <div className="hiw__mini" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={i === 4 ? 'hiw__cell hiw__cell--center' : 'hiw__cell'} />
            ))}
          </div>

          <div className="hiw__body">
            <h3 className="hiw__heading">What is a Mandala chart?</h3>
            <p className="hiw__text">
              One goal at the centre, surrounded by exactly 8 pillars, each with 8 concrete
              actions — 64 in all. The Rule of 8 forces you to choose what matters.
            </p>

            <h3 className="hiw__heading">Build it in 3 steps</h3>
            <p className="hiw__text">
              1) Name your goal (the centre). 2) Name your 8 pillars. 3) Fill in 8 actions
              under each.
            </p>

            <h3 className="hiw__heading">Make it a routine</h3>
            <p className="hiw__text">
              Turn any action into a habit — every day, or a few set days a week — pre-decide{' '}
              <em>when and where</em> you&apos;ll act, and give yourself a reward.
            </p>

            <h3 className="hiw__heading">Stay on track</h3>
            <p className="hiw__text">
              The <strong>Today</strong> view picks your top 3 and checks off habits; the{' '}
              <strong>Weekly review</strong> keeps you honest.
            </p>

            <h3 className="hiw__heading">Your data</h3>
            <p className="hiw__text">
              Lives on this device; optional Google Drive sync backs it up to your own Drive.
            </p>
          </div>
        </div>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>
            Got it
          </button>
          {onOpenExample && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                onOpenExample();
                ref.current?.close();
              }}
            >
              Explore the example
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
