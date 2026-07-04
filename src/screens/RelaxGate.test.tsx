import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { createEmptyState } from "../lib/storage";
import { strings } from "../copy/strings";
import { useStore } from "../state/store";

beforeEach(() => {
  localStorage.clear();
  useStore.setState(createEmptyState());
});

afterEach(() => {
  vi.useRealTimers();
});

function renderApp(path = "/exercises/polarity-transmutation") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("Relax-first gate (C9)", () => {
  it("shows the gate before the exercise runner's first step when enabled", () => {
    renderApp();
    expect(screen.getByText(strings.relaxGate.title)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(strings.exercises.polarityTransmutation.stepFeelingPrompt)
    ).not.toBeInTheDocument();
  });

  it("skipping the gate proceeds without recording relaxGateCompletedAt", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: strings.relaxGate.skipButton }));

    expect(
      screen.getByLabelText(strings.exercises.polarityTransmutation.stepFeelingPrompt)
    ).toBeInTheDocument();
    expect(useStore.getState().exerciseSessions[0].relaxGateCompletedAt).toBeUndefined();
  });

  it("letting the timer run out advances and stamps relaxGateCompletedAt on the session", () => {
    vi.useFakeTimers();
    renderApp();

    act(() => {
      vi.advanceTimersByTime(95_000);
    });

    expect(
      screen.getByLabelText(strings.exercises.polarityTransmutation.stepFeelingPrompt)
    ).toBeInTheDocument();
    expect(useStore.getState().exerciseSessions[0].relaxGateCompletedAt).toBeGreaterThan(0);
  });

  it("is skipped entirely when settings.relaxGateEnabled is false", () => {
    useStore.getState().updateSettings({ relaxGateEnabled: false });
    renderApp();

    expect(screen.queryByText(strings.relaxGate.title)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(strings.exercises.polarityTransmutation.stepFeelingPrompt)
    ).toBeInTheDocument();
  });
});
