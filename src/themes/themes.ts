// Theme registry. Phase 1 ships only 'minimal'. Adding a theme in phase 2 is
// purely additive: define its CSS custom properties in themes.css under a
// `[data-theme="<id>"]` selector and list its id here.

import type { ThemeId } from '../model/types';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
}

export const THEMES: Record<ThemeId, ThemeMeta> = {
  minimal: { id: 'minimal', label: 'Minimal' },
  // Phase 2 themes (CSS costumes only) — declared for type completeness.
  stadium: { id: 'stadium', label: 'Stadium' },
  marquee: { id: 'marquee', label: 'Marquee' },
  campus: { id: 'campus', label: 'Campus' },
};

export const DEFAULT_THEME: ThemeId = 'minimal';

/** The themes actually implemented and offered in the UI in this phase. */
export const AVAILABLE_THEME_IDS: ThemeId[] = ['minimal'];
