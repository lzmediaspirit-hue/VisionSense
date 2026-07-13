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
import { createChart, duplicateChart as duplicateChartOp, type CreateChartOptions } from '../model/factory';
import { loadState, saveState } from '../model/storage';
import type { AppState, Chart, DayPlan, Review } from '../model/types';
import { recordChartDeletion } from '../sync/metadata';

type StoreAction =
  | { type: 'CREATE_CHART'; chart: Chart }
  | { type: 'OPEN_CHART'; id: string }
  | { type: 'CLOSE_CHART' }
  | { type: 'MUTATE_ACTIVE'; fn: (chart: Chart) => Chart }
  | { type: 'MUTATE_CHART'; id: string; fn: (chart: Chart) => Chart }
  | { type: 'DUPLICATE_CHART'; id: string }
  | { type: 'DELETE_CHART'; id: string }
  | { type: 'REPLACE_CHARTS'; charts: Chart[] }
  | { type: 'SET_DAY_PLAN'; key: string; plan: DayPlan }
  | { type: 'SET_REVIEW'; key: string; review: Review }
  | { type: 'REPLACE_JOURNAL'; days: Record<string, DayPlan>; reviews: Record<string, Review> };

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
      return mutateChartById(state, state.activeChartId, action.fn);
    }
    case 'MUTATE_CHART':
      return mutateChartById(state, action.id, action.fn);
    case 'DUPLICATE_CHART': {
      const index = state.charts.findIndex((c) => c.id === action.id);
      if (index === -1) return state;
      const copy = duplicateChartOp(state.charts[index]);
      const charts = state.charts.slice();
      charts.splice(index + 1, 0, copy);
      return { ...state, charts };
    }
    case 'DELETE_CHART': {
      if (!state.charts.some((c) => c.id === action.id)) return state;
      const charts = state.charts.filter((c) => c.id !== action.id);
      const activeChartId = state.activeChartId === action.id ? null : state.activeChartId;
      return { ...state, charts, activeChartId };
    }
    case 'REPLACE_CHARTS': {
      // Wholesale replacement after a sync merge. Keep the open chart if it
      // survived the merge, otherwise fall back to the dashboard.
      const activeChartId =
        state.activeChartId !== null && action.charts.some((c) => c.id === state.activeChartId)
          ? state.activeChartId
          : null;
      return { ...state, charts: action.charts, activeChartId };
    }
    case 'SET_DAY_PLAN':
      return { ...state, days: { ...state.days, [action.key]: action.plan } };
    case 'SET_REVIEW':
      return { ...state, reviews: { ...state.reviews, [action.key]: action.review } };
    case 'REPLACE_JOURNAL':
      return { ...state, days: action.days, reviews: action.reviews };
  }
}

/** Shared per-id chart mutation: returns the same state ref when nothing changed. */
function mutateChartById(
  state: AppState,
  id: string,
  fn: (chart: Chart) => Chart,
): AppState {
  let changed = false;
  const charts = state.charts.map((c) => {
    if (c.id !== id) return c;
    const next = fn(c);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...state, charts } : state;
}

interface Store {
  state: AppState;
  activeChart: Chart | null;
  createBlankChart: (options?: CreateChartOptions) => void;
  /** Import an already-built (and already-validated) chart, e.g. from a JSON file. */
  importChart: (chart: Chart) => void;
  openChart: (id: string) => void;
  closeChart: () => void;
  mutateActive: (fn: (chart: Chart) => Chart) => void;
  /** Mutate any chart by id (used by the Today view to complete cross-chart actions). */
  mutateChart: (id: string, fn: (chart: Chart) => Chart) => void;
  duplicateChart: (id: string) => void;
  deleteChart: (id: string) => void;
  /** Replace the entire chart list (used by the sync controller after a merge). */
  replaceCharts: (charts: Chart[]) => void;
  /** Set a day's plan (v1.4 Today view). */
  setDayPlan: (key: string, plan: DayPlan) => void;
  /** Set a weekly review (v1.4). */
  setReview: (key: string, review: Review) => void;
  /** Replace the whole journal (used by the sync controller after a merge). */
  replaceJournal: (days: Record<string, DayPlan>, reviews: Record<string, Review>) => void;
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
  const importChart = useCallback((chart: Chart) => {
    dispatch({ type: 'CREATE_CHART', chart });
  }, []);
  const openChart = useCallback((id: string) => dispatch({ type: 'OPEN_CHART', id }), []);
  const closeChart = useCallback(() => dispatch({ type: 'CLOSE_CHART' }), []);
  const mutateActive = useCallback(
    (fn: (chart: Chart) => Chart) => dispatch({ type: 'MUTATE_ACTIVE', fn }),
    [],
  );
  const mutateChart = useCallback(
    (id: string, fn: (chart: Chart) => Chart) => dispatch({ type: 'MUTATE_CHART', id, fn }),
    [],
  );
  const setDayPlan = useCallback(
    (key: string, plan: DayPlan) => dispatch({ type: 'SET_DAY_PLAN', key, plan }),
    [],
  );
  const setReview = useCallback(
    (key: string, review: Review) => dispatch({ type: 'SET_REVIEW', key, review }),
    [],
  );
  const replaceJournal = useCallback(
    (days: Record<string, DayPlan>, reviews: Record<string, Review>) =>
      dispatch({ type: 'REPLACE_JOURNAL', days, reviews }),
    [],
  );
  const duplicateChart = useCallback(
    (id: string) => dispatch({ type: 'DUPLICATE_CHART', id }),
    [],
  );
  const deleteChart = useCallback((id: string) => {
    // Record a tombstone first (only takes effect when sync is enabled) so the
    // deletion propagates instead of being resurrected by a stale remote copy.
    recordChartDeletion(id);
    dispatch({ type: 'DELETE_CHART', id });
  }, []);
  const replaceCharts = useCallback(
    (charts: Chart[]) => dispatch({ type: 'REPLACE_CHARTS', charts }),
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
      importChart,
      openChart,
      closeChart,
      mutateActive,
      mutateChart,
      duplicateChart,
      deleteChart,
      replaceCharts,
      setDayPlan,
      setReview,
      replaceJournal,
    }),
    [
      state,
      activeChart,
      createBlankChart,
      importChart,
      openChart,
      closeChart,
      mutateActive,
      mutateChart,
      duplicateChart,
      deleteChart,
      replaceCharts,
      setDayPlan,
      setReview,
      replaceJournal,
    ],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within a StoreProvider');
  return store;
}
