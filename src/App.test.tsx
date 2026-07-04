import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { strings } from "./copy/strings";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App shell", () => {
  it("renders the four-tab bottom nav", () => {
    renderAt("/today");
    const nav = screen.getByRole("navigation", { name: /primary/i });
    for (const label of Object.values(strings.nav)) {
      // nav labels are unique within the tab bar
      expect(nav).toHaveTextContent(label);
    }
  });

  it("redirects the index route to Today", () => {
    renderAt("/");
    expect(
      screen.getByRole("heading", { name: strings.today.title })
    ).toBeInTheDocument();
  });

  it("renders the Goals screen at /goals", () => {
    renderAt("/goals");
    expect(
      screen.getByRole("heading", { name: strings.goals.title })
    ).toBeInTheDocument();
  });
});
