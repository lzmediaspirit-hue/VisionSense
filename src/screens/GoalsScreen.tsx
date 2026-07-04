import { Link, useNavigate } from "react-router-dom";
import { Button, EmptyState, ScreenHeader } from "../components/ui";
import { strings } from "../copy/strings";
import { activeDesiredRealities } from "../lib/selectors";
import { useStore } from "../state/store";

/** Desired Realities list. */
export function GoalsScreen() {
  const navigate = useNavigate();
  const realities = useStore(activeDesiredRealities);

  return (
    <div>
      <ScreenHeader title={strings.goals.title} subtitle={strings.goals.subtitle} />

      {realities.length === 0 ? (
        <EmptyState
          title={strings.goals.empty}
          action={
            <Button onClick={() => navigate("/goals/new")}>
              {strings.goals.addButton}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {realities.map((dr) => (
              <li key={dr.id}>
                <Link
                  to={`/goals/${dr.id}`}
                  className="block rounded-2xl border border-line bg-paper-raised p-4 transition-colors duration-200 ease-calm hover:border-line-strong animate-gentle-fade"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-medium text-ink">{dr.title}</h2>
                    {dr.normalizeIt ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">
                        {strings.goals.normalizeOnTag}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {strings.goals.feelingTagPrefix}
                    {dr.targetFeeling}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Button variant="secondary" onClick={() => navigate("/goals/new")}>
              {strings.goals.addButton}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
