import { useEffect, useState } from "react";
import { Button } from "./ui";
import { strings } from "../copy/strings";

/** 60-120s band per engineering-plan §1 feature #13 (C9). */
const GATE_DURATION_MS = 90_000;

/**
 * Relax-first gate (C9): a brief stillness screen inserted before the
 * exercise runner shows its first step. No numeric countdown — the progress
 * bar and a slow breathing pulse orient without introducing urgency (T3).
 * Auto-advances at the end of the duration, or the user can skip explicitly
 * at any time. Whichever exercise session is already underway (started on
 * route entry, per M4) is untouched here; the caller stamps
 * `relaxGateCompletedAt` only when this component calls `onComplete`.
 */
export function RelaxGate({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const c = strings.relaxGate;

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Math.min(GATE_DURATION_MS, Date.now() - start));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (elapsedMs >= GATE_DURATION_MS) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs]);

  const progress = elapsedMs / GATE_DURATION_MS;
  const pulseScale = 0.85 + 0.15 * Math.sin(elapsedMs / 1800);

  return (
    <div className="mx-auto w-full max-w-[560px] animate-gentle-fade text-center">
      <p className="text-lg font-medium text-ink">{c.title}</p>
      <p className="mt-2 text-sm text-ink-soft">{c.body}</p>

      <div className="my-10 flex items-center justify-center" aria-hidden="true">
        <div
          className="h-32 w-32 rounded-full bg-accent-soft"
          style={{
            transform: `scale(${pulseScale})`,
            transition: "transform 250ms linear",
          }}
        />
      </div>

      <div
        className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-paper-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={c.title}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-calm"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-8 flex justify-center">
        <Button variant="ghost" onClick={onSkip}>
          {c.skipButton}
        </Button>
      </div>
    </div>
  );
}
