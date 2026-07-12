// Dashboard-header sync widget (SPEC 10.5). Renders nothing unless a Google
// client ID is configured. Disconnected -> a "Connect Google Drive" button;
// connected -> a status chip (aria-live) with the account email, last-synced
// time, "Sync now" and "Disconnect". Distinct syncing/synced/error/reconnect
// states, all themed via the existing CSS custom properties.

import { useSync, type SyncStatus } from '../sync/controller';

function relativeTime(iso: string | null): string {
  if (!iso) return 'not yet';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'not yet';
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
  reconnect: 'Reconnect needed',
};

export function SyncWidget() {
  const sync = useSync();
  if (!sync.configured) return null;

  // Disconnected: single connect button.
  if (sync.status === 'disconnected') {
    return (
      <div className="sync" aria-label="Google Drive sync">
        <button type="button" className="btn btn--ghost sync__connect" onClick={sync.connect}>
          <span aria-hidden="true">☁</span> Connect Google Drive
        </button>
      </div>
    );
  }

  const busy = sync.status === 'syncing' || sync.status === 'connecting';
  const needsReconnect = sync.status === 'reconnect';

  return (
    <div className="sync" aria-label="Google Drive sync" data-status={sync.status}>
      <div className="sync__chip" role="status" aria-live="polite">
        <span className="sync__dot" data-status={sync.status} aria-hidden="true" />
        <span className="sync__chip-text">
          <span className="sync__state">{STATUS_LABEL[sync.status]}</span>
          {sync.email && <span className="sync__email">Connected as {sync.email}</span>}
          {!needsReconnect && (
            <span className="sync__meta">Last synced {relativeTime(sync.lastSyncAt)}</span>
          )}
          {sync.error && (sync.status === 'error' || needsReconnect) && (
            <span className="sync__error-text">{sync.error}</span>
          )}
        </span>
      </div>
      <div className="sync__actions">
        {needsReconnect ? (
          <button type="button" className="btn btn--primary sync__btn" onClick={sync.connect}>
            Reconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--ghost sync__btn"
            onClick={sync.syncNow}
            disabled={busy}
          >
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--danger-text sync__btn"
          onClick={sync.disconnect}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
