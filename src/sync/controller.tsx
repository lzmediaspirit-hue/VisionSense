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
  deleteFile,
  downloadFile,
  DriveError,
  fetchUserEmail,
  listFiles,
  updateFile,
  type DriveFileRef,
  type DrivePayload,
} from './drive';
import { requestAccessToken, revokeAccessToken, type AccessToken } from './gis';
import { mergeSides, type MergeSide } from './merge';
import { mergeJournals, type Journal } from './journalMerge';
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

/**
 * Deterministically pick the canonical file among duplicates (SPEC 20): the
 * oldest `createdTime`, ties broken by the lexicographically smaller id — so
 * every device reconciling the same duplicate set converges on the SAME file
 * without needing to coordinate. Exported for direct unit coverage (the rest
 * of the controller needs a full GIS/Drive mock harness that is out of scope
 * here — this pure helper does not).
 */
export function canonicalFile(files: readonly DriveFileRef[]): DriveFileRef {
  return files.reduce((oldest, f) => {
    const t = Date.parse(f.createdTime);
    const tOldest = Date.parse(oldest.createdTime);
    if (t !== tOldest) return t < tOldest ? f : oldest;
    return f.id < oldest.id ? f : oldest;
  });
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
  //
  // Duplicate-file reconciliation (SPEC 20): `findFile` used to grab only
  // `files[0]`, so two `visionsense.json` files in appDataFolder (a race
  // between two devices each creating one when neither saw a remote copy yet)
  // meant each device kept syncing to its own file forever — both report
  // "synced" while the data never converges. Every listed match is now
  // downloaded and folded pairwise into one remote side before merging with
  // local, then the merged payload is written to a single CANONICAL file
  // (oldest `createdTime`, ties broken by the smaller id — deterministic so
  // every device converges on the same one) and every other duplicate is
  // best-effort deleted.
  const fullSync = useCallback(
    async (prompt: '' | 'consent') => {
      const token = await acquireToken(prompt);
      const meta = loadSyncMeta();

      const resolvedEmail = meta.email || (await fetchUserEmail(token));

      const listed = await listFiles(token);
      // A stale `meta.fileId` might not be among the current listing (e.g. a
      // previous reconciliation on another device deleted it as a duplicate);
      // fetch it too so its data isn't silently lost, but a 404 there just
      // means it's really gone.
      const idsToFetch = new Set(listed.map((f) => f.id));
      if (meta.fileId) idsToFetch.add(meta.fileId);

      let remote: MergeSide = { charts: [], tombstones: {} };
      let remoteJournal: Journal = { days: {}, reviews: {} };
      for (const id of idsToFetch) {
        try {
          const raw = await downloadFile(token, id);
          const parsed = parseDrivePayload(raw);
          if (!parsed) continue;
          remote = mergeSides(remote, { charts: parsed.charts, tombstones: parsed.deletedChartIds });
          remoteJournal = mergeJournals(remoteJournal, {
            days: parsed.journal?.days ?? {},
            reviews: parsed.journal?.reviews ?? {},
          });
        } catch (e) {
          if (e instanceof DriveError && e.status === 404) continue; // gone; drop it
          throw e;
        }
      }

      const merged = mergeSides(
        { charts: chartsRef.current, tombstones: meta.deletedChartIds },
        remote,
      );
      const mergedJournal = mergeJournals(
        { days: daysRef.current, reviews: reviewsRef.current },
        remoteJournal,
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

      let fileId: string;
      if (listed.length > 0) {
        const canonical = canonicalFile(listed);
        fileId = canonical.id;
        await updateFile(token, fileId, payload);
        for (const f of listed) {
          if (f.id === fileId) continue;
          try {
            await deleteFile(token, f.id);
          } catch {
            // Best effort: a duplicate left behind gets cleaned up next sync.
          }
        }
      } else {
        fileId = await createFile(token, payload);
      }

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
    const fileId = meta.fileId;
    if (fileId) {
      try {
        await updateFile(token, fileId, payload);
      } catch (e) {
        if (e instanceof DriveError && e.status === 404) {
          // The file is gone — deleted by another device's duplicate-file
          // reconciliation (SPEC 20), or removed out of band. Re-uploading
          // blind here would skip merging with whatever that device wrote to
          // ITS file, so fall back to a full pull-merge-push instead of
          // surfacing an error.
          persist({ fileId: null });
          await fullSync('');
          return;
        }
        throw e;
      }
      syncedChartsRef.current = charts;
      syncedDaysRef.current = days;
      syncedReviewsRef.current = reviews;
      persist({ fileId, lastSyncAt: payload.savedAt });
    } else {
      const created = await createFile(token, payload);
      syncedChartsRef.current = charts;
      syncedDaysRef.current = days;
      syncedReviewsRef.current = reviews;
      persist({ fileId: created, lastSyncAt: payload.savedAt });
    }
  }, [acquireToken, persist, fullSync]);

  // Run a sync operation with unified status + non-blocking error handling.
  // Returns false when skipped because another op is already in flight (the
  // caller may want to retry rather than silently drop the request), true
  // otherwise — including when the op itself failed (that failure is already
  // handled here via status/error, not something the caller should retry
  // for).
  const run = useCallback(
    async (op: () => Promise<void>, opts: { silentAuthOnly?: boolean } = {}): Promise<boolean> => {
      if (runningRef.current) return false;
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
      return true;
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
  //
  // Two invariants fixed here (SPEC 20):
  //   - NEVER push before this session has completed at least one merge. A
  //     fresh load that lands in 'reconnect' (no cached token) still runs
  //     this effect on every edit; blindly uploading local state without
  //     ever having pulled+merged could overwrite remote edits it never saw.
  //     `syncedChartsRef.current` is set only by a successful fullSync/push,
  //     so `=== null` means "no merge yet this session" — substitute a full
  //     sync for the plain push in that case.
  //   - NEVER silently call GIS from this background timer. Only fire when a
  //     still-unexpired token already exists (in memory or in stored
  //     metadata); otherwise leave local edits unsynced (safe — they persist
  //     locally and will sync on the next explicit connect/Sync now) and
  //     land in 'reconnect' rather than risk a surprise sign-in popup.
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
    const fire = () => {
      // Re-check at fire time: the user may have disconnected while we waited.
      if (!loadSyncMeta().enabled) return;
      const meta = loadSyncMeta();
      const mem = tokenRef.current;
      const hasUsableToken =
        (mem !== null && mem.expiresAt > Date.now()) ||
        (meta.accessToken !== null && (meta.tokenExpiresAt ?? 0) > Date.now());
      if (!hasUsableToken) {
        setStatus('reconnect');
        return;
      }
      const haveMergedThisSession = syncedChartsRef.current !== null;
      const op = haveMergedThisSession ? push : () => fullSync('');
      void run(op).then((ran) => {
        // `run` returns false only when another op was already in flight —
        // re-arm instead of dropping this edit on the floor (it would
        // otherwise stay unsynced until the NEXT edit fires a new timer).
        if (!ran) pushTimer.current = setTimeout(fire, PUSH_DEBOUNCE_MS);
      });
    };
    pushTimer.current = setTimeout(fire, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state.charts, state.days, state.reviews, run, push, fullSync]);

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
