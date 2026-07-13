import { useState } from 'react';
import { ChartScreen } from './components/ChartScreen';
import { Dashboard } from './components/Dashboard';
import { TodayView } from './components/TodayView';
import { WeeklyReview } from './components/WeeklyReview';
import { StoreProvider, useStore } from './state/store';
import { SyncProvider } from './sync/controller';

/** The two cross-chart overlay screens added in v1.4 (SPEC 11.2/11.3). */
type Overlay = 'today' | 'review' | null;

function Router() {
  const { activeChart } = useStore();
  // State-based routing (no react-router): active chart => chart screen,
  // otherwise the dashboard/landing. The v1.4 Today/Review screens are a thin
  // overlay on top of that: they don't touch activeChartId, so closing one
  // returns to whichever of dashboard/chart screen was showing before.
  const [overlay, setOverlay] = useState<Overlay>(null);

  if (overlay === 'today') {
    return <TodayView onClose={() => setOverlay(null)} />;
  }
  if (overlay === 'review') {
    return <WeeklyReview onClose={() => setOverlay(null)} />;
  }
  return activeChart ? (
    <ChartScreen chart={activeChart} onOpenToday={() => setOverlay('today')} />
  ) : (
    <Dashboard onOpenToday={() => setOverlay('today')} onOpenReview={() => setOverlay('review')} />
  );
}

export default function App() {
  return (
    <StoreProvider>
      <SyncProvider>
        <Router />
      </SyncProvider>
    </StoreProvider>
  );
}
