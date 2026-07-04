import type { ExerciseType } from "../types";
import { strings } from "../copy/strings";

/**
 * Generic exercise-runner step configs. Each guided exercise (Polarity
 * Transmutation now; Technique/Emotional Alchemy in later phases per
 * engineering-plan §2 Phase A) is a new config entry here, not a new screen —
 * see components/ExerciseRunner.tsx, which is the single reusable player.
 */
export type ExerciseStepKind = "text" | "multiText";

export interface ExerciseStepConfig {
  /** Stored as ExerciseStepEntry.stepKey. */
  key: string;
  kind: ExerciseStepKind;
  prompt: string;
  hint?: string;
  placeholder?: string;
  /** Tappable single-word/phrase suggestions that fill the field (still editable). */
  suggestions?: readonly string[];
  /** multiText only: how many free-text items this step collects (1-3 for Evidence). */
  minItems?: number;
  maxItems?: number;
  requiredMessage: string;
}

export interface ExerciseConfig {
  type: ExerciseType;
  title: string;
  hint: string;
  startButton: string;
  exitButton: string;
  next: string;
  back: string;
  finish: string;
  completedTitle: string;
  completedBody: string;
  done: string;
  addAnotherLabel: string;
  removeLabel: string;
  steps: ExerciseStepConfig[];
}

const polarityTransmutation: ExerciseConfig = {
  type: "polarityTransmutation",
  title: strings.exercises.polarityTransmutation.entryTitle,
  hint: strings.exercises.polarityTransmutation.entryHint,
  startButton: strings.exercises.polarityTransmutation.startButton,
  exitButton: strings.exercises.polarityTransmutation.exitButton,
  next: strings.exercises.polarityTransmutation.next,
  back: strings.exercises.polarityTransmutation.back,
  finish: strings.exercises.polarityTransmutation.finish,
  completedTitle: strings.exercises.polarityTransmutation.completedTitle,
  completedBody: strings.exercises.polarityTransmutation.completedBody,
  done: strings.exercises.polarityTransmutation.done,
  addAnotherLabel: strings.exercises.polarityTransmutation.addAnotherEvidence,
  removeLabel: strings.exercises.polarityTransmutation.removeEvidence,
  steps: [
    {
      key: "nameFeeling",
      kind: "text",
      prompt: strings.exercises.polarityTransmutation.stepFeelingPrompt,
      hint: strings.exercises.polarityTransmutation.stepFeelingHint,
      placeholder: strings.exercises.polarityTransmutation.stepFeelingPlaceholder,
      requiredMessage: strings.exercises.polarityTransmutation.feelingRequired,
    },
    {
      key: "nameOppositePolarity",
      kind: "text",
      prompt: strings.exercises.polarityTransmutation.stepPolarityPrompt,
      hint: strings.exercises.polarityTransmutation.stepPolarityHint,
      placeholder: strings.exercises.polarityTransmutation.stepPolarityPlaceholder,
      suggestions: strings.exercises.polaritySuggestions,
      requiredMessage: strings.exercises.polarityTransmutation.polarityRequired,
    },
    {
      key: "logEvidence",
      kind: "multiText",
      prompt: strings.exercises.polarityTransmutation.stepEvidencePrompt,
      hint: strings.exercises.polarityTransmutation.stepEvidenceHint,
      placeholder: strings.exercises.polarityTransmutation.stepEvidencePlaceholder,
      minItems: 1,
      maxItems: 3,
      requiredMessage: strings.exercises.polarityTransmutation.evidenceRequired,
    },
  ],
};

const EXERCISE_CONFIGS: Partial<Record<ExerciseType, ExerciseConfig>> = {
  polarityTransmutation,
};

export function getExerciseConfig(type: ExerciseType): ExerciseConfig | undefined {
  return EXERCISE_CONFIGS[type];
}

/** URL-slug <-> ExerciseType mapping used by the /exercises/:slug route. */
export const EXERCISE_SLUGS: Record<string, ExerciseType> = {
  "polarity-transmutation": "polarityTransmutation",
};

export function slugForExerciseType(type: ExerciseType): string {
  return Object.keys(EXERCISE_SLUGS).find((slug) => EXERCISE_SLUGS[slug] === type) ?? type;
}
