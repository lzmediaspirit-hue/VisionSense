import { ScreenHeader, EmptyState } from "../components/ui";
import { strings } from "../copy/strings";
import { evidenceFeed } from "../lib/selectors";
import { useStore } from "../state/store";
import type { EvidenceSourceType } from "../types";

const SOURCE_LABEL: Record<EvidenceSourceType, string> = {
  habitCompletion: strings.evidence.sourceHabitCompletion,
  exerciseSession: strings.evidence.sourceExerciseSession,
  mentalNudgeActedOn: strings.evidence.sourceMentalNudgeActedOn,
  putOffItemCleared: strings.evidence.sourcePutOffItemCleared,
  manualEntry: strings.evidence.sourceManualEntry,
};

/**
 * Evidence / Wins log: a reverse-chronological feed aggregating every
 * EvidenceEntry — auto-generated for kept habit completions and acted-on
 * nudges (store.ts), plus the free-text evidence logged in Polarity
 * Transmutation. Framed entirely as wins; there is no failure counterpart.
 */
export function EvidenceScreen() {
  const sorted = useStore(evidenceFeed);

  return (
    <div>
      <ScreenHeader title={strings.evidence.title} subtitle={strings.evidence.subtitle} />
      {sorted.length === 0 ? (
        <EmptyState title={strings.evidence.empty} body={strings.evidence.comingSoon} />
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border border-line bg-paper-raised p-4 animate-gentle-fade"
            >
              <p className="text-sm text-ink">{e.text}</p>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
                <span>{e.dateKey}</span>
                <span
                  className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-ink"
                >
                  {SOURCE_LABEL[e.sourceType]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
