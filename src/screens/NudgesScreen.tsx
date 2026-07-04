import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, ScreenHeader } from "../components/ui";
import { Field, TextInput } from "../components/form";
import { strings } from "../copy/strings";
import { nudgeHistory, openNudges } from "../lib/selectors";
import { useStore } from "../state/store";
import type { MentalNudge } from "../types";

/**
 * Mental Nudges inbox: quick-add (single field, <5s flow), the open list with
 * act-on/release actions, and a calm history of resolved nudges.
 */
export function NudgesScreen() {
  const addMentalNudge = useStore((s) => s.addMentalNudge);
  const markNudgeActedOn = useStore((s) => s.markNudgeActedOn);
  const releaseNudge = useStore((s) => s.releaseNudge);
  const open = useStore(openNudges);
  const history = useStore(nudgeHistory);

  const [text, setText] = useState("");
  const c = strings.nudges;

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addMentalNudge(trimmed);
    setText("");
  }

  return (
    <div>
      <Link to="/today" className="mb-3 inline-block text-sm text-accent-deep hover:underline">
        {c.backToToday}
      </Link>
      <ScreenHeader title={c.title} subtitle={c.subtitle} />

      <Card className="mb-6">
        <Field label={c.addLabel} htmlFor="nudge-text">
          <div className="flex gap-2">
            <TextInput
              id="nudge-text"
              value={text}
              placeholder={c.addPlaceholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <Button onClick={submit}>{c.addButton}</Button>
          </div>
        </Field>
      </Card>

      {open.length === 0 && history.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <div className="space-y-6">
          {open.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {c.openHeading}
              </h2>
              <ul className="space-y-2">
                {open.map((n) => (
                  <OpenNudgeRow
                    key={n.id}
                    nudge={n}
                    onActOn={() => markNudgeActedOn(n.id)}
                    onRelease={() => releaseNudge(n.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {history.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {c.historyHeading}
              </h2>
              <ul className="space-y-2">
                {history.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-line bg-paper-raised/60 p-3 text-sm"
                  >
                    <p className="text-ink-soft">{n.text}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {n.status === "actedOn" ? c.actedOnLabel : c.releasedLabel}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function OpenNudgeRow({
  nudge,
  onActOn,
  onRelease,
}: {
  nudge: MentalNudge;
  onActOn: () => void;
  onRelease: () => void;
}) {
  const c = strings.nudges;
  return (
    <li className="rounded-xl border border-line bg-paper-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-ink">{nudge.text}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={onActOn}>
            {c.actedOnButton}
          </Button>
          <Button variant="ghost" onClick={onRelease}>
            {c.releaseButton}
          </Button>
        </div>
      </div>
    </li>
  );
}
