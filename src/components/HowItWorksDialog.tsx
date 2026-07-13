import { useEffect, useRef, useState } from 'react';

interface HowItWorksDialogProps {
  open: boolean;
  onClose: () => void;
  /** Jump straight to the seeded example chart, when one exists (v1.6, SPEC 13). */
  onOpenExample?: () => void;
}

type Step = 0 | 1 | 2;

const STEP_TITLES: Record<Step, string> = {
  0: 'Name your goal',
  1: 'Choose 8 pillars',
  2: 'Break each into 8 actions',
};

const STEP_TEXT: Record<Step, string> = {
  0: 'One goal at the centre. Everything on the chart exists to serve it.',
  1: 'Exactly 8 pillars — the Rule of 8 forces you to choose what matters.',
  2: 'Each pillar gets 8 concrete actions — 64 in all. Make them habits with a when-and-where, and check them off from Today.',
};

/** The pillar slot (of the 8 tiles surrounding the center) that "explodes"
 * into its 8 actions on step 2 — a fixed slot is enough to teach the idea. */
const EXPLODING_SLOT = 0;

/** Map a 3x3 grid position (0..8) to a pillar slot (0..7), skipping the
 * center at position 4. */
function pillarSlotForPosition(position: number): number {
  return position < 4 ? position : position - 1;
}

/**
 * "How it works" explainer (v1.6, SPEC 13; restructured v1.10, SPEC 17): a
 * native <dialog> modal reachable from the dashboard header's "?" button, and
 * auto-shown once on first run. Reuses the ConfirmDialog/TemplatePicker modal
 * pattern — Esc / backdrop click both dismiss via the dialog's native 'close'
 * event.
 *
 * The body is a 3-step animated diagram rather than a wall of prose: the
 * centre goal tile lights up, then the 8 surrounding pillar tiles take their
 * colors, then one pillar tile "explodes" into a second mini-grid of 8
 * pulsing action tiles. Step dots and a "Next" button drive it; each step
 * carries exactly one sentence.
 */
export function HowItWorksDialog({ open, onClose, onOpenExample }: HowItWorksDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>(0);

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

  // Always start the sequence over from step 0 on each fresh open.
  useEffect(() => {
    if (open) setStep(0);
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
          <div className="hiw-stage-wrap">
            <div className={`hiw-stage hiw-stage--step${step}`} aria-hidden="true">
              {Array.from({ length: 9 }, (_, position) => {
                if (position === 4) {
                  return <span key={position} className="hiw-mini hiw-mini--goal" />;
                }
                const slot = pillarSlotForPosition(position);
                if (step === 0) {
                  return <span key={position} className="hiw-mini hiw-mini--dim" />;
                }
                const exploding = step === 2 && slot === EXPLODING_SLOT;
                return (
                  <span
                    key={position}
                    className={`hiw-mini hiw-mini--pillar${exploding ? ' hiw-mini--exploding' : ''}`}
                    style={{ ['--hiw-pillar-color' as string]: `var(--pillar-color-${slot})` }}
                  />
                );
              })}
            </div>

            {step === 2 && (
              <div className="hiw-actions" aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <span
                    key={i}
                    className={i === 4 ? 'hiw-mini hiw-mini--pillar-solid' : 'hiw-mini hiw-mini--action'}
                    style={{
                      ['--hiw-pillar-color' as string]: `var(--pillar-color-${EXPLODING_SLOT})`,
                      animationDelay: i === 4 ? undefined : `${i * 40}ms`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hiw__body">
            <h3 className="hiw__heading">{STEP_TITLES[step]}</h3>
            <p className="hiw__text">{STEP_TEXT[step]}</p>

            <div className="hiw-dots" role="group" aria-label="How it works steps">
              {([0, 1, 2] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`hiw-dot${i === step ? ' is-active' : ''}`}
                  aria-label={`Step ${i + 1}`}
                  aria-current={i === step}
                  onClick={() => setStep(i)}
                />
              ))}
              {step < 2 && (
                <button
                  type="button"
                  className="btn btn--ghost hiw-next"
                  onClick={() => setStep((s) => (s + 1) as Step)}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="hiw__text hiw__text--loop">
          Turn any action into a habit with a when-and-where cue and a reward. The{' '}
          <strong>Today</strong> view surfaces your top picks each day; the{' '}
          <strong>Weekly review</strong> keeps you honest.
        </p>

        <p className="hiw-footnote">
          Your data lives on this device — optional Google Drive sync backs it up to your own
          Drive.
        </p>

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
