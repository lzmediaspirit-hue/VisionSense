import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query. SSR-safe (defaults to false when no window). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True below the 900px desktop breakpoint (block-view territory). */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 899.98px)');
}

/**
 * True while the page is actually printing (or in print preview). Used to
 * force the full 9x9 grid even on a narrow (block-view) viewport, since the
 * print stylesheet always renders the full grid on one page (SPEC 4.2).
 * `beforeprint`/`afterprint` cover Chromium/Firefox; a matchMedia('print')
 * listener is added as a fallback for engines that only fire the query.
 */
export function usePrintMode(): boolean {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforePrint = () => setPrinting(true);
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    const mql = window.matchMedia ? window.matchMedia('print') : null;
    const onChange = (e: MediaQueryListEvent) => setPrinting(e.matches);
    mql?.addEventListener?.('change', onChange);

    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      mql?.removeEventListener?.('change', onChange);
    };
  }, []);

  return printing;
}
