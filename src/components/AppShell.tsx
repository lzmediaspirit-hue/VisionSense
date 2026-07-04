import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";
import { useStore } from "../state/store";

/**
 * Mobile-first app frame: a single centered column with a bottom tab bar.
 * `max-w-2xl` keeps the column readable without any fixed pixel width, so a
 * Phase 3 desktop sidebar layout is not blocked.
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
    <div className="min-h-full bg-paper text-ink">
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
