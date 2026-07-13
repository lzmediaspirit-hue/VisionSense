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

## 8. v1.2 additions (locked): the habit layer

This brings the app closer to the Harada Method's Routine Check Sheet: some
actions are not one-shot tasks but daily behaviours.

### 8.1 Habit actions (daily check-off)
`Action` gains `habit: boolean` (default `false`) and `completions: string[]`
(default `[]`, ISO timestamps of daily check-offs). Toggled in the detail
dialog ("Track daily as a habit"). For a habit action:
- The cell's status control becomes a **"did it today"** check: checking
  appends a timestamp to `completions`; unchecking the same local day removes
  that day's entry. At most one completion per local day.
- Visual state derives from "checked today": checked-today renders like done;
  an unchecked habit renders like todo (with a subtle habit marker so it reads
  as recurring, not unstarted). The stored `status`/`completedAt` fields remain
  but are ignored for habits.
- A habit's reward toast fires on each daily check (that is the reinforcement
  loop), not just the first.

### 8.2 Established habits
`Action` gains `established: boolean` (default `false`), set from the detail
dialog ("Mark as established — no more daily check-ins"). An established habit:
- shows a distinct badge on its cell and stops offering the daily check;
- counts as **done** toward chart/pillar progress (the habit is achieved);
- keeps its completion history in graphs/calendar;
- can be un-established (life happens), returning it to daily tracking.
- When first marked established, celebrate with a toast ("Habit established:
  {title}") — this is the graduation moment.

### 8.3 Daily progress counting
The Progress graph's daily/monthly/yearly buckets count **events**: habit
check-offs (each `completions` entry) plus task completions (`completedAt`).
Streak = consecutive local days with ≥1 event, unchanged otherwise.
Chart progress ("X / 64 done"): a task counts when `status === 'done'`; a
habit counts when `established`.

### 8.4 Calendar view
The Progress dialog gains a **Calendar** tab: a month grid (weeks as rows,
localized weekday header, current month by default) where each day cell is
shaded by that day's event count (0 = empty, deeper shade for more — reuse the
theme accent scale). Month back/forward navigation; today outlined; a day's
count available as a tooltip/aria-label. Pure CSS/HTML grid, no libraries.

### 8.5 Compatibility
Same additive rules as v1.1: `schemaVersion` stays 1, validation defaults the
new fields, old localStorage blobs and old JSON exports load/import unchanged.

## 10. v1.3 additions (locked): Google Drive sync ("login to save")

Optional cloud backup/sync while preserving the local-first architecture: no
backend of ours, the app remains a static site. The user signs in with Google
and the app stores its data in the **hidden app-data folder of the user's own
Google Drive** (scope `drive.appdata` — the app cannot see any other Drive
files, and the user can revoke at any time).

### 10.1 Configuration & graceful absence
- `src/sync/config.ts` exports `GOOGLE_CLIENT_ID: string` (committed; OAuth web
  client IDs are public identifiers, not secrets). **When empty, the entire
  sync feature is invisible** — no UI, no external script loads, app behaves
  exactly as v1.2. This ships before the user has created their client ID.
- The Google Identity Services script (`https://accounts.google.com/gsi/client`)
  is loaded dynamically only when sync is used (user clicks connect, or a
  previous session was connected) — never on plain page load for
  unconnected users.

### 10.2 Auth
- GIS **token model** (`google.accounts.oauth2.initTokenClient`), scopes:
  `https://www.googleapis.com/auth/drive.appdata openid email`.
- Access token kept in memory only. On expiry (~1h) re-request silently
  (`prompt: ''`); if silent renewal fails, sync pauses and the UI shows a
  **Reconnect** affordance (local editing is never blocked).
- `email` (via OpenID userinfo) is shown as "Connected as {email}".
- Disconnect: revoke the token (`google.accounts.oauth2.revoke`), clear sync
  metadata. **Local data is kept** — disconnect never deletes charts.

### 10.3 Storage & merge
- One JSON file `visionsense.json` in `appDataFolder` holding
  `{ schemaVersion: 1, charts, deletedChartIds, savedAt }` — the same chart
  shapes as local storage, validated with the same defaults on read.
- Sync metadata in localStorage under `visionsense.sync.v1`:
  `{ enabled, email, fileId, lastSyncAt, deletedChartIds: Record<chartId, deletedAtISO> }`.
- **Merge is per chart, last-write-wins on `updatedAt`**; charts present on
  only one side are kept (union). Chart deletion writes a tombstone into
  `deletedChartIds`; on merge a tombstone newer than the chart's `updatedAt`
  removes it (otherwise the chart survives and the tombstone is dropped).
  Tombstones older than 90 days are pruned. Merge logic is **pure functions in
  `src/sync/merge.ts` with Vitest coverage** (union, LWW, tombstone win/lose,
  idempotence).
- Drive REST calls are a thin fetch wrapper in `src/sync/drive.ts`
  (list-by-name in `appDataFolder` spaces, download media, multipart
  create/update). The token is injected (function argument / small interface)
  so the layer is mockable in tests and browser QA.

### 10.4 Sync behaviour
- On connect: pull remote (if any) → merge with local → save merged locally →
  push merged to Drive.
- While connected: every local mutation schedules a **debounced (~2 s) push**;
  app load with `enabled` metadata attempts silent reconnect then a pull+merge.
- A **"Sync now"** control forces pull+merge+push.
- Failures (offline, 401/403, quota) are non-blocking: status chip shows the
  error state, local editing continues, next successful sync catches up.

### 10.5 UI
- Dashboard header gains a sync widget: disconnected → "Connect Google Drive"
  button (only when a client ID is configured); connected → status chip with
  last-synced time, "Connected as {email}", **Sync now** and **Disconnect**.
  States (syncing / synced / error / reconnect) get distinct, themed styling
  and accessible names. No blocking dialogs; errors are quiet.

### 10.6 Token persistence (v1.4.2)
Refreshing the page used to re-run the load-time silent reconnect with only
an in-memory access token, so it was always gone after a reload and Google
had to be asked for a new one via `prompt: ''`. GIS answers that request with
a **popup** whenever it cannot grant silently (Testing-mode consent screens,
blocked third-party cookies, multiple signed-in Google accounts) — so every
refresh could pop a sign-in window, even for an already-connected user.

- Sync metadata (`visionsense.sync.v1`) gains `accessToken: string | null` and
  `tokenExpiresAt: number | null` (epoch ms, the existing 60s safety margin
  already applied) alongside the existing fields.
- Token lookup order for a silent request (`prompt: ''`): (1) the in-memory
  token if unexpired; (2) the token stored in sync metadata if unexpired —
  hydrates the in-memory copy and returns it **without contacting GIS**; (3)
  only then a silent `requestAccessToken` call. Any new token returned by GIS
  (silent or consent) is written back to sync metadata immediately.
- **No popup at page load, ever.** If sync is enabled but the stored token is
  missing or expired, the load-time effect skips GIS entirely and sets status
  to `reconnect`; the existing Reconnect button drives the consent flow from
  a user gesture, which GIS is allowed to satisfy with UI.
- A 401/403 from Drive, and an explicit disconnect, both clear the stored
  token (disconnect also revokes it, in-memory or stored, best effort) so a
  dead token is never reused.
- Security tradeoff: the token is scoped to `drive.appdata` only (no access to
  the rest of the user's Drive) and lives for at most about an hour. Storing
  it in localStorage — rather than, say, an httpOnly cookie — is an accepted
  tradeoff for an app with no backend of its own to hold it more safely.

### 10.7 Compatibility
No changes to the chart data model; `schemaVersion` stays 1. Sync metadata
lives under its own key. Old blobs/exports unaffected. The one-time setup the
owner must do in Google Cloud Console (create OAuth client ID, authorize the
Pages origin) is documented in `docs/GOOGLE_SYNC_SETUP.md`.

## 11. v1.4 additions (locked): the 1% layer — daily discipline, if-then plans, weekly review

Design principle (owner's philosophy): "to be in the 1% you do what the other
99% doesn't do." The 99% set goals; the 1% pre-decide when/where they'll act,
plan each day before it starts, and review every week without fail. Each
feature below is grounded in the goal-attainment literature:
- **Implementation intentions** ("if [cue], then [action]") raise goal
  attainment d ≈ 0.65 over goal intentions alone (Gollwitzer & Sheeran 2006,
  94 tests, 8k+ participants).
- **Progress monitoring** raises attainment d ≈ 0.40 (Harkin et al. 2016,
  138 studies, ~20k participants), stronger when progress is physically
  recorded.
- **Weekly written review** is the highest-leverage cadence (Matthews: written
  goals + weekly progress ≈ 76% attainment vs ~43% baseline); this is also the
  Harada Method's own daily diary / routine check sheet layer, which the app
  has not had until now.

### 11.1 If-Then plans (implementation intentions)
`Action` gains `cue: string` (default `''`). The Action detail dialog gains a
"When & where?" field (placeholder like "After breakfast, at the park") above
the reward field. The cue is displayed with the action in the Today view
(11.2) and in the detail dialog. Cells do NOT grow a new indicator (the
existing detail dot already covers "there's more here"). Additive/optional:
validation defaults it, exports include it, `schemaVersion` stays 1.

### 11.2 Today view (Harada daily diary + MIT top-3)
A new **Today** screen reachable from a prominent button on the dashboard AND
from the chart header. Content, top to bottom:
1. **Date heading + current streak** (consecutive local days with ≥1 event
   across ALL charts — reuse `src/model/completions.ts`).
2. **Top 3 for today (MITs)**: the user picks up to 3 actions from any chart
   (a picker lists filled, not-done, not-established actions grouped by
   chart → pillar; shows each action's cue). Each picked MIT renders as a row:
   action text, chart/pillar context, cue (if set), and a one-tap complete
   control — habits check off today (`toggleHabitToday`), tasks go to `done`
   (`withStatus`), both reusing the existing reward-toast behaviour. Completed
   MITs render visibly done. Picks are per-day; yesterday's picks never leak
   into today.
3. **Daily habits**: every habit action (not established) across all charts,
   with its today-check state and one-tap toggle, cue shown. Established
   habits do not appear.
4. **Evening reflection**: a single free-text line "What did I learn today?"
   saved per day, plus an auto summary line of what got done today.
   Method copy in empty states, e.g. "The 99% start their day without a plan.
   Pick the 3 actions that will make today count."

Data: `AppState` gains optional `days: Record<string /* local YYYY-MM-DD */,
DayPlan>` with `DayPlan = { mits: Array<{ chartId, actionId }> (max 3,
structurally capped), note: string, updatedAt: ISO }`. MIT completion state is
always derived from the referenced action — never duplicated. Days older than
~400 days are pruned on write. Store gains a `mutateChart(chartId, fn)`
action (generalizing `mutateActive`) so Today can complete actions in any
chart, plus day-plan mutations. Validation defaults `days` to `{}` (old blobs
unaffected); dangling MIT references (deleted chart/action) are silently
dropped on render.

### 11.3 Weekly review
A **Review** screen/dialog reachable from the dashboard. Guided prompts, all
optional short free-text: "What went well?", "What got in the way?", "What
will you do differently?", and "**#1 focus next week**". Saved per ISO week
(`YYYY-Www`). Past reviews are listed read-only (newest first) under the
form. The dashboard Review button shows a subtle **due badge** when the
current week has no review yet AND the newest review (if any) is ≥7 days old
or absent. No blocking dialogs, no guilt copy.
Data: `AppState` gains optional `reviews: Record<string /* YYYY-Www */,
Review>` with `Review = { wins, obstacle, change, focus: string; updatedAt:
ISO }`, defaulted to `{}` by validation.

### 11.4 Sync
`DrivePayload` gains optional `journal: { days, reviews }` (absent → both
`{}`). Merge is per-key LWW on `updatedAt` (a pure function next to
`mergeSides`, unit-tested: union, LWW both directions, idempotence). The sync
controller pushes/pulls the journal alongside charts; pre-v1.4 remote files
and clients keep working (validation defaults).

### 11.5 Compatibility & quality
Additive-only as always: `schemaVersion` stays 1; old localStorage blobs,
old chart JSON exports, and pre-v1.4 Drive files load unchanged. Chart JSON
export/import is unchanged (the journal is app-level, not part of a chart).
All UI themed via existing custom properties, mobile-first at 375px with no
horizontal scroll, keyboard accessible, stable aria-labels for QA (e.g.
"Today view", "Pick today's top 3", "Weekly review").

## 9. Repository layout

App lives at the repo root: `index.html`, `src/`, `package.json`, `docs/SPEC.md`
(this file). `src/` split: `src/model/` (types, factories, migrations, storage —
pure, tested), `src/state/` (React context/reducer), `src/components/`,
`src/themes/`, `src/templates/`.
