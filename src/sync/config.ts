// Google Drive sync configuration (SPEC 10.1).
//
// OAuth "web client IDs" are PUBLIC identifiers (they appear in the browser on
// every Google sign-in), not secrets — so this constant is committed. When it is
// empty AND no runtime override is set, the whole sync feature is invisible: no
// UI renders, and no external script or network request is ever made. The app
// then behaves byte-for-byte like v1.2.
//
// The owner pastes their client ID here (see docs/GOOGLE_SYNC_SETUP.md), or, for
// a quick test without rebuilding, injects one at runtime via localStorage:
//   localStorage.setItem('visionsense.sync.clientId', '<id>.apps.googleusercontent.com')

export const GOOGLE_CLIENT_ID =
  '374383189137-818jgqebact635jn1q4ir41k24v49rml.apps.googleusercontent.com';

/** localStorage key the owner/QA can set to override the compiled-in client ID. */
export const CLIENT_ID_OVERRIDE_KEY = 'visionsense.sync.clientId';

/**
 * The client ID actually in effect: the compiled-in constant if set, otherwise a
 * localStorage override, otherwise empty. Empty means "sync disabled/invisible".
 * Never throws (localStorage access can be blocked).
 */
export function effectiveClientId(): string {
  if (GOOGLE_CLIENT_ID.trim() !== '') return GOOGLE_CLIENT_ID.trim();
  try {
    if (typeof localStorage !== 'undefined') {
      const override = localStorage.getItem(CLIENT_ID_OVERRIDE_KEY);
      if (typeof override === 'string' && override.trim() !== '') return override.trim();
    }
  } catch {
    // localStorage may be unavailable (private mode / disabled cookies).
  }
  return '';
}

/** True when sync is configured and its UI/behaviour should exist at all. */
export function isSyncConfigured(): boolean {
  return effectiveClientId() !== '';
}

/** OAuth scopes: the hidden per-app Drive folder, plus identity for the email. */
export const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';
