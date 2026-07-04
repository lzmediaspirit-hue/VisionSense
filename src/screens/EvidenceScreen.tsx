import { ScreenHeader, EmptyState } from "../components/ui";
import { strings } from "../copy/strings";
import { useStore } from "../state/store";

/**
 * Evidence / Wins log. Full aggregation feed arrives in Phase 2 (M4); for now
 * it lists any manually/derived evidence entries and otherwise stays a calm,
 * affirming landing spot (the reframe screen's "past wins" CTA lands here).
 */
export function EvidenceScreen() {
  const entries = useStore((s) => s.evidenceEntries);
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);

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
              <p className="mt-1 text-xs text-ink-faint">{e.dateKey}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
