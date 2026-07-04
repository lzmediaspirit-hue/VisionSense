import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { createEmptyState } from "../lib/storage";
import { strings } from "../copy/strings";
import { useStore } from "../state/store";

beforeEach(() => {
  localStorage.clear();
  useStore.setState(createEmptyState());
});

function renderApp(path = "/goals") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("Desired Reality + Habit creation flow", () => {
  it("creates a desired reality and shows it on the goals list", async () => {
    const user = userEvent.setup();
    renderApp("/goals/new");

    await user.type(
      screen.getByLabelText(strings.desiredRealityForm.titleLabel),
      "New role in design"
    );
    await user.type(
      screen.getByLabelText(strings.desiredRealityForm.targetFeelingLabel),
      "secure"
    );
    await user.click(
      screen.getByRole("button", { name: strings.desiredRealityForm.saveButton })
    );

    // Lands on the detail screen for the new goal.
    expect(
      screen.getByRole("heading", { name: "New role in design" })
    ).toBeInTheDocument();
    expect(useStore.getState().desiredRealities).toHaveLength(1);
  });

  it("blocks saving with an empty title and shows a gentle message", async () => {
    const user = userEvent.setup();
    renderApp("/goals/new");
    await user.click(
      screen.getByRole("button", { name: strings.desiredRealityForm.saveButton })
    );
    expect(
      screen.getByText(strings.desiredRealityForm.titleRequired)
    ).toBeInTheDocument();
    expect(useStore.getState().desiredRealities).toHaveLength(0);
  });

  it("adds an inner habit to a goal", async () => {
    const user = userEvent.setup();
    const dr = useStore.getState().addDesiredReality({
      title: "Steady work",
      targetFeeling: "secure",
      normalizeIt: false,
    });
    renderApp(`/goals/${dr.id}/habits/new`);

    await user.type(
      screen.getByLabelText(strings.habitForm.nameLabel),
      "20 minutes of stillness"
    );
    await user.click(
      screen.getByRole("button", { name: strings.habitForm.saveButton })
    );

    const habits = useStore.getState().habits;
    expect(habits).toHaveLength(1);
    expect(habits[0].name).toBe("20 minutes of stillness");
    expect(habits[0].tier).toBe("inner");
  });
});
