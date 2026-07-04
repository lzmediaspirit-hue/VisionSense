import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScreenHeader } from "../components/ui";
import { ExerciseRunner } from "../components/ExerciseRunner";
import { EXERCISE_SLUGS, getExerciseConfig } from "../lib/exerciseConfigs";
import { useStore } from "../state/store";
import type { ExerciseStepEntry } from "../types";

/**
 * Route wrapper: `/exercises/:slug` picks the matching step-config and starts
 * an ExerciseSession immediately on mount (so an abandoned session — the user
 * navigates away mid-flow — is captured with no `completedAt`, per M4 spec).
 * Only Polarity Transmutation is registered today; a future exercise is a new
 * entry in lib/exerciseConfigs.ts, not a new screen.
 */
export function ExerciseRunnerScreen() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const type = slug ? EXERCISE_SLUGS[slug] : undefined;
  const config = type ? getExerciseConfig(type) : undefined;

  const startExerciseSession = useStore((s) => s.startExerciseSession);
  const completeExerciseSession = useStore((s) => s.completeExerciseSession);
  const [sessionId, setSessionId] = useState<string | undefined>();
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

  return (
    <div>
      <ScreenHeader title={config.title} subtitle={config.hint} />
      <ExerciseRunner
        config={config}
        onComplete={handleComplete}
        onExit={() => navigate("/today")}
      />
    </div>
  );
}
