# VisionSense — Mandala Chart (OW64) Web App: Build Spec v1.0

This spec refines the "Mandala Chart System — Research Brief & Web App Requirements"
document into concrete, buildable decisions. Where the brief left open questions, this
spec locks them to the brief's own recommended defaults. The brief's research content
(Harada Method background, competitive scan) is not repeated here.

## 1. Decisions locked (from the brief's open questions)

| Question | Decision |
|---|---|
| Local-only vs. accounts | **Local-only.** No backend, no auth. All data in `localStorage` under a versioned key. Zero-friction: the app is usable instantly. |
| Grid depth | **Fixed 2-level** (goal → 8 pillars → 8 actions each). No infinite nesting. |
| Monetization | None. |
| Platform | **Mobile-first responsive web.** Single-page app, static hosting. |

## 2. Tech stack

- **Vite + React 18 + TypeScript** (strict). No backend.
- **Plain CSS with CSS custom properties** for theming (no Tailwind, no CSS-in-JS —
  keeps the theme "costume" system trivial and the bundle small).
- **No runtime dependencies beyond React** unless genuinely needed. PNG export is
  done by drawing the chart to a `<canvas>` by hand (the chart is a grid of text —
  no html-to-image library needed). PDF export = print stylesheet + `window.print()`.
- Tests: **Vitest** for the state/storage layer (pure functions). UI verified by QA
  in a real browser; no component-test framework in MVP.

## 3. Data model (localStorage, versioned)

```ts
type ActionStatus = 'empty' | 'todo' | 'doing' | 'done';
// 'empty' is derived (text === ''), stored statuses are todo/doing/done

interface Action {
  id: string;        // stable uuid
  text: string;      // '' = unfilled cell
  status: ActionStatus;
}

interface Pillar {
  id: string;
  name: string;      // '' = unfilled
  color: string;     // one of 8 theme slot colors, index-derived by default
  actions: Action[]; // ALWAYS length 8 — invariant, enforced by constructors
}

interface Chart {
  id: string;
  goal: string;               // the center cell
  themeId: ThemeId;           // 'minimal' | 'stadium' | 'marquee' | 'campus'
  templateId: string | null;  // provenance only
  pillars: Pillar[];          // ALWAYS length 8 — invariant
  createdAt: string;          // ISO
  updatedAt: string;
}

interface AppState {
  schemaVersion: 1;
  charts: Chart[];
  activeChartId: string | null;
}
```

- Storage key: `visionsense.v1`. A `migrate()` function runs on load; unknown/corrupt
  data falls back to empty state without crashing (keep the corrupt blob under
  `visionsense.v1.backup` rather than deleting it).
- Position is array index (0–7); no separate position field.
- **The "Rule of 8" is enforced structurally**: pillars and actions are fixed-length
  arrays created at chart construction. There is no `addPillar`/`addAction` API at
  all — only `rename`/`setText`/`setStatus`/`swap` (reorder). The UI therefore cannot
  sprawl past 8; empty cells render as inviting placeholders instead.
- Phase-2 objects (GoalForm, RoutineCheckItem, DiaryEntry) are **not built**, but the
  top-level `AppState` + versioned migration means they can be added later without a
  rebuild. Do not scaffold dead types for them.

## 4. MVP feature set (what gets built now)

### 4.1 Core (build phase 1 — Opus)
1. **Chart screen: the 9×9 grid** — a 3×3 arrangement of 3×3 blocks.
   - Center block: goal in the middle, 8 pillar names around it.
   - Each pillar repeats as the center of its own outer block; the 8 cells around it
     are that pillar's actions.
   - Canonical mapping (block positions 0–8 reading order, 4 = center block):
     pillar *i* (0–7) lives at block position `[0,1,2,3,5,6,7,8][i]`, and its
     mirror cell inside the center block sits at the same offset. Editing a pillar
     name in either place updates both (single source of truth).
   - Pillar blocks are tinted with the pillar's color slot; hovering/focusing a
     pillar name highlights its block (per the competitive scan's best feature).
2. **Inline editing on the grid itself** — click/tap a cell to edit in place
   (textarea grows within the cell); Enter/blur commits, Esc cancels. No modal for
   basic text entry.
3. **Action status cycling** — a small check control on each action cell cycles
   todo → doing → done → todo. Done cells get a clear visual treatment. Status
   control only appears once a cell has text.
4. **Progress** — per-pillar completion (done/filled) shown on the pillar cell
   (e.g. thin progress ring or bar), plus an overall "X / 64 actions, Y done" strip
   in the chart header.
5. **Persistence** — every mutation writes through to localStorage (debounced ok).
   Reload restores exactly.
6. **Responsive strategy** (the brief demands a *real* mobile answer):
   - **≥ 900px**: full 9×9 grid, always visible.
   - **< 900px**: "block view" — one 3×3 block fills the screen; the center block is
     the hub; tapping a pillar cell in the hub zooms to that pillar's block; a
     3×3 mini-map + back control navigates between blocks. Swipe left/right moves
     between adjacent pillar blocks. No horizontal-scrolling 9×9 on phones.
7. **Method guardrails in copy, not popups** — e.g. empty-state hints
   ("8 pillars, exactly — if you have 9, merge two") and a one-line reminder that
   actions should be measurable behaviors. No blocking dialogs.

### 4.2 Feature layer (build phase 2 — Sonnet)
1. **Dashboard / multi-chart** — landing screen lists saved charts (title, theme
   swatch, progress, updated date), create/duplicate/delete (delete needs confirm).
   With local storage this is near-free and it's what makes templates usable, so it
   is pulled forward from the brief's V2 into MVP.
2. **Templates** — creating a chart offers: **Blank**, **Athlete**, **Founder,**
   **Student**, **Actor**, **Life Plan**. Templates pre-fill the 8 pillar names
   (domain-appropriate) and leave all 64 actions empty; user can rename everything.
   Each template pairs with a default theme.
3. **Theming ("costume") system** — 4 themes as pure CSS custom-property sets:
   `minimal` (default), `stadium` (athlete), `marquee` (actor), `campus` (student).
   Theme is per-chart, switchable from the chart header. Every theme must pass
   basic contrast (WCAG AA for cell text).
4. **Export / import**
   - **JSON export** of a single chart (versioned envelope) + import with
     validation (reject wrong shape with a friendly error, never crash).
   - **PNG export**: render the full 9×9 to canvas at 2x scale and download.
   - **Print stylesheet**: `@media print` renders the full grid cleanly on one
     landscape A4/Letter page — this is the "PDF export" and the "post it somewhere
     visible" story.

### 4.3 Explicitly out of scope (V2+, do not build)
Full Harada Method flow (goal form / routine sheet / diary), sharing/collab, streak
tracking over time, AI suggestions, accounts/sync, infinite nesting.

## 5. Non-functional requirements

- **Accessibility**: all cells reachable and editable by keyboard (Tab into grid,
  arrows between cells, Enter to edit); status control is a real button with
  `aria-label`; focus visible in every theme.
- **Performance**: no perceptible lag typing into cells (avoid re-rendering all 81
  cells per keystroke — memoize cell components).
- **Robustness**: corrupt/absent localStorage never white-screens the app.
- **Quality bar**: `npm run build` and `npm test` pass clean; TypeScript strict; no
  console errors in normal use.

## 6. Acceptance criteria (QA checklist)

1. Fresh visit → dashboard empty state → create "Athlete" template chart → grid shows
   8 pre-filled pillar names mirrored correctly between hub and outer blocks.
2. Edit goal, a pillar name (from both hub and outer block), and several actions;
   reload → everything persists.
3. Cannot add a 9th pillar/action by any means; empty cells invite, never sprawl.
4. Cycle an action todo → doing → done; pillar progress and header counts update.
5. At 375px viewport: block view works — hub → pillar block → back; no horizontal
   page scroll.
6. Export JSON → delete chart → import JSON → chart restored identically.
7. PNG export downloads a legible full-grid image; print preview fits one page.
8. Theme switch restyles the chart and persists; text stays readable in all 4 themes.
9. Keyboard-only: create, fill, and complete an action without a mouse.
10. `npm run build` + `npm test` clean.

## 7. v1.1 additions (locked)

### 7.1 Action details (expand on the text)
`Action` gains optional `description: string` and `reward: string` (default `''`).
Clicking a cell still inline-edits the title, and the title stays line-clamped in
the cell — long text never breaks the cell bounds. A new expand affordance on
action cells (visible on hover/focus, always visible on touch) opens an **Action
detail dialog**: title, description (long text), reward, and the status control.
Cells with a description or reward show a subtle indicator so you know there is
more behind the cell.

### 7.2 Completion history + progress graph
`Action` gains `completedAt: string | null` (ISO): set when the action
transitions into `done`, cleared when it leaves `done` (honest history — undoing
removes the completion). A **Progress** button in the chart header opens a
dialog with three views: **Daily** (last 30 days), **Monthly** (last 12 months),
**Yearly** (per year) — completions per bucket as a bar chart with an overall
completion summary. Hand-rolled SVG, themed via the existing CSS custom
properties, with an accessible text summary. No chart libraries.

### 7.3 Rewards (habit reinforcement)
When an action that has a reward transitions into `done`, show a dismissible
celebration toast — "Reward unlocked: {reward}". The reward is also shown in the
detail dialog. Quiet, tasteful, no confetti storms.

### 7.4 Compatibility
`schemaVersion` stays 1: the new fields are additive and optional — validation
defaults them when absent, so existing localStorage data and previously
exported JSON files load/import unchanged. Exports include the new fields.

## 8. Repository layout

App lives at the repo root: `index.html`, `src/`, `package.json`, `docs/SPEC.md`
(this file). `src/` split: `src/model/` (types, factories, migrations, storage —
pure, tested), `src/state/` (React context/reducer), `src/components/`,
`src/themes/`, `src/templates/`.
