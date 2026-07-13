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

## 12. v1.5 additions (locked): weekly-cadence habits

Not every habit belongs on a daily cadence ("gym 3× a week" is honest; a daily
nag for it is not). This adds a per-habit weekly target alongside the
existing daily habit tracking, with no changes to how completions, streaks,
or the graph/calendar work.

### 12.1 Data model
`Action` gains `weeklyTarget: number` (default `0`). It is only meaningful
when `habit === true`:
- `weeklyTarget === 0` → **daily** habit, exactly today's behaviour (unchanged).
- `weeklyTarget >= 1` → **weekly** habit, aiming for that many check-off days
  per ISO week (1..7; the detail-dialog control offers 1..6, since 7 is just
  "every day").
- `isWeeklyHabit(action)` (`src/model/progress.ts`) is the derived predicate:
  `action.habit && action.weeklyTarget >= 1`.

Check-offs are unchanged: a weekly habit still uses `toggleHabitToday`, one
completion per local day, exactly like a daily habit. Because
`collectCompletions` already walks every action's `completions`, the Progress
graph (daily/monthly/yearly buckets), the Calendar tab, and the all-charts
streak already include weekly-habit check-offs with **no code changes**.
Chart-progress "done" ("X / 64") is also unchanged: a habit still counts as
done only when `established` — meeting a week's target is a per-week signal,
not a permanent achievement, so `isActionDone` is untouched.

### 12.2 Weekly progress helpers
`src/model/journal.ts` gains two pure helpers built on the existing
`isoWeekKey`:
- `weekCompletions(action, now)` — the count of DISTINCT local days within
  `now`'s ISO week that have a completion.
- `isWeeklySatisfied(action, now)` — `weeklyTarget >= 1 &&
  weekCompletions(action, now) >= weeklyTarget`; always `false` for a daily
  habit (`weeklyTarget === 0`).

### 12.3 Detail dialog: cadence control
The Action detail dialog's habit switch is reworded ("Track as a habit" /
"...every day, or a few set days a week", since it's no longer daily-only).
When the habit switch is on, a **"How often?"** `<select>` appears above the
"Mark as established" toggle: "Every day" (0) or "1× a week".."6× a week"
(1..6), writing through `setActionCadence` (`src/model/operations.ts`) on
change. Its hint shows this week's progress once a weekly cadence is chosen
("Aim for N days each week. This week: X / N."). The established toggle's
copy drops "daily" ("no more check-ins" / "stops asking for check-ins") since
check-ins can now be a few days a week.

### 12.4 Today view: a separate weekly-habits section
The "Daily habits" section on `TodayView` now only lists `weeklyTarget === 0`
habits (`isWeeklyHabit` filters the rest out), exactly as before. A new
**"Weekly habits"** section renders immediately after it, **only when at
least one weekly habit exists** (no empty state — the daily section already
carries the "get started" nudge). Each row is a daily-habit row plus a
progress pill (`{weekCompletions} / {weeklyTarget} this week`); the row gets
`is-done` styling when `isWeeklySatisfied` — i.e. the week's target is met —
independent of whether *today* was checked off. The check button itself
still toggles today's completion via the same `toggleHabitToday` path, with
the same daily aria-label pattern ("Did it today" / "Undo today for").

### 12.5 Compatibility
Additive-only: `schemaVersion` stays 1. `validateAction` (`src/model/
storage.ts`) defaults `weeklyTarget` to `0` for any old/foreign value —
absent, wrong type, non-integer, negative, or > 7 — so pre-v1.5 localStorage
blobs, JSON chart exports, and synced Drive files (which route through the
same `validateChart`) all load as daily habits, unchanged. No sync-payload
shape changes: `weeklyTarget` rides inside `Action` through the existing
chart merge/push/pull path.

## 9. Repository layout

App lives at the repo root: `index.html`, `src/`, `package.json`, `docs/SPEC.md`
(this file). `src/` split: `src/model/` (types, factories, migrations, storage —
pure, tested), `src/state/` (React context/reducer), `src/components/`,
`src/themes/`, `src/templates/`.

## 13. v1.6 additions (locked): onboarding

A new user used to land on an empty 9x9 grid with no worked example and no
explanation of the method. This adds two purely additive, first-run-only
onboarding surfaces: a fully-filled example chart, and a "How it works"
guide. Neither changes `schemaVersion` (stays `1`), and neither affects an
existing user who already has at least one chart.

### 13.1 The example chart
`src/templates/example.ts` builds one fully-filled Mandala chart — "Finish my
first marathon" (8 pillars x 8 actions, a representative mix of plain tasks,
daily habits, weekly-cadence habits, if-then cues, rewards, and in-progress /
done statuses, plus a few live completions seeded relative to "today" so the
demo never looks stale) — entirely from `createChart`/`createAction` spreads,
so it always tracks the current `Action`/`Chart` shape.

It carries a **fixed id** (`EXAMPLE_CHART_ID = 'example-marathon'`) and a
**sentinel** stored in the chart's existing `templateId` field
(`EXAMPLE_TEMPLATE_ID = 'example'`) — reusing the "provenance only" field
with no schema change.

**First-run seed** (`seedFirstRun`, `src/state/store.tsx`): wraps the
reducer's lazy `useReducer` init. It seeds the example chart if and only if
`state.charts.length === 0 && !getFlag(EXAMPLE_SEEDED_KEY)`, and immediately
sets `EXAMPLE_SEEDED_KEY` (`visionsense.example.seeded` in localStorage) the
moment it runs. Consequences:
- A returning device, or one that syncs in any chart from another device,
  is **never** seeded — the `charts.length === 0` check alone already
  protects it, before the flag is even consulted.
- Deleting the example chart afterwards does **not** bring it back — the
  flag is set at seed time, not tied to the chart's continued presence.
- The example chart is a normal `Chart`: it saves, exports, prints, and
  **syncs like any other chart** (no special-casing anywhere in storage,
  export/import, or the Drive sync/merge layers).

**Badge + adopt-to-edit flow**: the dashboard chart card shows a small muted
`chart-card__badge` ("Example") next to the title whenever
`chart.templateId === EXAMPLE_TEMPLATE_ID`. Opening the example chart shows a
slim dismissible banner above the grid ("This is an example chart —
duplicate it to make it your own.") with a **"Duplicate & edit"** button.
That button dispatches a new reducer action, `ADOPT_EXAMPLE`, which
duplicates the chart (reusing `duplicateChart` from `model/factory.ts` for
fresh ids/timestamps throughout), **clears the copy's `templateId` to
`null`** (so the copy is a real, badge-free, bannerless chart), inserts it,
and opens it. The original seeded example is untouched, so it can be
duplicated again later. The banner's "×" dismiss hides it for good via
`visionsense.example.bannerHidden` in localStorage (does not touch the
badge, and does not delete the example).

### 13.2 "How it works" dialog
`src/components/HowItWorksDialog.tsx` is a native `<dialog>` modal (same
`modal-overlay`/`modal`/Esc-and-backdrop-close pattern as `ConfirmDialog` and
`TemplatePicker`) explaining the Rule of 8, the 3-step build flow, the
habit/cue/reward loop, the Today/Weekly-review discipline layer, and where
data lives. It is reachable from a "?" button in the dashboard header
(before "Import JSON"), and is **auto-shown exactly once, ever**: on the
Dashboard's first mount, a `useRef` guard (mirroring the sync controller's
`didInit` pattern, so it never re-fires on a later re-render) checks
`getFlag(HELP_SEEN_KEY)` (`visionsense.help.seen`); if unset, it opens the
dialog and sets the flag immediately. A returning user (flag already set)
never sees it auto-open again — they can still reach it any time via the "?"
button. When the seeded example chart exists, the dialog's primary footer
button ("Explore the example") opens it directly.

### 13.3 Compatibility
Additive-only, exactly like every prior version bump: `schemaVersion` stays
`1`. `src/model/onboarding.ts` holds the three onboarding flag keys
(`EXAMPLE_SEEDED_KEY`, `HELP_SEEN_KEY`, `EXAMPLE_BANNER_HIDDEN_KEY`) plus
best-effort `getFlag`/`setFlag` helpers (typeof-guarded, try/catch, mirroring
`sync/metadata.ts`'s localStorage style) — a disabled or missing
localStorage just means the onboarding UI may be asked to show again, never
a crash. Because seeding is gated purely on `charts.length === 0`, an
existing user with any chart — including one who has never opened this
version of the app before — is completely unaffected: no seeded chart, no
auto-opened dialog, no new badge or banner anywhere in their data.

## 14. v1.7 (locked): visual polish

A design pass from a UI/UX review, CSS-first with a handful of small
component edits. **Presentation only**: `schemaVersion` stays `1`, no
`Chart`/`Action` shape changes, no new reducer actions, no behavior change to
any existing feature — every change below is either a CSS rule or a
render-time (not data) decision.

### 14.1 Empty ACTION cells are quiet by default
A fresh or partly-filled chart used to render the word "Action" in faint
gray across every empty action cell — up to 62 repeated labels on a mostly
empty 8x8 grid, visible on screen, in the PNG export, and on the printed
page. `PLACEHOLDER` in `Cell.tsx` is unchanged (still `'Action'`), but its
visibility is now conditional:
- **Screen** (`src/index.css`): `.cell--action.is-empty .cell__placeholder`
  is `opacity: 0` at rest and fades to `opacity: 1` on
  `:hover`/`:focus-within` (120ms). `:focus-within` on the cell shell (which
  carries the roving `tabIndex`) means the reveal fires for keyboard
  navigation exactly like it does for mouse hover. GOAL and PILLAR
  placeholders are untouched — they stay always-visible, since that
  structure ("Your goal", "Pillar") is what teaches the Rule of 8 to a new
  chart.
- **PNG export** (`src/export/renderChartPng.ts`): `renderChartPng` now
  skips the text-draw step entirely for an empty action cell
  (`!isFilled && cell.kind === 'action'`) — a static image has no hover
  state, so the quiet default is to omit the placeholder rather than show it
  unconditionally. Empty goal/pillar cells still draw their placeholder.
- **Print**: `.chart-header` (and therefore the coaching hint) is already
  `display: none` under `@media print`; the on-screen opacity-0 default for
  empty action placeholders is not overridden by any print rule, so printed
  pages show the same blank-at-rest cells with no extra CSS needed.

### 14.2 A display type tier
`src/themes/themes.css` adds one structural token to `:root`:
`--fs-display: clamp(1.7rem, 4vw, 2.4rem)`, applied (via `index.css`) to
`.today__date`, `.review__week`, and `.dashboard__title` as
`font-weight: 700; letter-spacing: -0.02em; line-height: 1.1`, replacing
their previous flat `1.35rem/650` treatment. These three headings are the
app's emotional anchors (today's date, the week being reviewed, the app's
own name on first load) and now read with real typographic presence instead
of body-text weight. The clamp keeps them from overflowing at a 375px
viewport without a separate media query.

`--fs-goal` (the Mandala goal cell's font token) is bumped from `0.98rem` to
`1.15rem` for the same reason at grid scale. Because the goal cell is a
fixed ~73px square regardless of viewport (the desktop grid's cell width is
capped by `--grid-max: 860px` past the 900px compact breakpoint), a flat
increase reintroduced the mid-word shearing described in 14.3 — verified
against the shipped example chart's own goal, "Finish my first marathon"
(see 14.3 for the fix).

### 14.3 Cell text wraps and hyphenates instead of shearing
Long single words in a narrow GOAL or PILLAR cell (e.g. a pillar renamed
"Team & Relationships") used to hard-break mid-syllable with no visible
hyphen — `overflow-wrap: break-word` firing without `hyphens: auto`
producing a readable result. `.cell--goal .cell__text` and
`.cell--pillar .cell__text` now add `text-wrap: balance` (more even line
breaks) on top of the existing `hyphens: auto; overflow-wrap: break-word`.

That alone was not sufficient: this deployment environment's headless
Chromium ships no hyphenation dictionary, so `hyphens: auto` is a silent
no-op there (real end-user browsers on macOS/Windows typically do have one,
but the fix cannot depend on that). Verified empirically at both 1280px and
375px viewports with a pillar named "Team & Relationships": the word
"Relationships" alone is wider than the ~73px desktop grid cell at any font
size above ~11.1px, so both `.cell--pillar .cell__text` and
`.cell--goal .cell__text` now carry a `clamp()`-based font-size step-down
(`clamp(0.66rem, 2.4vw, 0.68rem)` for pillar text, `clamp(0.82rem, 2.4vw,
0.9rem)` for goal text) whose *ceiling* — not just its floor — sits below
the measured shearing threshold for each cell's font weight. A vw-scaled
`clamp()` alone was not enough: because desktop cell width plateaus past the
900px breakpoint, a naive clamp's preferred value quickly exceeds its own
ceiling and the type never actually shrinks, which is why both ceilings were
tuned down directly rather than left at the cell's base `--fs-pillar`/
`--fs-goal`. This is a best-effort mitigation, not a guarantee: a single
word longer than ~12 characters (e.g. "Craftsmanship") can still shear in a
goal cell at any font size that fits a ~73px square — a pre-existing
limitation, unchanged by this pass, that only a real hyphenation dictionary
can fully solve.

### 14.4 Chart header diet
`ChartScreen.tsx`'s header used to show: back button, the static
"VisionSense" brand, the theme switcher, Today, Progress, three separate
export/print buttons, the progress strip, and a permanent coaching hint —
enough chrome that the export buttons wrapped to a second row on mobile.
- **Export ▾ menu**: "Export JSON", "Export PNG", and "Print" collapse into
  one ghost button ("Export ▾") that toggles a `.chart-header__menu-popover`
  (`role="menu"`, items are `role="menuitem"` `<button>`s calling the same
  `onExportJson`/`onExportPng`/`onPrint` handlers as before — export/print
  *behavior* is unchanged, only its presentation). The trigger carries
  `aria-haspopup="menu"` and `aria-expanded`. Open state is a plain
  `useState`; a `useEffect` (only attached while open) adds
  `mousedown`/`keydown` listeners on `document` that close the menu on an
  outside click or `Escape`, mirroring the outside-click/Esc pattern already
  used by this app's native `<dialog>`s but implemented directly since this
  is a lightweight popover, not a modal. Each menu item also closes the menu
  after firing its handler. Today (primary) and Progress (ghost) stay as
  standalone visible buttons.
- **Goal as header title**: `.chart-header__brand` (the static "VisionSense"
  wordmark) is replaced by `.chart-header__title`, showing
  `chart.goal.trim() || 'Untitled chart'` — better wayfinding when several
  charts are open across tabs/sessions. Single-line, `text-overflow:
  ellipsis`, with a native `title` tooltip for the untruncated value.
- **Auto-hiding coaching hint**: `.chart-header__hint` ("8 pillars,
  exactly...") now only renders while `chartProgress(chart).filled < 8` —
  it's a build-time nudge for a chart that hasn't gotten going yet, not
  permanent chrome. No persistence: it reappears if filled count ever drops
  back below 8 (e.g. after clearing actions), which is fine since it's
  purely advisory.
- The theme switcher is unchanged (not folded into the menu), and no
  export/print behavior changed — only how the three actions are presented.

### 14.5 Quick wins
- **Faint-text contrast**: `--text-faint` is nudged darker in all four
  themes (minimal `#aab0bd`→`#8a90a0`, stadium `#93a89b`→`#7a9184`, marquee
  `#a8977e`→`#8f7d63`, campus `#9aa6bb`→`#828fa6`) so the now-hover-revealed
  action placeholders (14.1) and other faint text clear roughly 3.5:1
  contrast on their surfaces. The PNG exporter reads this var at export time
  (`resolveThemeColors`), so it stays in sync automatically.
- **Cell title tooltips**: `Cell.tsx`'s filled-text `<span>` now carries
  `title={cell.text}` when the cell is filled, so a desktop user can hover a
  clamped/truncated cell (long action text especially) to read the full
  value without opening the detail dialog.

## 15. v1.8 (locked): structural polish

A second design-review pass, again CSS-first with a handful of small
component edits. **Presentation only**: `schemaVersion` stays `1`, no
`Chart`/`Action` shape changes, no new reducer actions, no behavior change to
any existing feature.

### 15.1 Grid-seam color split from UI chrome borders
The costume themes (stadium, marquee) painted `.grid`'s block gaps with
`--border-strong` and `.block`'s cell gaps with `--border` — the same two
tokens every card, input, dialog, and calendar hairline uses. Since those
themes set `--border`/`--border-strong` to loud, saturated colors (marquee
`--border: #4a1e28`), the costume leaked into every piece of chrome, not
just the grid. Meanwhile each theme already defined a dedicated `--grid-bg`
token that nothing read.
- **`src/index.css`**: `.grid`, `.block--mobile`, and `.overview` now paint
  with `var(--grid-bg)` instead of `var(--border-strong)`. `.block` uses
  `color-mix(in srgb, var(--grid-bg) 45%, var(--surface))` — lighter than
  the block-level seam, preserving the existing two-weight gap hierarchy
  (block gaps read stronger than cell gaps within a block). `.block--pillar`
  and `.block--mobile.block--pillar` mix `--cell-accent` with `--grid-bg`
  instead of `--border`/`--border-strong`.
- **`src/themes/themes.css`**: stadium and marquee's `--border`/
  `--border-strong` are returned to quiet neutrals with a whisper of each
  theme's temperature — stadium `--border: #d9e4dc; --border-strong:
  #b9c9be;`, marquee `--border: #e4d9c6; --border-strong: #c9bba0;`. minimal
  and campus were already neutral and are unchanged. The unused
  `--fs-pillar` token is removed (grep-verified: only referenced inside a
  code comment, never as an actual CSS value).
- **`src/export/renderChartPng.ts`**: `ThemeColors` gains `gridBg` (reads
  `--grid-bg`, falls back to `#e6e8ee`), replacing the now-unused
  `borderStrong` field. The canvas "grout" fill (the full-grid background
  painted before cells, whose uncovered strip reads as the seam) uses
  `colors.gridBg` so the PNG export matches the live grid exactly.
- Net effect: minimal/campus render near-identically to before (their
  `--grid-bg` was already close to the old border colors). Stadium and
  marquee keep their dramatic dark grid seams, but every other hairline —
  cards, inputs, dialogs, the theme switcher — now reads as quiet, neutral
  chrome instead of the costume color.

### 15.2 Bigger touch targets + a legible due-count pill
Three corner controls in the grid cells (`.cell__status`,
`.cell__habit-check`, `.cell__expand`) were 20×20px, the Today check
(`.mit__check`) was 26px, and the dashboard's review due-indicator was an
unlabeled 8px dot — all below WCAG 2.2's 24px minimum target size.
- **Cell corner controls**: visible size is unchanged (20px box, 12px
  glyph) — each gets a `::before { content: ''; position: absolute; inset:
  -6px; }`, expanding the clickable/tappable area to 32px without changing
  how the cell looks. `.cell__habit-badge` is a non-interactive `<span>`
  (`pointer-events: none`) and was left alone.
- **Today check** (`.mit__check`): visible size goes 26px → 32px, plus the
  same `-6px` inset `::before` trick for a ~44px effective target
  (`.mit__check` gained `position: relative` since, unlike the cell
  controls, it wasn't already a positioned element).
- **Due-count pill** (`.due-badge` + `Dashboard.tsx`): the 8px dot is
  replaced by a small pill reading "1" (`aria-hidden="true"`, the button's
  existing `aria-label="Review (due)"` already carries the accessible
  meaning). Restyled to `min-width: 15px; height: 15px; border-radius:
  999px; font-size: 0.62rem; font-weight: 700; line-height: 15px;
  text-align: center; color: #fff;` on the existing `--status-doing`
  background and surface ring. The wider pill needed clearance from the
  "Review" label it sits beside, so `.dashboard__cta-review:has(.due-badge)`
  adds `padding-right: 1.4rem`.

### 15.3 Dashboard: content first
- **Mini-mandala thumbnails**: each chart card's flat 30px theme-swatch dot
  is replaced by `ChartThumb` (`src/components/ChartThumb.tsx`), a live 3×3
  render of the chart's actual state. It maps grid order the same way
  `MiniMap` does (`CENTER_BLOCK`/`orderToPillarIndex` from `../model/grid`):
  the center tile is the goal (`background: var(--goal-bg-solid)`), the 8
  outer tiles are pillars, each colored via an inline `--tile-accent:
  pillar.color` custom property (same pattern `MiniMap` uses) and filled
  bottom-up with `pillarProgress(pillar)`'s done/filled ratio. An empty
  pillar (`filled === 0`) gets `opacity: 0.35`. The now-unreferenced
  `.chart-card__swatch` CSS rule was removed (grep-verified single
  producer/consumer).
- **Sync widget demoted below the chart list**: `<SyncWidget />` moves in
  `Dashboard.tsx` from above the chart list to after it (before
  `TemplatePicker`), so the dashboard's actual content — the user's charts —
  leads, and account/sync chrome trails. `.sync` is restyled more compactly
  (tighter padding, `margin-top` instead of `margin-bottom` for its new
  trailing position), and its Disconnect button is scoped-softened
  (`.sync__btn.btn--danger-text`) to a muted color at rest with the danger
  red only surfacing on hover — quieter than Dashboard's Delete button,
  which intentionally stays red at rest since it's more destructive.
  Compatibility constraint: no accessible names, text content, aria-labels,
  `data-status` attributes, or button labels changed — layout and visual
  weight only, verified by an automated pass that these strings and all
  buttons remain intact and clickable.

## 16. v1.9 (locked): the loop, closed

A third design-review pass, closing the plan → do → review loop that 11.2/
11.3 opened: Today told you what to do but buried the if-then cue and
repeated the chart name on every row; the weekly review's "What went well?"
had nothing to reflect against even though the app already had all the
data. **Presentation + one pure helper**: `schemaVersion` stays `1`, no
`Chart`/`Action`/`DayPlan`/`Review` shape changes, no new reducer actions.

### 16.1 Today: group by pillar, promote the cue
`TodayView.tsx`'s Daily-habits and Weekly-habits lists no longer render one
flat `.mit-list` with every row repeating "«chart title» · «pillar»" in
`.mit__context`. Rows are grouped (in a `useMemo`, from the existing
`habitRows`, by chart id then pillar index, preserving encounter order):
under each chart, a small eyebrow (`.today__chart-eyebrow`) names the chart
— but ONLY when the user has more than one chart, since with a single chart
it would just repeat the app's only goal on every screen; under each
chart's pillar, a muted uppercase sub-header (`.today__pillar-name`, visual
values copied from `.picker__pillar-name` rather than sharing the class,
since the picker dialog is a different component context) fronts that
pillar's `.mit-list`. Habit rows drop the per-row `.mit__context` line
entirely — the grouping now carries chart/pillar. The if-then cue
(`.mit__cue`) moves up to be the row's second line, directly under
`.mit__text`, and changes color from `--text-faint` to `--text-muted` —
promoted from the faintest text on the row to the thing a reader's eye
actually lands on, since the if-then cue is the method's actual mechanism
("after breakfast, at the park"), not a footnote. MIT ("Top 3 for today")
rows keep their `.mit__context` line (there's no pillar grouping to carry it
there) but slim it to `{multi ? `${chartTitle} · ` : ''}{pillarName}`, and
get the same cue promotion, ordered text → cue → context. The MIT picker
dialog, its grouping, and its own `.picker__pillar-name` are untouched.

### 16.2 Weekly review: an evidence strip
`WeeklyReview.tsx` renders an evidence strip above the four prompts — "This
week:" followed by wrapping chips (`.review__evidence`) — whenever there's
anything to show. A pure helper, `weekEvidence(charts, now)` in
`src/model/journal.ts` (the file that already owns `isoWeekKey` /
`weekCompletions`), computes:
```ts
interface WeekEvidence {
  habits: Array<{ name: string; days: number; target: number }>;
  tasksDone: number;
  streak: number;
}
```
`habits` is every filled, non-established habit across all charts in
encounter order, with `days = weekCompletions(action, now)` and
`target = weeklyTarget >= 1 ? weeklyTarget : 7` (a daily habit's target is
the 7 days in the week). `tasksDone` counts non-habit actions with
`status === 'done'` and a `completedAt` that parses into `now`'s ISO week.
`streak` reuses `streakAcrossCharts` (SPEC 11.2) so the review echoes the
same number Today shows. One chip per habit reads `{days} / {target}
{name}` (name capped at ~18ch with an ellipsis so a long action text can't
blow out the row); beyond 8 habits the rest collapse into a single "+N
more" chip. A `{tasksDone} action(s) done` chip and a `{streak}-day streak`
chip follow, each only rendered when > 0. Chip visuals
(`.review__chip`) copy `.mit__week`'s CSS values rather than sharing the
class, since `.mit__week` is a flex-child pill scoped to the Today view's
`.mit` row. The strip is purely informational — `aria-label="This week's
evidence"` on the container, chips are plain `<span>`s, nothing is
interactive. The four textareas, ISO-week save behavior, past-reviews list,
and dashboard due-badge logic are unchanged.

### 16.3 Compatibility & quality
Additive-only: `weekEvidence` is a new pure export, unit-tested in
`journal.test.ts` (daily-habit target 7, weekly-habit target N, completions
outside the current ISO week excluded, `tasksDone` counts only this week's
completions, established/unfilled habits excluded, empty charts yield
empty evidence). The "Daily habits" / "Weekly habits" headings and their
`aria-labelledby` sections, `.mit-list` / `.mit` / `.mit__check` /
`.mit__text` / `.mit__cue` / `.mit__week` semantics, `.mit.is-done`, every
existing aria-label string (`Did it today: "X"`, `Undo today for "X"`,
`Complete "X"`, `Undo "X"`, "Today view", "Pick today's top 3", "Weekly
review", "Back to your charts"), and the MIT picker dialog are all
unchanged. Mobile-first at 375px, no horizontal scroll.

## 17. v1.10 (locked): teach visually, celebrate completion

A fourth design-review pass, covering onboarding (#10) and completion
moments (#11). **Presentation + derived state only**: `schemaVersion` stays
`1`, no `Chart`/`Action`/`Pillar` shape changes, no new reducer actions. One
new pure helper (`isPillarComplete` in `src/model/progress.ts`).

### 17.1 How it works: the diagram does the teaching
`HowItWorksDialog.tsx` replaces its five headings of prose beside a static
mini-grid with a 3-step animated sequence (`step: 0 | 1 | 2`, `useState`,
reset to 0 on every fresh open). A `.hiw-stage` (~128px, 3x3 grid of
`.hiw-mini` tiles) shows what's being taught:
- Step 0 "Name your goal" — the center tile lights up (`.hiw-mini--goal`,
  the theme's solid goal background), the other 8 stay dim
  (`.hiw-mini--dim`). Copy: "One goal at the centre. Everything on the
  chart exists to serve it."
- Step 1 "Choose 8 pillars" — the center tile stays lit; the 8 surrounding
  tiles take their pillar colors (`--pillar-color-0..7`, one fixed mapping
  from grid position to pillar slot, skipping the center). Copy: "Exactly 8
  pillars — the Rule of 8 forces you to choose what matters."
- Step 2 "Break each into 8 actions" — same 9-tile stage, but one pillar
  tile (a fixed slot) gets a `.hiw-mini--exploding` treatment (scale +
  ring), and a second small 3x3 grid (`.hiw-actions`) appears beside it: a
  solid center tile plus 8 outer tiles that pulse in
  (`@keyframes hiw-pulse-in`, staggered `animationDelay`) in that pillar's
  color, representing its 8 actions. Copy: "Each pillar gets 8 concrete
  actions — 64 in all. Make them habits with a when-and-where, and check
  them off from Today."

Navigation is a step-dot row (`.hiw-dots`, 3 buttons, each
`aria-label="Step N"` + `aria-current`) plus a ghost "Next" button
(`.hiw-next`) that advances the step and disappears on step 2 (kept simple:
hidden, not disabled). All tile transitions (background/opacity/transform)
and the pulse-in animation are CSS `transition`/`animation`, gated to `none`
under `prefers-reduced-motion: reduce` (same pattern the toast already
used) so the diagram still communicates its end-state instantly.

Below the sequence, one condensed paragraph replaces the old "Make it a
routine" + "Stay on track" sections: "Turn any action into a habit with a
when-and-where cue and a reward. The **Today** view surfaces your top picks
each day; the **Weekly review** keeps you honest." The old "Your data"
section shrinks to a single footnote line (`.hiw-footnote`, sized like
`.field__hint`): "Your data lives on this device — optional Google Drive
sync backs it up to your own Drive."

The dialog's `aria-label="How it works"`, the "Explore the example" /
"Got it" buttons and their accessible names, and the once-ever auto-open
logic in `Dashboard.tsx` (first-run detection via the seeded example chart
+ `HELP_SEEN_KEY`) are all unchanged.

### 17.2 Dashboard: the Today button carries the streak
`Dashboard.tsx` computes `streakAcrossCharts(state.charts)` (already
exported from `src/model/completions.ts` for the Today view, SPEC 11.2),
memoized on `charts`. When it's > 0, a small pill (`.cta-streak`, sized like
`.due-badge` but `rgba(255,255,255,0.25)` on white text, since the Today
button is primary-filled) renders after the label, inside
`<span className="cta-streak" aria-hidden="true">`. Because the streak text
is `aria-hidden`, the button carries an explicit `aria-label="Today"` so its
accessible name stays exactly `"Today"` — `getByRole('button', { name:
'Today', exact: true })` still resolves. At streak 0, no pill renders.

### 17.3 Pillar-complete: a lit cell and a one-time toast
A pillar is "complete" when all 8 of its action cells are both filled and
done: `isPillarComplete(progress)` in `src/model/progress.ts` is
`progress.filled === RULE_OF_8 && progress.done === RULE_OF_8` (unit-tested
in `progress.test.ts`). `Cell.tsx` already receives `progress` for pillar
cells (from `Grid.tsx`/`pillarProgress`); it derives `pillarComplete` and
adds `is-complete` to the cell's class list. CSS:
```css
.cell--pillar.is-complete {
  background: color-mix(in srgb, var(--cell-accent) 26%, var(--surface));
}
.cell--pillar.is-complete .cell__progress-fill {
  background: var(--cell-accent);
}
```
26% was checked against every shipped theme's pillar palette, including the
marquee theme's darkest slot (`--pillar-color-7: #3a2f33`) — text stays
legible. Both cells that mirror a pillar's name (the hub in the center
block and the non-hub center-cell of the pillar's own block) receive
`progress` and so both light up together.

`ChartScreen.tsx` detects the transition into complete — never firing from
habit daily check-offs, which don't touch `done` — via a shared
`maybeFirePillarToast(pillarIndex, nextChart)` helper: it computes
`isPillarComplete(pillarProgress(pillar))` on the *current* `chart` prop
(before) and on the pillar within a `nextChart` obtained by calling the same
pure operation (`setActionStatus` / `setActionEstablished`) locally against
`chart` — a second, throwaway call alongside the real
`mutateActive((c) => operation(c, ...))` dispatch, never a second dispatch
to the store. `applyStatus` runs this check only when `target === 'done'`;
`onSetEstablished` runs it only when `established` is being set to `true`.
When the check flips `false` → `true`, it fires
`{ kind: 'pillar', message: pillar.name.trim() || 'Pillar', accent:
pillar.color }`. If a reward toast and a pillar-complete toast would both
fire from the same click (task marked done, carries a reward, and is the
pillar's 8th), the pillar toast wins (fires second, so it's the one shown)
since finishing a pillar is the rarer, larger moment.

### 17.4 Toast polish
`RewardToastData` gains a third `kind: 'pillar'` (copy "Pillar complete:
{name}", a new sparkle-burst glyph, colored via `.toast--pillar
.toast__glyph { color: var(--toast-accent, var(--accent)) }`) and an
optional `accent?: string`, set to the pillar's color for pillar toasts
only (reward/establish toasts are unchanged and carry no accent). The toast
element sets `style={{ '--toast-accent': accent }}` when present; CSS reads
`border-left: 3px solid var(--toast-accent, var(--accent))` on `.toast` for
every kind (a quiet default border for reward/establish, an accent one for
pillar). The entrance animation swaps its old slide-up for a scale-in
(`scale(0.92) → 1` + opacity, 180ms `var(--ease)`) and stays gated under
`@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }` —
the existing rule, unchanged in structure — so a reduced-motion viewer still
sees the toast appear instantly rather than not at all.

### 17.5 Compatibility & quality
Dialog aria-label, "Explore the example"/"Got it" accessible names, and the
first-run-only auto-open are untouched. The Today button's accessible name
stays exactly `"Today"`. `RewardToast` text patterns ("Reward unlocked:",
"Habit established:") and the `.due-badge` / `.mit__check` treatments are
untouched. No data-model or schema changes. Mobile-first at 375px, no
horizontal scroll; verified with Playwright against the example chart's
"Gear & logistics" pillar (3 actions already done; marking its remaining 5
— including its one habit, via establish — done lights the cell and fires
the toast exactly once, on the 8th) and with `reducedMotion: 'reduce'`
emulation (toast still appears, instantly).
