import { ChartScreen } from './components/ChartScreen';
import { Dashboard } from './components/Dashboard';
import { StoreProvider, useStore } from './state/store';

function Router() {
  const { activeChart } = useStore();
  // State-based routing (no react-router): active chart => chart screen,
  // otherwise the dashboard/landing.
  return activeChart ? <ChartScreen chart={activeChart} /> : <Dashboard />;
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
