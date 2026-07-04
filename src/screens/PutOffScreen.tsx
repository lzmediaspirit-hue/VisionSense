import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, ScreenHeader } from "../components/ui";
import { Field, TextInput } from "../components/form";
import { strings } from "../copy/strings";
import { openPutOffItems, putOffHistory } from "../lib/selectors";
import { useStore } from "../state/store";
import type { PutOffItem } from "../types";

/**
 * Put-off list (engineering-plan feature #12, technique #5): a simple
 * recurring list of things you've been putting off. Clearing an item is an
 * ATFT win (feeds the Self-Trust ledger + Evidence log); letting an item go
 * is a neutral release, same shape as Mental Nudges — never a penalty for an
 * un-cleared item.
 */
export function PutOffScreen() {
  const addPutOffItem = useStore((s) => s.addPutOffItem);
  const clearPutOffItem = useStore((s) => s.clearPutOffItem);
  const releasePutOffItem = useStore((s) => s.releasePutOffItem);
  const open = useStore(openPutOffItems);
  const history = useStore(putOffHistory);

  const [text, setText] = useState("");
  const c = strings.putOff;

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addPutOffItem(trimmed);
    setText("");
  }

  return (
    <div>
      <Link to="/today" className="mb-3 inline-block text-sm text-accent-deep hover:underline">
        {c.backToToday}
      </Link>
      <ScreenHeader title={c.title} subtitle={c.subtitle} />

      <Card className="mb-6">
        <Field label={c.addLabel} htmlFor="putoff-text">
          <div className="flex gap-2">
            <TextInput
              id="putoff-text"
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
                {open.map((item) => (
                  <OpenPutOffRow
                    key={item.id}
                    item={item}
                    onClear={() => clearPutOffItem(item.id)}
                    onRelease={() => releasePutOffItem(item.id)}
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
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-line bg-paper-raised/60 p-3 text-sm"
                  >
                    <p className="text-ink-soft">{item.text}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {item.clearedAt != null ? c.clearedLabel : c.releasedLabel}
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

function OpenPutOffRow({
  item,
  onClear,
  onRelease,
}: {
  item: PutOffItem;
  onClear: () => void;
  onRelease: () => void;
}) {
  const c = strings.putOff;
  return (
    <li className="rounded-xl border border-line bg-paper-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-ink">{item.text}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={onClear}>
            {c.clearButton}
          </Button>
          <Button variant="ghost" onClick={onRelease}>
            {c.releaseButton}
          </Button>
        </div>
      </div>
    </li>
  );
}
