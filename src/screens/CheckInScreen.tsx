import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ScreenHeader } from "../components/ui";
import { Field, TextArea, TextInput } from "../components/form";
import { strings } from "../copy/strings";
import { useStore } from "../state/store";

type Step = "baseState" | "note" | "saved";

/**
 * Daily base-state check-in. One question per screen (C7), launched from Today.
 * A simple step-dot indicator orients the user — no countdown/urgency styling.
 */
export function CheckInScreen() {
  const navigate = useNavigate();
  const addCheckIn = useStore((s) => s.addCheckIn);

  const [step, setStep] = useState<Step>("baseState");
  const [baseState, setBaseState] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  const c = strings.checkIn;

  function goToNote() {
    if (!baseState.trim()) {
      setError(c.baseStateRequired);
      return;
    }
    setError(undefined);
    setStep("note");
  }

  function finish() {
    addCheckIn({
      baseState: baseState.trim(),
      note: note.trim() || undefined,
    });
    setStep("saved");
  }

  return (
    <div>
      <ScreenHeader title={c.title} />

      {step !== "saved" ? (
        <StepDots active={step === "baseState" ? 0 : 1} total={2} />
      ) : null}

      {step === "baseState" ? (
        <div className="animate-gentle-fade">
          <Field
            label={c.stepBaseStateQuestion}
            hint={c.stepBaseStateHint}
            htmlFor="checkin-base"
            error={error}
          >
            <TextInput
              id="checkin-base"
              value={baseState}
              placeholder={c.stepBaseStatePlaceholder}
              onChange={(e) => setBaseState(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="mt-6 flex gap-3">
            <Button onClick={goToNote}>{c.next}</Button>
            <Button variant="secondary" onClick={() => navigate("/today")}>
              {strings.common.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "note" ? (
        <div className="animate-gentle-fade">
          <Field label={c.stepNoteQuestion} htmlFor="checkin-note">
            <TextArea
              id="checkin-note"
              value={note}
              placeholder={c.stepNotePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="mt-6 flex gap-3">
            <Button onClick={finish}>{c.finish}</Button>
            <Button variant="secondary" onClick={() => setStep("baseState")}>
              {c.back}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "saved" ? (
        <div className="animate-gentle-fade rounded-2xl border border-line bg-paper-raised p-6 text-center">
          <p className="text-base font-medium text-ink">{c.savedTitle}</p>
          <p className="mt-2 text-sm text-ink-soft">{c.savedBody}</p>
          <div className="mt-5 flex justify-center">
            <Button onClick={() => navigate("/today")}>{c.done}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepDots({ active, total }: { active: number; total: number }) {
  return (
    <div
      className="mb-5 flex items-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={active + 1}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={[
            "h-2 rounded-full transition-all duration-200 ease-calm",
            i === active ? "w-6 bg-accent" : "w-2 bg-line-strong",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
