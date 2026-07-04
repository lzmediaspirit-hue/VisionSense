import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";
import { useStore } from "../state/store";

/**
 * Mobile-first app frame: a single centered column with a bottom tab bar. At
 * the `lg:` (>=1024px) breakpoint the same TabBar restyles into a left
 * sidebar (CSS only — see TabBar.tsx) and the main column widens so Today's
 * two-column layout has room; reflective flows (check-in, exercise runner)
 * constrain themselves to ~560px regardless (engineering-plan §3).
 */
export function AppShell() {
  const ensureStatsFresh = useStore((s) => s.ensureStatsFresh);

  // Recompute Self-Trust/Momentum once per app open: catches a day rollover
  // (Momentum's decay needs to fold in any inactive days since last open)
  // and self-heals a stale/corrupt cache by replaying the ledger.
  useEffect(() => {
    ensureStatsFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-full bg-paper text-ink lg:flex lg:items-start">
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 lg:min-w-0 lg:max-w-5xl lg:flex-1 lg:px-10 lg:pb-12 lg:pt-8">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
