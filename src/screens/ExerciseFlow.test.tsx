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

function renderApp(path = "/exercises/polarity-transmutation") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

// The relax-first gate (M5, C9) is on by default (settings.relaxGateEnabled),
// so it's shown before the runner's first step. These tests exercise the
// exercise-runner flow itself, not the gate (see RelaxGate.test.tsx for that),
// so they skip it explicitly first — the gate's own "skip" affordance.
async function skipRelaxGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: strings.relaxGate.skipButton }));
}

describe("Polarity Transmutation exercise runner", () => {
  it("starts a session immediately on entry, before any step is completed", () => {
    renderApp();
    expect(useStore.getState().exerciseSessions).toHaveLength(1);
    expect(useStore.getState().exerciseSessions[0].completedAt).toBeUndefined();
    expect(useStore.getState().exerciseSessions[0].type).toBe("polarityTransmutation");
  });

  it("requires each step's input before advancing", async () => {
    const user = userEvent.setup();
    renderApp();
    await skipRelaxGate(user);
    const c = strings.exercises.polarityTransmutation;

    await user.click(screen.getByRole("button", { name: c.next }));
    expect(screen.getByText(c.feelingRequired)).toBeInTheDocument();
  });

  it("offers tappable polarity suggestions that fill the field", async () => {
    const user = userEvent.setup();
    renderApp();
    await skipRelaxGate(user);
    const c = strings.exercises.polarityTransmutation;

    await user.type(screen.getByLabelText(c.stepFeelingPrompt), "unseen");
    await user.click(screen.getByRole("button", { name: c.next }));

    const suggestion = strings.exercises.polaritySuggestions[0];
    await user.click(screen.getByRole("button", { name: suggestion }));
    expect(screen.getByLabelText(c.stepPolarityPrompt)).toHaveValue(suggestion);
  });

  it("completing the full flow logs evidence, counts toward Momentum, and never touches the Self-Trust ledger", async () => {
    const user = userEvent.setup();
    renderApp();
    await skipRelaxGate(user);
    const c = strings.exercises.polarityTransmutation;

    await user.type(screen.getByLabelText(c.stepFeelingPrompt), "unseen");
    await user.click(screen.getByRole("button", { name: c.next }));

    await user.type(screen.getByLabelText(c.stepPolarityPrompt), "seen");
    await user.click(screen.getByRole("button", { name: c.next }));

    await user.type(
      screen.getByLabelText(`${c.stepEvidencePrompt} 1`),
      "A friend thanked me publicly this week"
    );
    await user.click(screen.getByRole("button", { name: c.finish }));

    expect(screen.getByText(c.completedTitle)).toBeInTheDocument();

    const state = useStore.getState();
    expect(state.exerciseSessions[0].completedAt).toBeGreaterThan(0);
    expect(state.evidenceEntries).toHaveLength(1);
    expect(state.evidenceEntries[0].sourceType).toBe("exerciseSession");
    expect(state.evidenceEntries[0].text).toBe("A friend thanked me publicly this week");
    expect(state.profileStats.momentumRaw).toBeGreaterThan(0);
    expect(state.selfTrustLedger).toHaveLength(0);
  });

  it("an abandoned session (exiting before completion) leaves no Evidence and doesn't corrupt Momentum", async () => {
    const user = userEvent.setup();
    renderApp();
    await skipRelaxGate(user);
    const c = strings.exercises.polarityTransmutation;

    // Exit on the very first step without filling anything in.
    await user.click(screen.getByRole("button", { name: c.exitButton }));

    const state = useStore.getState();
    expect(state.exerciseSessions).toHaveLength(1);
    expect(state.exerciseSessions[0].completedAt).toBeUndefined();
    expect(state.evidenceEntries).toHaveLength(0);
    expect(state.profileStats.momentumRaw).toBe(0);
  });

  it("an abandoned session during the relax gate itself is still captured with no completedAt", async () => {
    renderApp();
    // Never interacts with the gate at all — simulates navigating away.
    const state = useStore.getState();
    expect(state.exerciseSessions).toHaveLength(1);
    expect(state.exerciseSessions[0].completedAt).toBeUndefined();
    expect(state.exerciseSessions[0].relaxGateCompletedAt).toBeUndefined();
  });
});
