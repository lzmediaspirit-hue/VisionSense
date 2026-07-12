// App state: a small reducer over AppState plus debounced localStorage
// persistence. Routing is state-based (no router): a null activeChartId shows
// the dashboard, a set one shows the chart screen. This keeps phase-2's real
// dashboard a drop-in.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { createChart, type CreateChartOptions } from '../model/factory';
import { loadState, saveState } from '../model/storage';
import type { AppState, Chart } from '../model/types';

type StoreAction =
  | { type: 'CREATE_CHART'; chart: Chart }
  | { type: 'OPEN_CHART'; id: string }
  | { type: 'CLOSE_CHART' }
  | { type: 'MUTATE_ACTIVE'; fn: (chart: Chart) => Chart };

function reducer(state: AppState, action: StoreAction): AppState {
  switch (action.type) {
    case 'CREATE_CHART':
      return {
        ...state,
        charts: [action.chart, ...state.charts],
        activeChartId: action.chart.id,
      };
    case 'OPEN_CHART':
      if (!state.charts.some((c) => c.id === action.id)) return state;
      return { ...state, activeChartId: action.id };
    case 'CLOSE_CHART':
      if (state.activeChartId === null) return state;
      return { ...state, activeChartId: null };
    case 'MUTATE_ACTIVE': {
      if (state.activeChartId === null) return state;
      let changed = false;
      const charts = state.charts.map((c) => {
        if (c.id !== state.activeChartId) return c;
        const next = action.fn(c);
        if (next !== c) changed = true;
        return next;
      });
      return changed ? { ...state, charts } : state;
    }
  }
}

interface Store {
  state: AppState;
  activeChart: Chart | null;
  createBlankChart: (options?: CreateChartOptions) => void;
  openChart: (id: string) => void;
  closeChart: () => void;
  mutateActive: (fn: (chart: Chart) => Chart) => void;
}

const StoreContext = createContext<Store | null>(null);

const SAVE_DEBOUNCE_MS = 250;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState());

  // Debounced persistence: every mutation eventually writes through.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveState(state), SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  // Flush pending write on unload so a quick close never loses data.
  useEffect(() => {
    const flush = () => saveState(state);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [state]);

  const createBlankChart = useCallback((options?: CreateChartOptions) => {
    dispatch({ type: 'CREATE_CHART', chart: createChart(options) });
  }, []);
  const openChart = useCallback((id: string) => dispatch({ type: 'OPEN_CHART', id }), []);
  const closeChart = useCallback(() => dispatch({ type: 'CLOSE_CHART' }), []);
  const mutateActive = useCallback(
    (fn: (chart: Chart) => Chart) => dispatch({ type: 'MUTATE_ACTIVE', fn }),
    [],
  );

  const activeChart = useMemo(
    () => state.charts.find((c) => c.id === state.activeChartId) ?? null,
    [state.charts, state.activeChartId],
  );

  const store = useMemo<Store>(
    () => ({
      state,
      activeChart,
      createBlankChart,
      openChart,
      closeChart,
      mutateActive,
    }),
    [state, activeChart, createBlankChart, openChart, closeChart, mutateActive],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within a StoreProvider');
  return store;
}
