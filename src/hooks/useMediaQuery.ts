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
