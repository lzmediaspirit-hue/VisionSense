# VisionSense

A customizable, adaptable goal-setting web app built on the **Harada Method /
Mandala Chart (Open Window 64)** — the 9×9 planning grid popularized by Shohei
Ohtani: one central goal, 8 supporting pillars, and 8 concrete actions per
pillar (64 in total).

Unlike a freeform outliner, the **Rule of 8 is structural**: the grid always has
exactly 8 pillars and 8 actions each — there is no way to add a 9th. That
constraint (forced prioritization over sprawl) is the method's core mechanism.

## Features

- **9×9 grid** with the pillar names mirrored between the center "hub" block and
  each pillar's own block — a single source of truth, editable from either place
- **Inline editing** directly on the grid (Enter/blur commits, Esc cancels),
  full keyboard navigation (arrow keys between cells)
- **Action status tracking** — todo → doing → done, with per-pillar progress and
  an overall completion strip
- **Domain templates** — Blank, Athlete, Founder, Student, Actor, Life Plan —
  each pre-filling 8 credible pillar names and pairing with a default theme
- **Themes ("costumes")** — minimal, stadium, marquee, campus; per-chart,
  restyling the grid without touching your data
- **Multi-chart dashboard** with duplicate and delete
- **Export / import** — versioned JSON (with strict validation on import),
  hand-rendered PNG at 2× scale, and a print stylesheet that fits the full grid
  on one landscape page
- **Mobile-first** — below 900px the grid becomes a block-at-a-time view with a
  hub, mini-map, and swipe navigation
- **Local-only** — no accounts, no backend; everything persists to
  `localStorage` (corrupt data never crashes the app)

## Development

```bash
npm install
npm run dev      # dev server
npm test         # Vitest (model layer)
npm run build    # type-check + production build
npm run preview  # serve the production build
```

Stack: Vite + React 18 + TypeScript (strict), plain CSS custom properties for
theming, zero runtime dependencies beyond React.

## Docs

- [`docs/SPEC.md`](docs/SPEC.md) — the build spec: locked product decisions,
  data model, feature scope, and acceptance criteria.
