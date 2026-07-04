import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, ScreenHeader } from "../components/ui";
import { Reframe } from "../components/Reframe";
import { strings } from "../copy/strings";
import { todayKey } from "../lib/dates";
import {
  cachedStats,
  completionFor,
  habitsDueToday,
  hasCheckInOn,
  openNudges,
  openPutOffItems,
  storageUsage,
} from "../lib/selectors";
import { useStore } from "../state/store";
import type { Habit, MentalNudge, PutOffItem } from "../types";

/** Above this fraction of the assumed ~5MB quota, Today surfaces a calm nudge to back up (§4). */
const STORAGE_WARNING_RATIO = 0.8;

/**
 * Today — the single daily ritual entry point. Top to bottom: headline stats,
 * base-state check-in access, then today's habits ordered inner-first.
 */
export function TodayScreen() {
  const navigate = useNavigate();
  const dateKey = todayKey();

  const stats = useStore(cachedStats);
  const checkedInToday = useStore((s) => hasCheckInOn(s, dateKey));
  const habits = useStore((s) => habitsDueToday(s));
  const openNudgesList = useStore(openNudges);
  const openPutOffList = useStore(openPutOffItems);
  const usage = useStore(storageUsage);
  const markNudgeActedOn = useStore((s) => s.markNudgeActedOn);
  const clearPutOffItem = useStore((s) => s.clearPutOffItem);

  const [reframeOpen, setReframeOpen] = useState(false);

  const inner = habits.filter((h) => h.tier === "inner");
  const outer = habits.filter((h) => h.tier === "outer");

  return (
    <div>
      <ScreenHeader title={strings.today.title} subtitle={strings.app.tagline} />

      {usage.ratio > STORAGE_WARNING_RATIO ? (
        <Card className="mb-6">
          <p className="text-sm font-medium text-ink">{strings.today.storageWarningTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{strings.today.storageWarningBody}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => navigate("/settings")}>
              {strings.today.storageWarningButton}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:space-y-4">
          {/* Headline stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:mb-0 lg:grid-cols-1">
            <StatCard
              label={strings.today.selfTrustLabel}
              value={stats.selfTrust}
              hint={strings.today.selfTrustHint}
            />
            <StatCard
              label={strings.today.momentumLabel}
              value={stats.momentum}
              hint={strings.today.momentumHint}
            />
          </div>

          {/* Base-state check-in access */}
          <Card className="mb-6 lg:mb-0">
            {checkedInToday ? (
              <p className="text-sm text-ink-soft">{strings.today.checkInDoneToday}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">
                  {strings.today.checkInPrompt}
                </p>
                <div className="mt-3">
                  <Button onClick={() => navigate("/check-in")}>
                    {strings.today.checkInCta}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>

        <div>
          {/* Today's habits, inner-first */}
          {habits.length === 0 ? (
            <EmptyState
              title={strings.today.noHabitsTitle}
              body={strings.today.noHabitsBody}
              action={
                <Button variant="secondary" onClick={() => navigate("/goals")}>
                  {strings.nav.goals}
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {inner.length > 0 ? (
                <HabitSection
                  heading={strings.today.innerHeading}
                  hint={strings.today.innerHint}
                  habits={inner}
                  dateKey={dateKey}
                  onMiss={() => setReframeOpen(true)}
                />
              ) : null}
              {outer.length > 0 ? (
                <HabitSection
                  heading={strings.today.outerHeading}
                  habits={outer}
                  dateKey={dateKey}
                  onMiss={() => setReframeOpen(true)}
                />
              ) : null}
            </div>
          )}

          {/* Mental Nudges preview — up to 3, "see all" routes to the full inbox. */}
          <Card className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {strings.today.nudgesPreviewHeading}
              </h2>
              <Button
                variant="ghost"
                aria-label={`${strings.today.seeAll}: ${strings.today.nudgesPreviewHeading}`}
                onClick={() => navigate("/nudges")}
              >
                {strings.today.seeAll}
              </Button>
            </div>
            {openNudgesList.length === 0 ? (
              <p className="text-sm text-ink-soft">{strings.today.nudgesPreviewEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {openNudgesList.slice(0, 3).map((n) => (
                  <NudgePreviewRow key={n.id} nudge={n} onActOn={() => markNudgeActedOn(n.id)} />
                ))}
              </ul>
            )}
          </Card>

          {/* Put-off list preview — up to 3, "see all" routes to the full list. */}
          <Card className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {strings.today.putOffPreviewHeading}
              </h2>
              <Button
                variant="ghost"
                aria-label={`${strings.today.seeAll}: ${strings.today.putOffPreviewHeading}`}
                onClick={() => navigate("/put-off")}
              >
                {strings.today.seeAll}
              </Button>
            </div>
            {openPutOffList.length === 0 ? (
              <p className="text-sm text-ink-soft">{strings.today.putOffPreviewEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {openPutOffList.slice(0, 3).map((item) => (
                  <PutOffPreviewRow
                    key={item.id}
                    item={item}
                    onClear={() => clearPutOffItem(item.id)}
                  />
                ))}
              </ul>
            )}
          </Card>

          {/* Gentle, optional entry point into Polarity Transmutation. */}
          <Card className="mt-4">
            <p className="text-sm font-medium text-ink">{strings.today.exerciseCtaTitle}</p>
            <p className="mt-1 text-sm text-ink-soft">{strings.today.exerciseCtaBody}</p>
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={() => navigate("/exercises/polarity-transmutation")}
              >
                {strings.today.exerciseCtaButton}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {reframeOpen ? <Reframe onClose={() => setReframeOpen(false)} /> : null}
    </div>
  );
}

function NudgePreviewRow({
  nudge,
  onActOn,
}: {
  nudge: MentalNudge;
  onActOn: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-raised p-3">
      <p className="min-w-0 truncate text-sm text-ink">{nudge.text}</p>
      <Button variant="secondary" onClick={onActOn}>
        {strings.nudges.actedOnButton}
      </Button>
    </li>
  );
}

function PutOffPreviewRow({
  item,
  onClear,
}: {
  item: PutOffItem;
  onClear: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-raised p-3">
      <p className="min-w-0 truncate text-sm text-ink">{item.text}</p>
      <Button variant="secondary" onClick={onClear}>
        {strings.putOff.clearButton}
      </Button>
    </li>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold text-accent-deep">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </div>
  );
}

function HabitSection({
  heading,
  hint,
  habits,
  dateKey,
  onMiss,
}: {
  heading: string;
  hint?: string;
  habits: Habit[];
  dateKey: string;
  onMiss: () => void;
}) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {heading}
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
      </div>
      <ul className="space-y-2">
        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} dateKey={dateKey} onMiss={onMiss} />
        ))}
      </ul>
    </section>
  );
}

function HabitRow({
  habit,
  dateKey,
  onMiss,
}: {
  habit: Habit;
  dateKey: string;
  onMiss: () => void;
}) {
  const record = useStore((s) => s.recordHabitCompletion);
  const completion = useStore((s) => completionFor(s, habit.id, dateKey));

  const state: "none" | "kept" | "resting" =
    completion == null ? "none" : completion.kept ? "kept" : "resting";

  function keep() {
    record({ habitId: habit.id, kept: true });
  }

  function notToday() {
    record({ habitId: habit.id, kept: false, reflectionPromptUsed: true });
    onMiss();
  }

  return (
    <li className="rounded-xl border border-line bg-paper-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{habit.name}</p>
          {state === "kept" ? (
            <p className="mt-0.5 text-xs text-accent-deep">
              {strings.today.keptDone}
            </p>
          ) : null}
          {state === "resting" ? (
            <p className="mt-0.5 text-xs text-ink-soft">
              {strings.today.notTodayDone}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={keep}
            aria-label={`${strings.today.keepAriaPrefix} ${habit.name}`}
            className={[
              "min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ease-calm",
              state === "kept"
                ? "bg-accent text-white"
                : "bg-accent-soft text-accent-ink hover:bg-accent hover:text-white",
            ].join(" ")}
          >
            {state === "kept" ? strings.today.keptDone : strings.today.keptButton}
          </button>
          <button
            type="button"
            onClick={notToday}
            aria-label={`${strings.today.notTodayAriaPrefix} ${habit.name}`}
            className={[
              "min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ease-calm",
              state === "resting"
                ? "bg-paper-sunken text-ink"
                : "text-ink-soft hover:bg-paper-sunken",
            ].join(" ")}
          >
            {strings.today.notTodayButton}
          </button>
        </div>
      </div>
    </li>
  );
}
