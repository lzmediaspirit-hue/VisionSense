import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { createEmptyState } from "../lib/storage";
import { strings } from "../copy/strings";
import { todayKey } from "../lib/dates";
import { useStore } from "../state/store";

// Words that must never surface anywhere in the miss / reframe path (T5).
const BANNED = /\b(fail|failure|wrong|should|bad|streak|overdue|error)\b/i;

beforeEach(() => {
  localStorage.clear();
  useStore.setState(createEmptyState());
});

function seedDailyHabit(name = "20 minutes of stillness") {
  const dr = useStore.getState().addDesiredReality({
    title: "Steady work",
    targetFeeling: "secure",
    normalizeIt: false,
  });
  return useStore.getState().addHabit({
    desiredRealityId: dr.id,
    name,
    tier: "inner",
    actionType: "start",
    isKeystone: false,
    schedule: { kind: "daily" },
  });
}

function renderApp(path = "/today") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("Today screen daily loop", () => {
  it("renders the Self-Trust and Momentum stubs at 50 and 0", () => {
    renderApp();
    expect(screen.getByText(strings.today.selfTrustLabel)).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows today's daily habit and marks it kept", async () => {
    const user = userEvent.setup();
    const habit = seedDailyHabit();
    renderApp();

    const keepButton = screen.getByRole("button", {
      name: new RegExp(`${strings.today.keepAriaPrefix}`, "i"),
    });
    await user.click(keepButton);

    const completions = useStore
      .getState()
      .habitCompletions.filter((c) => c.habitId === habit.id);
    expect(completions).toHaveLength(1);
    expect(completions[0].kept).toBe(true);
    expect(completions[0].dateKey).toBe(todayKey());
  });

  it("a gentle miss records an unkept completion and opens the reframe", async () => {
    const user = userEvent.setup();
    const habit = seedDailyHabit();
    renderApp();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`${strings.today.notTodayAriaPrefix}`, "i"),
      })
    );

    const completion = useStore
      .getState()
      .habitCompletions.find((c) => c.habitId === habit.id);
    expect(completion?.kept).toBe(false);

    // Reframe overlay shows the three verbatim C2 prompts.
    const dialog = screen.getByRole("dialog", { name: strings.reframe.title });
    expect(within(dialog).getByText(strings.reframe.promptLookAt)).toBeInTheDocument();
    expect(within(dialog).getByText(strings.reframe.promptFeelAbout)).toBeInTheDocument();
    expect(within(dialog).getByText(strings.reframe.promptThinkAbout)).toBeInTheDocument();
  });

  it("the miss / reframe path contains no banned words", async () => {
    const user = userEvent.setup();
    seedDailyHabit();
    const { container } = renderApp();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`${strings.today.notTodayAriaPrefix}`, "i"),
      })
    );

    expect(container.textContent ?? "").not.toMatch(BANNED);
  });

  it("re-tapping a habit upserts rather than duplicating the day's record", async () => {
    const user = userEvent.setup();
    const habit = seedDailyHabit();
    renderApp();

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`${strings.today.notTodayAriaPrefix}`, "i"),
      })
    );
    // close reframe, then keep it instead
    await user.click(screen.getByRole("button", { name: strings.reframe.continue }));
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`${strings.today.keepAriaPrefix}`, "i"),
      })
    );

    const completions = useStore
      .getState()
      .habitCompletions.filter((c) => c.habitId === habit.id);
    expect(completions).toHaveLength(1);
    expect(completions[0].kept).toBe(true);
  });
});

describe("Base-state check-in flow", () => {
  it("captures a base state one question at a time and records it", async () => {
    const user = userEvent.setup();
    renderApp("/check-in");

    await user.type(
      screen.getByLabelText(strings.checkIn.stepBaseStateQuestion),
      "at ease"
    );
    await user.click(screen.getByRole("button", { name: strings.checkIn.next }));
    await user.click(screen.getByRole("button", { name: strings.checkIn.finish }));

    const checkIns = useStore.getState().checkIns;
    expect(checkIns).toHaveLength(1);
    expect(checkIns[0].baseState).toBe("at ease");
    expect(checkIns[0].dateKey).toBe(todayKey());
    expect(screen.getByText(strings.checkIn.savedTitle)).toBeInTheDocument();
  });

  it("requires a base state before advancing", async () => {
    const user = userEvent.setup();
    renderApp("/check-in");
    await user.click(screen.getByRole("button", { name: strings.checkIn.next }));
    expect(
      screen.getByText(strings.checkIn.baseStateRequired)
    ).toBeInTheDocument();
    expect(useStore.getState().checkIns).toHaveLength(0);
  });
});
