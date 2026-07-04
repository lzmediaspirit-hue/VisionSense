import { NavLink } from "react-router-dom";
import { strings } from "../copy/strings";

interface TabDef {
  to: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
}

const tabs: TabDef[] = [
  {
    to: "/today",
    label: strings.nav.today,
    icon: (active) => <SunIcon active={active} />,
  },
  {
    to: "/goals",
    label: strings.nav.goals,
    icon: (active) => <TargetIcon active={active} />,
  },
  {
    to: "/evidence",
    label: strings.nav.evidence,
    icon: (active) => <LeafIcon active={active} />,
  },
  {
    to: "/settings",
    label: strings.nav.settings,
    icon: (active) => <GearIcon active={active} />,
  },
];

/**
 * Bottom tab bar on mobile; the SAME component and four destinations become a
 * left sidebar at the `lg:` (>=1024px) breakpoint, via CSS only — restyled,
 * not a different component or a new flow (engineering-plan §3).
 */
export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper-raised/95 backdrop-blur lg:sticky lg:inset-auto lg:right-auto lg:bottom-auto lg:top-0 lg:z-auto lg:order-first lg:h-screen lg:w-56 lg:shrink-0 lg:border-t-0 lg:border-r lg:bg-paper-raised/60 lg:backdrop-blur-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around lg:mx-0 lg:max-w-none lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:p-4">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1 lg:flex-none">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                [
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors duration-200 ease-calm",
                  "lg:min-h-0 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:py-2.5 lg:text-sm",
                  isActive
                    ? "text-accent-deep lg:bg-accent-soft"
                    : "text-ink-faint lg:hover:bg-paper-sunken",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {tab.icon(isActive)}
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// --- Simple, calm line icons (no icon dependency). ---

function iconClass(active: boolean): string {
  return active ? "text-accent-deep" : "text-ink-faint";
}

function SunIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function TargetIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LeafIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 4 13c0-4 3-8 9-9 0 6-2 11-9 13" />
      <path d="M4 20c4-1 7-4 9-8" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={iconClass(active)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}
