import { useState } from "react";
import { Button } from "./ui";
import { Field, TextArea } from "./form";
import type { ExerciseConfig, ExerciseStepConfig } from "../lib/exerciseConfigs";

/**
 * Generic, full-screen guided-exercise player: one step per screen, linear
 * next/back, free-text inputs, driven entirely by a step-config array
 * (see lib/exerciseConfigs.ts). Polarity Transmutation is the only config in
 * this phase; a future Technique/Emotional Alchemy config reuses this same
 * component untouched (engineering-plan §7 risk #3 guardrail).
 */
export function ExerciseRunner({
  config,
  onComplete,
  onExit,
}: {
  config: ExerciseConfig;
  onComplete: (values: Record<string, string[]>) => void;
  onExit: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      config.steps.map((s) => [s.key, Array.from({ length: s.minItems ?? 1 }, () => "")])
    )
  );
  const [error, setError] = useState<string | undefined>();
  const [completed, setCompleted] = useState(false);

  const step = config.steps[stepIndex];
  const isLast = stepIndex === config.steps.length - 1;

  function itemsFor(key: string): string[] {
    return values[key] ?? [""];
  }

  function setItem(key: string, index: number, value: string) {
    setValues((v) => {
      const next = [...(v[key] ?? [""])];
      next[index] = value;
      return { ...v, [key]: next };
    });
  }

  function addItem(key: string) {
    setValues((v) => ({ ...v, [key]: [...(v[key] ?? [""]), ""] }));
  }

  function removeItem(key: string, index: number) {
    setValues((v) => {
      const next = (v[key] ?? [""]).filter((_, i) => i !== index);
      return { ...v, [key]: next.length > 0 ? next : [""] };
    });
  }

  function validate(s: ExerciseStepConfig): boolean {
    const filled = itemsFor(s.key).map((t) => t.trim()).filter((t) => t.length > 0);
    const min = s.minItems ?? 1;
    return filled.length >= min;
  }

  function goNext() {
    if (!validate(step)) {
      setError(step.requiredMessage);
      return;
    }
    setError(undefined);
    if (isLast) {
      const finalValues = Object.fromEntries(
        config.steps.map((s) => [
          s.key,
          itemsFor(s.key).map((t) => t.trim()).filter((t) => t.length > 0),
        ])
      );
      onComplete(finalValues);
      setCompleted(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    setError(undefined);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (completed) {
    return (
      <div className="animate-gentle-fade rounded-2xl border border-line bg-paper-raised p-6 text-center">
        <p className="text-base font-medium text-ink">{config.completedTitle}</p>
        <p className="mt-2 text-sm text-ink-soft">{config.completedBody}</p>
        <div className="mt-5 flex justify-center">
          <Button onClick={onExit}>{config.done}</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepDots active={stepIndex} total={config.steps.length} />

      <div key={step.key} className="animate-gentle-fade">
        {step.kind === "text" ? (
          <Field label={step.prompt} hint={step.hint} htmlFor={`step-${step.key}`} error={error}>
            <TextArea
              id={`step-${step.key}`}
              value={itemsFor(step.key)[0]}
              placeholder={step.placeholder}
              onChange={(e) => setItem(step.key, 0, e.target.value)}
              autoFocus
            />
            {step.suggestions && step.suggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {step.suggestions.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => setItem(step.key, 0, word)}
                    className="rounded-full border border-line bg-paper-sunken px-3 py-1 text-xs text-ink-soft transition-colors duration-200 ease-calm hover:border-line-strong hover:text-ink"
                  >
                    {word}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
        ) : (
          <Field label={step.prompt} hint={step.hint} error={error}>
            <div className="space-y-2">
              {itemsFor(step.key).map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <TextArea
                    aria-label={`${step.prompt} ${i + 1}`}
                    value={text}
                    placeholder={step.placeholder}
                    onChange={(e) => setItem(step.key, i, e.target.value)}
                    autoFocus={i === 0}
                  />
                  {itemsFor(step.key).length > (step.minItems ?? 1) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`${config.removeLabel} ${i + 1}`}
                      onClick={() => removeItem(step.key, i)}
                    >
                      ×
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {itemsFor(step.key).length < (step.maxItems ?? 1) ? (
              <div className="mt-3">
                <Button type="button" variant="secondary" onClick={() => addItem(step.key)}>
                  {config.addAnotherLabel}
                </Button>
              </div>
            ) : null}
          </Field>
        )}

        <div className="mt-6 flex gap-3">
          <Button onClick={goNext}>{isLast ? config.finish : config.next}</Button>
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={goBack}>
              {config.back}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onExit}>
              {config.exitButton}
            </Button>
          )}
        </div>
      </div>
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
