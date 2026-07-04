import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScreenHeader } from "../components/ui";
import { ExerciseRunner } from "../components/ExerciseRunner";
import { RelaxGate } from "../components/RelaxGate";
import { EXERCISE_SLUGS, getExerciseConfig } from "../lib/exerciseConfigs";
import { useStore } from "../state/store";
import type { ExerciseStepEntry } from "../types";

/**
 * Route wrapper: `/exercises/:slug` picks the matching step-config and starts
 * an ExerciseSession immediately on mount (so an abandoned session — the user
 * navigates away mid-flow — is captured with no `completedAt`, per M4 spec).
 * Only Polarity Transmutation is registered today; a future exercise is a new
 * entry in lib/exerciseConfigs.ts, not a new screen.
 *
 * M5 inserts the relax-first gate (C9) here, between the session starting and
 * the runner's first step, respecting `settings.relaxGateEnabled`. The
 * session itself always starts immediately regardless of the gate, so an
 * abandoned session (user exits during the gate) is still captured correctly.
 */
export function ExerciseRunnerScreen() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const type = slug ? EXERCISE_SLUGS[slug] : undefined;
  const config = type ? getExerciseConfig(type) : undefined;

  const startExerciseSession = useStore((s) => s.startExerciseSession);
  const completeExerciseSession = useStore((s) => s.completeExerciseSession);
  const completeRelaxGate = useStore((s) => s.completeRelaxGate);
  const relaxGateEnabled = useStore((s) => s.settings.relaxGateEnabled);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [gatePassed, setGatePassed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!type || started.current) return;
    started.current = true;
    const session = startExerciseSession({ type });
    setSessionId(session.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (!config || !sessionId) {
    return null;
  }

  function handleComplete(values: Record<string, string[]>) {
    const steps: ExerciseStepEntry[] = Object.entries(values).flatMap(([stepKey, items]) =>
      items.map((value) => ({ stepKey, value }))
    );
    const evidenceTexts = values.logEvidence ?? [];
    completeExerciseSession(sessionId as string, steps, evidenceTexts);
  }

  // Reflective flow: a single centered ~560px column at every width, even
  // when the desktop shell offers more room (engineering-plan §3).
  if (relaxGateEnabled && !gatePassed) {
    return (
      <div className="mx-auto w-full max-w-[560px]">
        <ScreenHeader title={config.title} />
        <RelaxGate
          onComplete={() => {
            completeRelaxGate(sessionId);
            setGatePassed(true);
          }}
          onSkip={() => setGatePassed(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <ScreenHeader title={config.title} subtitle={config.hint} />
      <ExerciseRunner
        config={config}
        onComplete={handleComplete}
        onExit={() => navigate("/today")}
      />
    </div>
  );
}
