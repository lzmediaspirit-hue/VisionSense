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

function renderApp(path = "/nudges") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("Mental Nudges inbox", () => {
  it("captures a nudge in a single field and lists it as open", async () => {
    const user = userEvent.setup();
    renderApp();
    const c = strings.nudges;

    await user.type(screen.getByLabelText(c.addLabel), "message Sam");
    await user.click(screen.getByRole("button", { name: c.addButton }));

    expect(screen.getByText("message Sam")).toBeInTheDocument();
    expect(useStore.getState().mentalNudges).toHaveLength(1);
    expect(useStore.getState().mentalNudges[0].status).toBe("open");
  });

  it("marking a nudge acted-on moves it to history and feeds Self-Trust silently", async () => {
    const user = userEvent.setup();
    useStore.getState().addMentalNudge("message Sam");
    renderApp();
    const c = strings.nudges;

    await user.click(screen.getByRole("button", { name: c.actedOnButton }));

    expect(screen.getByText(c.actedOnLabel)).toBeInTheDocument();
    const state = useStore.getState();
    expect(state.mentalNudges[0].status).toBe("actedOn");
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.evidenceEntries).toHaveLength(1);
  });

  it("releasing a nudge is neutral: no ledger event, no evidence", async () => {
    const user = userEvent.setup();
    useStore.getState().addMentalNudge("message Sam");
    renderApp();
    const c = strings.nudges;

    await user.click(screen.getByRole("button", { name: c.releaseButton }));

    expect(screen.getByText(c.releasedLabel)).toBeInTheDocument();
    const state = useStore.getState();
    expect(state.mentalNudges[0].status).toBe("released");
    expect(state.selfTrustLedger).toHaveLength(0);
    expect(state.evidenceEntries).toHaveLength(0);
  });
});

describe("Today screen: Mental Nudges preview + exercise entry point", () => {
  it("shows up to 3 open nudges with a see-all link to the full inbox", async () => {
    const user = userEvent.setup();
    useStore.getState().addMentalNudge("one");
    useStore.getState().addMentalNudge("two");
    useStore.getState().addMentalNudge("three");
    useStore.getState().addMentalNudge("four");
    render(
      <MemoryRouter initialEntries={["/today"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("three")).toBeInTheDocument();
    expect(screen.queryByText("four")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: strings.today.seeAll }));
    expect(screen.getByRole("heading", { name: strings.nudges.title })).toBeInTheDocument();
  });

  it("offers a gentle, optional entry point into Polarity Transmutation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/today"]}>
        <App />
      </MemoryRouter>
    );

    await user.click(
      screen.getByRole("button", { name: strings.today.exerciseCtaButton })
    );
    expect(
      screen.getByRole("heading", {
        name: strings.exercises.polarityTransmutation.entryTitle,
      })
    ).toBeInTheDocument();
  });
});
