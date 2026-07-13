# VisionSense

**Live app: https://lzmediaspirit-hue.github.io/VisionSense/**

A goal-achievement web app built on the **Harada Method / Mandala Chart (Open
Window 64)** — the 9×9 planning grid popularized by Shohei Ohtani: one central
goal, 8 supporting pillars, and 8 concrete actions per pillar (64 in total).

Unlike a freeform outliner, the **Rule of 8 is structural**: the grid always has
exactly 8 pillars and 8 actions each — there is no way to add a 9th. That
constraint (forced prioritization over sprawl) is the method's core mechanism.

The guiding philosophy: *to be in the 1% you do what the other 99% doesn't do* —
pre-decide when and where you'll act, plan each day before it starts, and
review every week without fail. Each layer of the app maps to evidence from
the goal-attainment literature (see `docs/SPEC.md` §11 for citations).

## Features

### Getting started
- **First-run onboarding** — a brand-new device seeds one fully-filled
  example chart ("Finish my first marathon", badged and deletable) plus a
  one-time "How it works" guide, so you never start from a blank grid with
  no idea what goes where. Both are purely first-run: existing charts and
  returning users are never touched.

### The chart
- **9×9 grid** with the pillar names mirrored between the center "hub" block and
  each pillar's own block — a single source of truth, editable from either place
- **Inline editing** directly on the grid (Enter/blur commits, Esc cancels),
  full keyboard navigation (arrow keys between cells)
- **Action status tracking** — todo → doing → done, with per-pillar progress and
  an overall completion strip
- **Action details** — long descriptions that never overflow a cell, a
  **reward** per action (celebration toast on completion), and an **if-then
  plan** ("When & where?") so the trigger is decided in advance
- **Domain templates** — Blank, Athlete, Founder, Student, Actor, Life Plan —
  each pre-filling 8 credible pillar names and pairing with a default theme
- **Themes ("costumes")** — minimal, stadium, marquee, campus; per-chart,
  restyling the grid without touching your data

### The habit layer
- **Daily habits** — any action can be tracked as a daily check-off instead of
  a one-shot task; rewards fire on every check (the reinforcement loop)
- **Established habits** — graduate a habit when it's automatic; it counts as
  done and stops asking for check-ins (and can be un-established)
- **Weekly habits** — track a habit as a set number of days per week (gym
  3× / week); Today shows this-week progress and marks the goal met
- **Progress graphs** — daily / monthly / yearly bar charts of completions,
  plus a month **calendar** shaded by activity, and a streak counter

### The daily discipline layer
- **Today view** — the morning ritual: your streak, a **Top 3 for today**
  picker (capped at three, drawn from every chart), one-tap habit check-offs,
  and an evening "What did you learn today?" reflection
- **Weekly review** — four guided prompts saved per week with a read-only
  history and a subtle due badge on the dashboard

### Infrastructure
- **Multi-chart dashboard** with duplicate and delete
- **Export / import** — versioned JSON (with strict validation on import),
  hand-rendered PNG at 2× scale, and a print stylesheet that fits the full grid
  on one landscape page
- **Google Drive sync (optional)** — sign in with Google and your data backs up
  to a hidden app-folder in *your own* Drive (`drive.appdata` scope — the app
  cannot see any other files). Cross-device merge is per-chart last-write-wins
  with deletion tombstones; day plans and reviews sync too. Local-first:
  everything works offline and without an account
- **Mobile-first** — below 900px the grid becomes a block-at-a-time view with a
  hub, mini-map, swipe navigation, and a full-grid overview toggle
- **Robust persistence** — everything lives in `localStorage` under a versioned
  key; corrupt data never crashes the app, and every schema change has been
  additive (old blobs and old exports always load)

## Development

```bash
npm install
npm run dev      # dev server
npm test         # Vitest (model, journal, sync-merge layers)
npm run build    # type-check + production build
npm run preview  # serve the production build
```

Stack: Vite + React 18 + TypeScript (strict), plain CSS custom properties for
theming, zero runtime dependencies beyond React. Pushes to `main` deploy to
GitHub Pages automatically via `.github/workflows/deploy-pages.yml`.

## Docs

- [`docs/SPEC.md`](docs/SPEC.md) — the build spec: locked product decisions,
  data model, feature scope by version (v1.0–v1.4), and acceptance criteria.
- [`docs/GOOGLE_SYNC_SETUP.md`](docs/GOOGLE_SYNC_SETUP.md) — one-time owner
  setup for Google Drive sync (OAuth client ID).
