// Sync controller (SPEC 10.4). Wires the pure merge + Drive layers to the React
// store: connect (pull -> merge -> save local -> push), a debounced ~2s push on
// any local mutation while connected, a load-time silent reconnect, "Sync now",
// and non-blocking error/reconnect states. Local editing is NEVER blocked.
//
// When sync is not configured (empty effective client ID) this provider does
// nothing at all: no effects run, no script loads, no context value is produced
// beyond `configured: false`, and the widget renders nothing.
//
// Token persistence (SPEC 10.6): the access token is cached in sync metadata,
// not just in memory, so a page refresh reuses it until it expires instead of
// re-requesting from GIS. That request is what could surface as a popup, so
// the load-time effect never makes it when the cached token has expired —
// it lands in the "reconnect" state and waits for a user gesture instead.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Chart, DayPlan, Review } from '../model/types';
import { useStore } from '../state/store';
import { effectiveClientId, isSyncConfigured } from './config';
import {
  createFile,
  downloadFile,
  DriveError,
  fetchUserEmail,
  findFile,
  updateFile,
  type DrivePayload,
} from './drive';
import { requestAccessToken, revokeAccessToken, type AccessToken } from './gis';
import { mergeSides } from './merge';
import { mergeJournals } from './journalMerge';
import {
  clearSyncMeta,
  loadSyncMeta,
  parseDrivePayload,
  saveSyncMeta,
  type SyncMeta,
} from './metadata';

export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'reconnect';

export interface SyncView {
  /** Whether the feature exists at all (a client ID is configured). */
  configured: boolean;
  status: SyncStatus;
  email: string;
  lastSyncAt: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  syncNow: () => void;
}

const SyncContext = createContext<SyncView | null>(null);

const PUSH_DEBOUNCE_MS = 2000;

function makePayload(
  charts: Chart[],
  tombstones: Record<string, string>,
  days: Record<string, DayPlan>,
  reviews: Record<string, Review>,
): DrivePayload {
  return {
    schemaVersion: 1,
    charts,
    deletedChartIds: tombstones,
    savedAt: new Date().toISOString(),
    journal: { days, reviews },
  };
}

function friendlyError(e: unknown): string {
  if (e instanceof DriveError) {
    if (e.status === 401 || e.status === 403) return 'Google access expired — reconnect to sync.';
    if (e.status === 429) return 'Google rate limit hit — will retry shortly.';
    return `Drive sync failed (${e.status}).`;
  }
  if (e instanceof Error && e.message) return e.message;
  return 'Sync failed.';
}

function SyncController({ children }: { children: ReactNode }) {
  const { state, replaceCharts, replaceJournal } = useStore();

  const [status, setStatus] = useState<SyncStatus>(() =>
    loadSyncMeta().enabled ? 'reconnect' : 'disconnected',
  );
  const [email, setEmail] = useState<string>(() => loadSyncMeta().email);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => loadSyncMeta().lastSyncAt);
  const [error, setError] = useState<string | null>(null);

  // Refs holding the latest values without re-triggering effects.
  const tokenRef = useRef<AccessToken | null>(null);
  const chartsRef = useRef<Chart[]>(state.charts);
  chartsRef.current = state.charts;
  // Latest journal (day plans + reviews), tracked without re-triggering effects.
  const daysRef = useRef<Record<string, DayPlan>>(state.days);
  daysRef.current = state.days;
  const reviewsRef = useRef<Record<string, Review>>(state.reviews);
  reviewsRef.current = state.reviews;
  // Charts/journal we last pushed/merged — used to suppress a redundant debounced
  // push right after a merge produced these exact references.
  const syncedChartsRef = useRef<Chart[] | null>(null);
  const syncedDaysRef = useRef<Record<string, DayPlan> | null>(null);
  const syncedReviewsRef = useRef<Record<string, Review> | null>(null);
  const runningRef = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientId = effectiveClientId();

  const persist = useCallback(
    (patch: Partial<SyncMeta>) => {
      const next = { ...loadSyncMeta(), ...patch };
      saveSyncMeta(next);
      if (patch.email !== undefined) setEmail(next.email);
      if (patch.lastSyncAt !== undefined) setLastSyncAt(next.lastSyncAt);
    },
    [],
  );

  // Acquire a valid access token. For a silent request (prompt === '') this
  // never calls GIS unless nothing usable is cached: in-memory token first,
  // then the one persisted in sync metadata (hydrating tokenRef from it), and
  // only then a silent GIS request. That last step is what would pop a
  // sign-in window on load if GIS can't grant silently, so avoiding it
  // whenever a stored token is still valid is the fix for the refresh-popup
  // bug.
  const acquireToken = useCallback(
    async (prompt: '' | 'consent'): Promise<string> => {
      const current = tokenRef.current;
      if (prompt === '' && current && current.expiresAt > Date.now()) return current.accessToken;
      if (prompt === '') {
        const stored = loadSyncMeta();
        if (stored.accessToken && stored.tokenExpiresAt && stored.tokenExpiresAt > Date.now()) {
          tokenRef.current = { accessToken: stored.accessToken, expiresAt: stored.tokenExpiresAt };
          return stored.accessToken;
        }
      }
      const token = await requestAccessToken(clientId, prompt);
      tokenRef.current = token;
      persist({ accessToken: token.accessToken, tokenExpiresAt: token.expiresAt });
      return token.accessToken;
    },
    [clientId, persist],
  );

  // Full sync: pull remote -> merge with local -> save merged locally -> push.
  const fullSync = useCallback(
    async (prompt: '' | 'consent') => {
      const token = await acquireToken(prompt);
      const meta = loadSyncMeta();

      const resolvedEmail = meta.email || (await fetchUserEmail(token));

      let fileId = meta.fileId ?? (await findFile(token));
      let remoteCharts: Chart[] = [];
      let remoteTombstones: Record<string, string> = {};
      let remoteDays: Record<string, DayPlan> = {};
      let remoteReviews: Record<string, Review> = {};
      if (fileId) {
        try {
          const raw = await downloadFile(token, fileId);
          const parsed = parseDrivePayload(raw);
          if (parsed) {
            remoteCharts = parsed.charts;
            remoteTombstones = parsed.deletedChartIds;
            remoteDays = parsed.journal?.days ?? {};
            remoteReviews = parsed.journal?.reviews ?? {};
          }
        } catch (e) {
          // A missing/renamed file (404) just means "no remote yet"; re-find once.
          if (e instanceof DriveError && e.status === 404) {
            fileId = null;
          } else {
            throw e;
          }
        }
      }

      const merged = mergeSides(
        { charts: chartsRef.current, tombstones: meta.deletedChartIds },
        { charts: remoteCharts, tombstones: remoteTombstones },
      );
      const mergedJournal = mergeJournals(
        { days: daysRef.current, reviews: reviewsRef.current },
        { days: remoteDays, reviews: remoteReviews },
      );

      // Save merged charts + journal locally and remember the references so the
      // debounced push triggered by these state changes is suppressed.
      syncedChartsRef.current = merged.charts;
      syncedDaysRef.current = mergedJournal.days;
      syncedReviewsRef.current = mergedJournal.reviews;
      replaceCharts(merged.charts);
      replaceJournal(mergedJournal.days, mergedJournal.reviews);

      const payload = makePayload(
        merged.charts,
        merged.tombstones,
        mergedJournal.days,
        mergedJournal.reviews,
      );
      if (fileId) await updateFile(token, fileId, payload);
      else fileId = await createFile(token, payload);

      persist({
        enabled: true,
        email: resolvedEmail,
        fileId,
        lastSyncAt: payload.savedAt,
        deletedChartIds: merged.tombstones,
      });
    },
    [acquireToken, persist, replaceCharts, replaceJournal],
  );

  // Debounced push-only: upload current local charts + tombstones + journal (SPEC 10.4).
  const push = useCallback(async () => {
    const token = await acquireToken('');
    const meta = loadSyncMeta();
    const charts = chartsRef.current;
    const days = daysRef.current;
    const reviews = reviewsRef.current;
    const payload = makePayload(charts, meta.deletedChartIds, days, reviews);
    let fileId = meta.fileId;
    if (fileId) await updateFile(token, fileId, payload);
    else fileId = await createFile(token, payload);
    syncedChartsRef.current = charts;
    syncedDaysRef.current = days;
    syncedReviewsRef.current = reviews;
    persist({ fileId, lastSyncAt: payload.savedAt });
  }, [acquireToken, persist]);

  // Run a sync operation with unified status + non-blocking error handling.
  const run = useCallback(
    async (op: () => Promise<void>, opts: { silentAuthOnly?: boolean } = {}) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setStatus('syncing');
      setError(null);
      try {
        await op();
        setStatus('synced');
      } catch (e) {
        const authFailed =
          e instanceof DriveError
            ? e.status === 401 || e.status === 403
            : opts.silentAuthOnly === true;
        if (authFailed) {
          tokenRef.current = null;
          persist({ accessToken: null, tokenExpiresAt: null });
          setStatus('reconnect');
        } else {
          setStatus('error');
        }
        setError(friendlyError(e));
      } finally {
        runningRef.current = false;
      }
    },
    [persist],
  );

  const connect = useCallback(() => {
    setStatus('connecting');
    void run(() => fullSync('consent'));
  }, [run, fullSync]);

  const syncNow = useCallback(() => {
    void run(() => fullSync(''));
  }, [run, fullSync]);

  const disconnect = useCallback(() => {
    // Cancel any pending debounced push so it can't fire against a revoked token.
    if (pushTimer.current) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    // Revoke whichever token we have — in-memory, or the one persisted from a
    // previous load if this tab never re-acquired one. Best effort either way.
    const token = tokenRef.current?.accessToken ?? loadSyncMeta().accessToken;
    if (token) revokeAccessToken(token);
    tokenRef.current = null;
    clearSyncMeta(); // also wipes the persisted access token.
    syncedChartsRef.current = null;
    syncedDaysRef.current = null;
    syncedReviewsRef.current = null;
    setEmail('');
    setLastSyncAt(null);
    setError(null);
    setStatus('disconnected');
  }, []);

  // Load-time silent reconnect: if a previous session was connected AND we
  // still have an unexpired token from that session, reuse it for a
  // pull/merge/push (acquireToken will find it in metadata and skip GIS
  // entirely). Otherwise land straight in "reconnect" without ever calling
  // GIS — a `prompt: ''` request there is what popped a sign-in window on
  // every refresh, since GIS falls back to a popup whenever it can't grant
  // silently (Testing-mode consent, blocked third-party cookies, multiple
  // signed-in accounts).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const meta = loadSyncMeta();
    if (!meta.enabled) return;
    const hasValidToken = meta.accessToken !== null && (meta.tokenExpiresAt ?? 0) > Date.now();
    if (!hasValidToken) {
      setStatus('reconnect');
      return;
    }
    void run(() => fullSync(''), { silentAuthOnly: true });
  }, [run, fullSync]);

  // Debounced push on any local mutation while connected (charts OR journal).
  useEffect(() => {
    if (!loadSyncMeta().enabled) return;
    // Suppress the push caused by a merge writing back the same references we
    // just synced: only skip when NOTHING changed relative to the last sync.
    if (
      state.charts === syncedChartsRef.current &&
      state.days === syncedDaysRef.current &&
      state.reviews === syncedReviewsRef.current
    ) {
      return;
    }
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      // Re-check at fire time: the user may have disconnected while we waited.
      if (!loadSyncMeta().enabled) return;
      void run(push);
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state.charts, state.days, state.reviews, run, push]);

  const view = useMemo<SyncView>(
    () => ({
      configured: true,
      status,
      email,
      lastSyncAt,
      error,
      connect,
      disconnect,
      syncNow,
    }),
    [status, email, lastSyncAt, error, connect, disconnect, syncNow],
  );

  return <SyncContext.Provider value={view}>{children}</SyncContext.Provider>;
}

const UNCONFIGURED: SyncView = {
  configured: false,
  status: 'disconnected',
  email: '',
  lastSyncAt: null,
  error: null,
  connect: () => {},
  disconnect: () => {},
  syncNow: () => {},
};

/**
 * Provider. When sync is not configured it renders children with an inert
 * context and mounts NONE of the controller effects — the app is byte-for-byte
 * v1.2 behaviour.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  // Configuration is fixed for the page's lifetime (constant or localStorage
  // override set before load), so reading it once at mount is sufficient.
  const [configured] = useState(() => isSyncConfigured());
  if (!configured) {
    return <SyncContext.Provider value={UNCONFIGURED}>{children}</SyncContext.Provider>;
  }
  return <SyncController>{children}</SyncController>;
}

export function useSync(): SyncView {
  const ctx = useContext(SyncContext);
  return ctx ?? UNCONFIGURED;
}
