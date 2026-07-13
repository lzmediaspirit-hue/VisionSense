// First-run onboarding flags (v1.6, SPEC 13): tiny localStorage booleans that
// gate the one-time example-chart seed, the one-time "How it works" dialog,
// and the example-chart banner dismissal. Mirrors sync/metadata.ts's
// best-effort localStorage style: every read/write is typeof-guarded and
// try/catched so a disabled or missing localStorage never crashes the app —
// worst case the onboarding UI is just asked to show again.

/**
 * Set once the first-run example chart has been seeded (or the seed was
 * skipped because the user already had charts). Never cleared — deleting the
 * example chart afterwards must not bring it back.
 */
export const EXAMPLE_SEEDED_KEY = 'visionsense.example.seeded';

/** Set once the "How it works" dialog has been auto-shown on first run. */
export const HELP_SEEN_KEY = 'visionsense.help.seen';

/** Set once the example-chart banner in ChartScreen has been dismissed. */
export const EXAMPLE_BANNER_HIDDEN_KEY = 'visionsense.example.bannerHidden';

/** Best-effort localStorage boolean read: true only when the flag was set. */
export function getFlag(key: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Best-effort localStorage boolean write. Never throws. */
export function setFlag(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, '1');
  } catch {
    // ignore (quota / disabled storage) — worst case the flag is asked again.
  }
}
