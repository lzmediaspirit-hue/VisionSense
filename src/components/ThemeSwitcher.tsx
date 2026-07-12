import type { ThemeId } from '../model/types';
import { AVAILABLE_THEME_IDS, THEMES } from '../themes/themes';

interface ThemeSwitcherProps {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}

/** Per-chart theme ("costume") switcher, lives in the chart header. Each swatch
 * is a nested [data-theme] element so it renders using that theme's own
 * --goal-bg — no colors hard-coded here. */
export function ThemeSwitcher({ value, onChange }: ThemeSwitcherProps) {
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Chart theme">
      {AVAILABLE_THEME_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={THEMES[id].label}
          title={THEMES[id].label}
          className={`theme-swatch ${value === id ? 'is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="theme-swatch__preview" data-theme={id} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
