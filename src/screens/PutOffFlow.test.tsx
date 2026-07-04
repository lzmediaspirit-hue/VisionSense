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

function renderApp(path = "/put-off") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("Put-off list", () => {
  it("adds an item and lists it as open", async () => {
    const user = userEvent.setup();
    renderApp();
    const c = strings.putOff;

    await user.type(screen.getByLabelText(c.addLabel), "that phone call");
    await user.click(screen.getByRole("button", { name: c.addButton }));

    expect(screen.getByText("that phone call")).toBeInTheDocument();
    expect(useStore.getState().putOffItems).toHaveLength(1);
    expect(useStore.getState().putOffItems[0].clearedAt).toBeUndefined();
  });

  it("clearing an item stamps clearedAt, feeds a fast-ATFT event, and logs Evidence", async () => {
    const user = userEvent.setup();
    useStore.getState().addPutOffItem("that phone call");
    renderApp();
    const c = strings.putOff;

    await user.click(screen.getByRole("button", { name: c.clearButton }));

    expect(screen.getByText(c.clearedLabel)).toBeInTheDocument();
    const state = useStore.getState();
    expect(state.putOffItems[0].clearedAt).toBeGreaterThan(0);
    expect(state.selfTrustLedger).toHaveLength(1);
    expect(state.selfTrustLedger[0].kind).toBe("ATFT");
    expect(state.selfTrustLedger[0].sourceType).toBe("putOffItemCleared");
    expect(state.evidenceEntries).toHaveLength(1);
    expect(state.evidenceEntries[0].sourceType).toBe("putOffItemCleared");
  });

  it("letting an item go is neutral: no ledger event, no evidence, no penalty", async () => {
    const user = userEvent.setup();
    useStore.getState().addPutOffItem("that phone call");
    renderApp();
    const c = strings.putOff;

    await user.click(screen.getByRole("button", { name: c.releaseButton }));

    expect(screen.getByText(c.releasedLabel)).toBeInTheDocument();
    const state = useStore.getState();
    expect(state.putOffItems[0].releasedAt).toBeGreaterThan(0);
    expect(state.selfTrustLedger).toHaveLength(0);
    expect(state.evidenceEntries).toHaveLength(0);
    expect(state.profileStats.selfTrust).toBe(50);
  });
});

describe("Today screen: put-off preview", () => {
  it("shows up to 3 open items with a see-all link to the full list", async () => {
    const user = userEvent.setup();
    useStore.getState().addPutOffItem("one");
    useStore.getState().addPutOffItem("two");
    useStore.getState().addPutOffItem("three");
    useStore.getState().addPutOffItem("four");
    render(
      <MemoryRouter initialEntries={["/today"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("three")).toBeInTheDocument();
    expect(screen.queryByText("four")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: `${strings.today.seeAll}: ${strings.today.putOffPreviewHeading}`,
      })
    );
    expect(screen.getByRole("heading", { name: strings.putOff.title })).toBeInTheDocument();
  });
});
