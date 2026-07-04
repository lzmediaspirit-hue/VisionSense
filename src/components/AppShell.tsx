import { Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";

/**
 * Mobile-first app frame: a single centered column with a bottom tab bar.
 * `max-w-2xl` keeps the column readable without any fixed pixel width, so a
 * Phase 3 desktop sidebar layout is not blocked.
 */
export function AppShell() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
