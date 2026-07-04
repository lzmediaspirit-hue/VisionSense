import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, ScreenHeader } from "../components/ui";
import { Field, Segmented, TextInput, Toggle } from "../components/form";
import { strings } from "../copy/strings";
import { desiredRealityById } from "../lib/selectors";
import { useStore } from "../state/store";
import type { Habit, HabitSchedule } from "../types";

type Tier = Habit["tier"];
type ActionType = Habit["actionType"];
type ScheduleKind = HabitSchedule["kind"];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Create or edit a Habit scoped to a Desired Reality. */
export function HabitFormScreen() {
  const { id: goalId, habitId } = useParams();
  const navigate = useNavigate();
  const dr = useStore((s) => desiredRealityById(s, goalId));
  const existing = useStore((s) => s.habits.find((h) => h.id === habitId));
  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);

  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.name ?? "");
  const [tier, setTier] = useState<Tier>(existing?.tier ?? "inner");
  const [actionType, setActionType] = useState<ActionType>(
    existing?.actionType ?? "start"
  );
  const [exchangingFor, setExchangingFor] = useState(existing?.exchangingFor ?? "");
  const [isKeystone, setIsKeystone] = useState(existing?.isKeystone ?? false);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(
    existing?.schedule.kind ?? "daily"
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existing?.schedule.daysOfWeek ?? []
  );
  const [error, setError] = useState<string | undefined>();

  const c = strings.habitForm;
  const backTo = `/goals/${goalId}`;

  if (!dr) {
    navigate("/goals", { replace: true });
    return null;
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function buildSchedule(): HabitSchedule {
    if (scheduleKind === "weekly") {
      return { kind: "weekly", daysOfWeek };
    }
    return { kind: scheduleKind };
  }

  function handleSave() {
    if (!name.trim()) {
      setError(c.nameRequired);
      return;
    }
    const patch = {
      name: name.trim(),
      tier,
      actionType,
      exchangingFor:
        actionType === "stop" && exchangingFor.trim()
          ? exchangingFor.trim()
          : undefined,
      isKeystone,
      schedule: buildSchedule(),
    };

    if (existing) {
      updateHabit(existing.id, patch);
    } else {
      addHabit({ desiredRealityId: dr!.id, ...patch });
    }
    navigate(backTo);
  }

  return (
    <div>
      <ScreenHeader title={isEdit ? c.editTitle : c.createTitle} subtitle={dr.title} />

      <Field label={c.nameLabel} htmlFor="habit-name" error={error}>
        <TextInput
          id="habit-name"
          value={name}
          placeholder={c.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label={c.tierLabel} hint={c.tierHint}>
        <Segmented<Tier>
          label={c.tierLabel}
          value={tier}
          onChange={setTier}
          options={[
            { value: "inner", label: c.tierInner },
            { value: "outer", label: c.tierOuter },
          ]}
        />
      </Field>

      <Field label={c.actionTypeLabel}>
        <Segmented<ActionType>
          label={c.actionTypeLabel}
          value={actionType}
          onChange={setActionType}
          options={[
            { value: "start", label: c.actionStart },
            { value: "stop", label: c.actionStop },
          ]}
        />
      </Field>

      {actionType === "stop" ? (
        <Field
          label={c.exchangingForLabel}
          hint={c.exchangingForHint}
          htmlFor="habit-exchange"
        >
          <TextInput
            id="habit-exchange"
            value={exchangingFor}
            placeholder={c.exchangingForPlaceholder}
            onChange={(e) => setExchangingFor(e.target.value)}
          />
        </Field>
      ) : null}

      <Field label={c.scheduleLabel}>
        <Segmented<ScheduleKind>
          label={c.scheduleLabel}
          value={scheduleKind}
          onChange={setScheduleKind}
          options={[
            { value: "daily", label: c.scheduleDaily },
            { value: "weekly", label: c.scheduleWeekly },
            { value: "oneOff", label: c.scheduleOneOff },
          ]}
        />
      </Field>

      {scheduleKind === "weekly" ? (
        <Field label={c.daysOfWeekLabel}>
          <div className="flex gap-2" role="group" aria-label={c.daysOfWeekLabel}>
            {DAY_LABELS.map((label, day) => {
              const active = daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Day ${day}`}
                  onClick={() => toggleDay(day)}
                  className={[
                    "h-11 w-11 rounded-full border text-sm font-medium transition-colors duration-200 ease-calm",
                    active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-paper-raised text-ink-soft",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}

      <Toggle
        id="habit-keystone"
        label={c.keystoneLabel}
        hint={c.keystoneHint}
        checked={isKeystone}
        onChange={setIsKeystone}
      />

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSave}>{c.saveButton}</Button>
        <Button variant="secondary" onClick={() => navigate(backTo)}>
          {c.cancelButton}
        </Button>
      </div>
    </div>
  );
}
