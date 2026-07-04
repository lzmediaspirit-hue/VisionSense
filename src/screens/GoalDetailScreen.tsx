import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, EmptyState, ScreenHeader } from "../components/ui";
import { strings } from "../copy/strings";
import { desiredRealityById, habitsForReality } from "../lib/selectors";
import { useStore } from "../state/store";
import type { Habit } from "../types";

/** Detail view of one Desired Reality: its habits grouped inner-first. */
export function GoalDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dr = useStore((s) => desiredRealityById(s, id));
  const habits = useStore((s) => (id ? habitsForReality(s, id) : []));
  const archiveDesiredReality = useStore((s) => s.archiveDesiredReality);

  if (!dr) {
    return (
      <div>
        <ScreenHeader title={strings.goals.title} />
        <EmptyState
          title={strings.goals.notFound}
          action={
            <Button variant="secondary" onClick={() => navigate("/goals")}>
              {strings.goals.backToGoals}
            </Button>
          }
        />
      </div>
    );
  }

  const inner = habits.filter((h) => h.tier === "inner");
  const outer = habits.filter((h) => h.tier === "outer");

  function handleArchive() {
    if (window.confirm(strings.goals.archiveConfirm)) {
      archiveDesiredReality(dr!.id);
      navigate("/goals");
    }
  }

  return (
    <div>
      <Link
        to="/goals"
        className="mb-3 inline-block text-sm text-accent-deep hover:underline"
      >
        {strings.goals.backToGoals}
      </Link>

      <ScreenHeader title={dr.title} />

      <Card className="mb-5">
        <p className="text-sm text-ink-soft">
          {strings.goals.feelingTagPrefix}
          <span className="font-medium text-ink">{dr.targetFeeling}</span>
        </p>
        {dr.normalizeIt ? (
          <p className="mt-2 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">
            {strings.goals.normalizeOnTag}
          </p>
        ) : null}
        {dr.sourceActionNote ? (
          <p className="mt-2 text-sm text-ink-soft">
            {strings.goals.sourceActionPrefix}
            {dr.sourceActionNote}
          </p>
        ) : null}
        <div className="mt-4 flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(`/goals/${dr.id}/edit`)}
          >
            {strings.goals.editButton}
          </Button>
          <Button variant="ghost" onClick={handleArchive}>
            {strings.goals.archiveButton}
          </Button>
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">
          {strings.goals.detailHabitsHeading}
        </h2>
        <Button onClick={() => navigate(`/goals/${dr.id}/habits/new`)}>
          {strings.goals.addHabitButton}
        </Button>
      </div>

      {habits.length === 0 ? (
        <EmptyState title={strings.goals.detailNoHabits} />
      ) : (
        <div className="space-y-5">
          {inner.length > 0 ? (
            <HabitGroup
              heading={strings.goals.detailInnerHeading}
              habits={inner}
              goalId={dr.id}
            />
          ) : null}
          {outer.length > 0 ? (
            <HabitGroup
              heading={strings.goals.detailOuterHeading}
              habits={outer}
              goalId={dr.id}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function HabitGroup({
  heading,
  habits,
  goalId,
}: {
  heading: string;
  habits: Habit[];
  goalId: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {heading}
      </h3>
      <ul className="space-y-2">
        {habits.map((h) => (
          <li key={h.id}>
            <Link
              to={`/goals/${goalId}/habits/${h.id}/edit`}
              className="block rounded-xl border border-line bg-paper-raised p-3 transition-colors duration-200 ease-calm hover:border-line-strong"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">{h.name}</span>
                <span className="shrink-0 text-xs text-ink-faint">
                  {h.actionType === "start"
                    ? strings.habitForm.actionStart
                    : strings.habitForm.actionStop}
                </span>
              </div>
              {h.actionType === "stop" && h.exchangingFor ? (
                <p className="mt-1 text-xs text-ink-soft">
                  {strings.goals.exchangingForPrefix}
                  {h.exchangingFor}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
