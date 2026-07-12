// Google Identity Services (GIS) token-model auth (SPEC 10.2).
//
// The GIS client library is loaded DYNAMICALLY and only on demand (first connect
// or a silent reconnect on load) — never on a plain page visit by an unconnected
// user. The access token lives in memory only; renewal is silent (prompt: '')
// and disconnect revokes it.
//
// Important for browser QA: if `window.google.accounts.oauth2` already exists
// (e.g. a test stub injected before load) we use it as-is and never inject the
// <script>. That makes the whole auth path mockable without hitting Google.

import { DRIVE_SCOPES } from './config';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// --- Minimal typings for the slice of GIS we use ------------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: TokenClientConfig): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export interface AccessToken {
  accessToken: string;
  /** epoch ms when the token expires (with a safety margin already applied). */
  expiresAt: number;
}

// --- Script loading -----------------------------------------------------------

let scriptPromise: Promise<void> | null = null;

/** Resolve when `window.google.accounts.oauth2` is available, loading GIS if needed. */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else reject(new Error('Google Identity Services loaded but oauth2 is missing.'));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener(
        'error',
        () => {
          scriptPromise = null;
          reject(new Error('Failed to load Google Identity Services.'));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google Identity Services.'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// --- Token client -------------------------------------------------------------

let tokenClient: TokenClient | null = null;
let tokenClientId = '';
let pending: { resolve: (t: AccessToken) => void; reject: (e: Error) => void } | null = null;

function ensureTokenClient(clientId: string): TokenClient {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services is not available.');
  if (tokenClient && tokenClientId === clientId) return tokenClient;

  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPES,
    callback: (resp) => {
      const p = pending;
      pending = null;
      if (!p) return;
      if (resp.error || !resp.access_token) {
        p.reject(new Error(resp.error_description || resp.error || 'Authorization failed.'));
        return;
      }
      const ttlMs = (resp.expires_in ?? 3600) * 1000;
      // Apply a 60s safety margin so we renew before Google actually expires it.
      p.resolve({ accessToken: resp.access_token, expiresAt: Date.now() + ttlMs - 60_000 });
    },
    error_callback: (err) => {
      const p = pending;
      pending = null;
      p?.reject(new Error(err.message || err.type || 'Authorization failed.'));
    },
  });
  tokenClientId = clientId;
  return tokenClient;
}

/**
 * Request an access token. `prompt: ''` attempts a silent grant (used for
 * renewal and load-time reconnect); `prompt: 'consent'` forces the consent
 * screen (used for an explicit user-initiated connect).
 */
export async function requestAccessToken(
  clientId: string,
  prompt: '' | 'consent' | 'select_account',
): Promise<AccessToken> {
  await loadGis();
  const client = ensureTokenClient(clientId);
  return new Promise<AccessToken>((resolve, reject) => {
    if (pending) {
      pending.reject(new Error('Superseded by a newer token request.'));
    }
    pending = { resolve, reject };
    try {
      client.requestAccessToken({ prompt });
    } catch (e) {
      pending = null;
      reject(e instanceof Error ? e : new Error('Authorization failed.'));
    }
  });
}

/** Revoke a token (best effort) on disconnect. Never throws. */
export function revokeAccessToken(token: string): void {
  try {
    window.google?.accounts?.oauth2?.revoke(token, () => {});
  } catch {
    // Best effort — revocation failure must not break disconnect.
  }
}
