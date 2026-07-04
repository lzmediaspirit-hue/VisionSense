# Engineering Plan — "Outsmarting Reality" Habit Tracker

**Source of requirements:** `concepts.md` (product-designer analysis of *Outsmarting Reality* by Nero Knowledge). Concept IDs (C1–C14), trade-off IDs (T1–T6), and technique numbers referenced throughout are from that document.

**Constraints locked in by product owner:** mobile-first/responsive single codebase; single-user, local-only storage, no backend/accounts/sync; offline support not required; React preferred; local storage for persistence.

This plan resolves the open questions in concepts.md §5 decisively so the team can start building. Where a call was made, the rationale is stated inline.

---

## 0. Decisions on open questions (read this before the rest)

- **Q1 (secular vs. spiritual language):** Ship with the book's own vocabulary (frequency, old frequency, self-trust, alchemy) as the default and *only* copy layer for MVP. A secular-translation toggle is a post-MVP feature (see §2), not worth the copy-maintenance burden for v1.
- **Q2 (how prescriptive is the Technique):** Guided wizard with editable free-text fields at each step, not a rigid form. The wizard supplies prompts/scaffolding (per Technique steps in concepts.md §4 item 8); the user's own words are always the content, honoring "it must be your own" (p.36).
- **Q4 (unit of the app):** Hybrid, as concepts.md recommends: **Desired Reality** (goal-as-feeling) is the top-level object; **Habits** (inner/outer tier, C10) nest under it; **Exercises**, **Nudges**, and **Evidence** attach to either a habit or a desired reality.
- **Q5 (measuring progress without external outcomes):** The only first-tier metrics on screen are Self-Trust, Momentum, and "times you accessed your target feeling this week" (C12). No external-outcome tracking fields exist in the data model.
- **T1 (streaks):** No hard resettable streak counter anywhere in the product. Momentum (C5) and Self-Trust (C4) replace it entirely, both using decay functions, never a hard reset (see §4).
- **T3/T4 (pressure, notifications):** No countdowns, due-date badges, or red "overdue" states. Reminders (if any, post-MVP) are opt-in and worded as invitations, never alarms.

---

## 1. MVP core features (target: 2–4 weeks solo dev)

| # | Feature | Concept(s) | Priority |
|---|---|---|---|
| 1 | **Onboarding: create a Desired Reality** — name the goal, capture its target feeling (e.g. "secure," "seen"), and an optional "normalize it" toggle framing it as already-normal rather than urgently wanted. | C12, C8 | P0 |
| 2 | **Habit CRUD with inner/outer tier + start/stop type** — user creates habits attached to a Desired Reality, tagged as inner (frequency/state work) or outer (physical action), and as start-doing or stop-doing. Inner habits render above outer habits everywhere. | C10, C6 | P0 |
| 3 | **Daily home screen ordered inner-first** — the single daily entry point. Shows today's inner habits, then outer habits, with Self-Trust and Momentum front and center instead of a task list count. | C10, C3, T2 | P0 |
| 4 | **Check-in: one tap "kept" / gentle "not today" per habit** — no red/fail styling; a missed check-in logs an ITFT ledger event and immediately shows a one-line non-judgmental reframe, never the word "failed." | C4, C1, T5 | P0 |
| 5 | **Self-Trust meter** — headline 0–100 stat computed from the ATFT/ITFT ledger (formula in §4), visibly the app's primary number, replacing streak counts. | C4, T1 | P0 |
| 6 | **Momentum accumulator** — a second, secondary stat that compounds with consecutive aligned days and decays gently (never snaps to zero) on a missed day. Shown for both start- and stop-habits. | C5, C14, T1 | P0 |
| 7 | **Daily base-state check-in** — one screen, once a day: "What's your base emotional state today?" free text or short tag, timestamped. This is the centerpiece daily ritual. | C7 | P0 |
| 8 | **Polarity Transmutation guided exercise** — 3-step flow: name the feeling → app suggests the opposite polarity → user logs 1–3 pieces of real evidence the opposite already exists. Completing it is a trackable activity that feeds Momentum and the Evidence Log. | C7, technique #7 | P0 |
| 9 | **Evidence / Wins log** — a running feed of every completed habit, exercise, and logged evidence item, presented as "wins," with no failure counterpart. | C13 | P0 |
| 10 | **Mental Nudges inbox** — quick-capture list for intuitive to-dos ("message someone," "apply for that job"); marking one "acted on" records time-to-act, which feeds the Self-Trust ledger as a fast-ATFT event. | C10, technique #15 | P0 |
| 11 | **Relapse/setback reframe screen** — triggered on a missed check-in or a logged "bad day": shows the three C2 prompts verbatim (how would the version of you in your desired reality look at / feel about / think about this?) and a one-tap link to Past Wins. Never uses "wrong," "fail," "should." | C2, C14, T5 | P0 |
| 12 | **Put-off list** — a simple recurring list ("things you've been putting off"); clearing an item logs an ATFT event. | C4, technique #5 | P1 |
| 13 | **"Relax first" gate** — a 60–120 second breathing/stillness timer that must be completed (or explicitly skipped) before opening the Technique or Emotional Alchemy exercises. | C9 | P1 |
| 14 | **Settings + data export/import (JSON)** — schema version display, manual export/import to a file, and a "clear all data" action with confirmation. Not glamorous but load-bearing given local-only storage has no backup. | (infra, supports all) | P0 |

MVP deliberately **excludes**: the full 24-item technique inventory, seven-keys Frequency Audit, belief-adoption tool, self-worth/social-contract reflections, and charts/analytics beyond the two headline stats. These come post-MVP (§2) — building all 24 guided exercises before shipping anything is the single biggest scope-creep risk (see §7).

---

## 2. Optional advanced features (post-MVP), phased

### Phase A — Deepen the inner-work system
- **Seven Keys taxonomy on habits** — let inner habits be tagged Beliefs / Conviction / Perception / Emotionally-charged thoughts / Focus / Reactions / Expectations, unlocking the next item. (C11)
- **Frequency Audit** — periodic (weekly) screen rating alignment across all seven keys for the active Desired Reality, highlighting the most-neglected key. (C11)
- **The exclusive two-part Technique, full guided wizard** — Part 1 looped-visualization scene builder with the book's worked scripts as optional templates (love/job/income/physique/business); Part 2 daily carry-sentence + feeling reminder pushed into the day. (technique #8)
- **Emotional Alchemy 8-step guided reset** — full step-by-step flow (relax → bring adversity to mind → feel fully → hold until it shifts → reach neutrality → extract the seed → feel the shift → integrate), offered whenever a check-in logs a strongly negative state. (C14, technique #16)

### Phase B — Conviction & belief tools
- **Belief-adoption exercise** — "If I were living my desired reality, what would I believe?" wizard, output becomes a trackable daily affirmation. (C13, technique #13)
- **Conviction/Expectation daily entry** — "What do you know will happen?" one-line daily log, separate from the base-state check-in. (technique #15)
- **Micro-manifestation starter quests** — optional small preset challenges (spot a specific car/color, find a parking space) to stack quick wins early. (C13, technique #9)
- **"Be a source" habit template** — a suggested paired action per goal type (want money → tip/give; want love → show affection). (C8, technique #10)

### Phase C — Reflection & self-worth layer
- **Collective-belief release field** per Desired Reality — name a societal "truth" opposing the goal and mark it consciously released. (supporting concept, Transcend the Collective)
- **Self-sabotage / social-contract reflection** — a guided prompt that watches for the "guilt after progress" pattern and offers a reframe. (Prepare To Be Bad)
- **Internal validation scene** — a Technique variant focused on self-worth (imagined praise/respect). (Energetic Ceiling)
- **Perception-Projection daily prompt** — "If the version of me in my desired reality jumped into my body, how would it look at this?" as an optional daily card. (Perception-Projection Loop)
- **Attention/Focus audit** — "Which polarity did you feed today?" lightweight daily toggle. (Attention Beats Intention)

### Phase D — Quality-of-life / secondary
- **Secular-language toggle** (Q1) — swaps copy between book vocabulary and plain-English equivalents ("old frequency" → "old habit-identity").
- **Charts/trends view** — Self-Trust and Momentum over time as simple line sparklines; feeling-frequency histogram (how often each target feeling was accessed). Strictly internal-state charts, never external-outcome charts (Q5).
- **Reminders** — local, opt-in, gently worded notifications (requires a service worker even without offline support, or a simple `Notification`/`setTimeout`-based approach while the tab/app is open — evaluate cost/benefit; likely stays out of scope since owner ruled out sync/offline infra).
- **Theming** — a calm color/typography settings pass (explicitly out of scope for this document, which is planning-only, but flagged as a real backlog item).

---

## 3. UI/UX approach

### Key screens

1. **Today (home)** — Purpose: the single daily ritual entry point. Shows, top to bottom: Self-Trust meter, Momentum indicator, "how are you feeling" quick-access to the base-state check-in if not yet done today, then inner habits, then outer habits, then the Mental Nudges inbox preview (max 3, "see all" link). Main interaction: tap a habit to mark it kept; long-press or a secondary affordance opens "not today" (never a red X).
2. **Desired Realities (goals list + detail)** — Purpose: manage the top-level goals. List shows each Desired Reality's name and target feeling as a soft tag, no progress bars/percentages. Detail view shows its habits (grouped inner/outer), its "exchanging this for" stop-habit links (C6), and a "how often this week did I access [target feeling]" internal count. Main interaction: create/edit a Desired Reality; add habits scoped to it.
3. **Check-in flow** — Purpose: the daily base-state capture (C7) and, conditionally, the Polarity Transmutation exercise. Single-column, one question at a time, back/forward, no progress-bar countdown styling (a simple step dot indicator is fine — it's not urgency, it's orientation).
4. **Exercise runner** — Purpose: a generic full-screen guided-step player reused by every guided exercise (Polarity Transmutation in MVP; Technique and Emotional Alchemy post-MVP). Purpose: hold one step's prompt + input at a time, with a "relax first" gate screen inserted before deep exercises (C9). Main interaction: linear next/back through steps; free-text input where the book calls for the user's own words.
5. **Evidence / Wins log** — Purpose: a reverse-chronological feed of everything completed — habit check-ins, exercises, nudges acted on, put-off items cleared. Framed entirely as wins (C13); this is also where the relapse-reframe screen's "see your past wins" link lands.
6. **Mental Nudges inbox** — Purpose: quick add/list/act-on for intuitive to-dos (C10). Main interaction: add a nudge in under 5 seconds (single text field + submit); mark acted-on, which silently timestamps time-to-act.
7. **Setback / reframe screen** — Purpose: appears contextually (never as its own nav destination) after a missed check-in or a self-tagged "hard day." Shows the three C2 prompts and a single CTA into the Wins log. No dead-end "you failed" state exists in the app; every path leads somewhere calm.
8. **Settings** — Purpose: data export/import, schema version, clear-data, and (later) the secular-language toggle. Utility screen, low visual priority.

### Navigation model
Bottom tab bar (mobile) with four destinations: **Today**, **Goals** (Desired Realities), **Evidence** (wins log), **Settings**. Mental Nudges and the check-in/exercise flows are reached *from* Today, not separate tabs — they're daily actions, not places to browse. This keeps the tab bar to four items (a common mobile ceiling) and keeps "Today" as the unambiguous default screen on every app open.

### Mobile-first layout strategy
- Build and design for a single-column, ~375–430px viewport first: Today's stats stack vertically, habit lists are single-column tap targets ≥44px tall, the exercise runner is always full-bleed single-question-per-screen regardless of viewport.
- **What changes on desktop (≥1024px):** the bottom tab bar becomes a left sidebar; Today's layout gains a second column (stats column pinned left/top, habit lists in a wider central column) purely by giving already-stacked elements more horizontal room via CSS grid/flex — no desktop-only components or flows are introduced. The exercise runner and check-in flow stay single-column and centered with a max-width (e.g. ~560px) even on wide screens, because those are reflective/focused tasks that shouldn't stretch edge-to-edge.
- No tablet-specific breakpoint is designed separately; it interpolates between the two via fluid CSS (flex-wrap / clamp()).

### Interaction principles (derived from the calm/low-pressure requirement)
- **No red.** Missed/incomplete states use neutral or soft tones, never an error-red or a strikethrough-as-punishment. (T5, C1)
- **No countdowns, no "X days left," no overdue badges.** Time-bound content (if ever added) is presented as context, not urgency. (T3, C8)
- **No numeric streak reset animations.** Momentum's decay is visually gentle (a slow fade/shrink), never a snap-to-zero or a broken-chain icon. (T1, C5, C14)
- **Every dead end redirects to something affirming.** A missed check-in's only next action is a reframe prompt or the Wins log — never a blank/punitive state.
- **Language filter is enforced at the component level**, not just in copywriting: shared `Copy`/string constants ban "fail," "wrong," "should," "bad," "streak broken" outright (see §5 testing strategy — a lint rule can grep for these).
- **One ritual, one screen.** Check-ins and exercises never combine multiple asks on one screen; this keeps daily interactions completable in under two minutes (per concepts.md's own mobile-first assumption), while guided exercises are allowed to take longer *because* they are relaxation-gated first.

---

## 4. Data model

### ID strategy
Use `crypto.randomUUID()` (native, no dependency) for every entity's `id`. Rationale: single-device local storage has no collision risk across clients to worry about, and native UUIDs avoid pulling in nanoid/uuid packages for a need this simple.

### Date handling (local dates, timezone pitfalls)
- Every entity that needs "which day did this happen" (check-ins, habit completions, momentum bucketing) stores a **local date key**: a `YYYY-MM-DD` string derived from the device's local time at the moment of the event (`date.getFullYear()/getMonth()/getDate()`, not `toISOString()`, which is UTC and will misfile late-night entries on the wrong day for users west of UTC).
- Every entity also stores a full epoch-millisecond `createdAt` timestamp for ordering within a day and for audit/export purposes.
- **Pitfall — DST and midnight rollover:** the "day" a check-in belongs to is decided once, at write time, from the device clock; it is never recomputed later. This avoids entries silently shifting day-buckets if recomputed after a DST change.
- **Pitfall — timezone travel:** since this is single-user/single-device with no sync, we do not store a timezone offset per entry; the device's current local timezone at write time is authoritative. This is a known, accepted limitation — flag to the owner that a user who logs a check-in at 11pm then flies across timezones and logs again may see two same-local-day entries treated as different days, or vice versa. This is out of scope to solve for MVP (no backend to reconcile against) and is an acceptable trade-off given the constraint of no accounts/sync.
- A single utility function `toLocalDateKey(date: Date): string` is the *only* place day-bucketing logic lives, so this pitfall is fixable in one place later if needed.

### Self-Trust score — formula and rationale
Self-Trust is a bounded 0–100 stat, starting at 50 (neutral) for a new user. It updates via an **asymmetric, diminishing-returns ledger**, not a simple running average, so that:
- gains taper as you approach the ceiling (you can't "max out" trust from a single good day — mirrors C13's "muscle built over time"),
- losses are *smaller* than equivalent gains and taper as the score falls (mirrors C14's "give yourself grace" and "you only return to square one if you decide you are" — the score is deliberately hard to crash to 0).

```
On ATFT event (kept commitment):
  selfTrust = selfTrust + ATFT_GAIN * (1 - selfTrust / 100)

On ITFT event (missed commitment):
  selfTrust = selfTrust - ITFT_LOSS * (selfTrust / 100) * GRACE_FACTOR

Constants: ATFT_GAIN = 4, ITFT_LOSS = 3, GRACE_FACTOR = 0.5
(net effect: losses are roughly half the magnitude of gains at the same score level)

selfTrust = clamp(selfTrust, 0, 100)
```
Every ATFT/ITFT event is also appended to an immutable `SelfTrustLedgerEvent` list (never mutated/deleted) so the score is always reconstructable/auditable and exportable — this list *is* the source of truth; the cached `selfTrust` number on the profile is a derived, recomputable value.

### Momentum — formula and rationale
Momentum represents the C5 "snowball/avalanche" compounding metaphor, but per T1/C14 it must **decay gently, never snap to zero**. It's computed per calendar day from an "activity score" for that day (sum of: habit completions, check-ins, exercises, nudges acted on — each worth a small fixed point value) folded into the previous day's momentum with exponential decay for days with no activity:

```
For each local day d, in order:
  activityScore(d) = sum of point values for everything logged/completed on day d
  momentum(d) = momentum(d-1) * DECAY + activityScore(d)

Constants: DECAY = 0.90 (10% gentle decay per fully-inactive day)
Soft cap: momentum is displayed through a diminishing curve, e.g.
  displayedMomentum = 100 * (1 - e^(-momentum / SCALE)),  SCALE = 40
  so raw momentum can grow unbounded internally (rewarding long consistency)
  while the UI number always reads 0-100 without ever "capping out" abruptly.
```
Rationale: a single missed day costs ~10% of accumulated momentum, not 100% (no reset-to-zero), matching "breaking is completely normal... you only return to square one if you decide you are" (C14, p.172-173). Multiple consecutive missed days compound the decay (0.9^n), so extended dormancy does fade momentum toward zero asymptotically — but it can never be *snapped* there by a single event, and it's always recoverable at the same gentle rate it decayed.

### Schema versioning & migration (localStorage)
- A single top-level localStorage key, e.g. `vs_app_state`, holds one JSON blob: `{ schemaVersion: number, data: {...} }`. Storing everything under one versioned envelope (rather than many scattered keys) makes migration and export/import atomic.
- On load: read `schemaVersion`; if it's less than the current app version, run an ordered chain of pure migration functions (`migrations[v] = (oldData) => newData`), applying each sequentially until reaching the current version. Each migration is unit-tested independently.
- Before running any migration, write a timestamped backup copy to `vs_app_state_backup_vN` (kept for one prior version only, to bound storage growth) so a bad migration is recoverable.
- The exported JSON file (Settings → export) includes the same `schemaVersion` envelope, so import runs through the identical migration chain — export/import and normal load share one code path.

### Storage size estimate; localStorage vs. IndexedDB — recommendation
Rough per-record sizes (JSON, English text): CheckIn ~150–250 B, ExerciseSession ~400–700 B (free-text steps), EvidenceEntry ~120–200 B, SelfTrustLedgerEvent ~100–150 B, MentalNudge ~150 B, Habit/DesiredReality ~200–400 B (few dozen of these, not daily).

At a heavy-use estimate of ~10 loggable events/day average (check-in + a few habits + occasional exercise/nudge/evidence) and ~400 B/event average, three years of daily use is roughly `10 * 365 * 3 * 400B ≈ 4.4 MB`. That is close to the conservative cross-browser localStorage ceiling (~5 MB per origin), so a compaction strategy is required for long-term health, not optional:
- Keep the full `SelfTrustLedgerEvent` list forever (it's small and it's the source-of-truth for an important number), but **roll up CheckIns/ExerciseSessions/EvidenceEntries older than ~18 months into monthly aggregate summaries** (counts + a couple of representative excerpts) rather than storing every raw entry forever.
- Add a storage-usage monitor (checks `navigator.storage.estimate()` where available, else a rough byte-length calc on the serialized blob) that warns the user at ~80% of the assumed quota and offers export-then-prune.

**Recommendation: localStorage, not IndexedDB, for MVP and likely for the product's lifetime.** Rationale: the data is small (no images/blobs, text-only journal-style entries), the access pattern is "load everything once at app start, mutate in memory, persist the whole blob on change" — which fits localStorage's synchronous, whole-string API well and is far simpler to implement, test, and migrate than IndexedDB's async, cursor-based API. IndexedDB only becomes worth the complexity if the product later adds attachments (photos in the Evidence log, audio for guided exercises) or the compaction strategy above proves insufficient — both are explicitly deferred, so revisit this decision only if Phase D adds media.

### TypeScript interfaces

```ts
// ---- Shared primitives ----
type ID = string; // crypto.randomUUID()
type LocalDateKey = string; // "YYYY-MM-DD", derived via toLocalDateKey()
type EpochMs = number;

type SevenKeysCategory =
  | "beliefs"
  | "conviction"
  | "perception"
  | "emotionallyChargedThoughts"
  | "focus"
  | "reactions"
  | "expectations";

// ---- C12: goal-as-feeling ----
interface DesiredReality {
  id: ID;
  title: string;                 // e.g. "New job in design"
  targetFeeling: string;         // e.g. "secure", "seen" (C12)
  normalizeIt: boolean;          // "already normal/mine" framing toggle (C8)
  sourceActionNote?: string;     // paired "be a source" practice (C8)
  collectiveBeliefToRelease?: string; // supporting concept
  createdAt: EpochMs;
  archivedAt?: EpochMs;          // soft-delete; never hard-delete user data implicitly
}

// ---- C10 tier, C6 start/stop, C11 seven keys ----
interface Habit {
  id: ID;
  desiredRealityId: ID;
  name: string;
  tier: "inner" | "outer";                 // C10: inner rendered above outer
  actionType: "start" | "stop";            // C6
  exchangingFor?: string;                  // "stop" habits: what desired state this trades for (C6)
  sevenKeysCategory?: SevenKeysCategory;    // C11, optional, mainly for inner habits
  isKeystone: boolean;                      // e.g. relaxation habit gating exercises (C9)
  schedule: HabitSchedule;
  active: boolean;
  createdAt: EpochMs;
  archivedAt?: EpochMs;
}

interface HabitSchedule {
  kind: "daily" | "weekly" | "oneOff";
  daysOfWeek?: number[];   // 0-6, only for "weekly"
  targetDate?: LocalDateKey; // only for "oneOff" (put-off list items etc.)
}

// ---- Daily state check-in, C7 ----
interface CheckIn {
  id: ID;
  dateKey: LocalDateKey;
  createdAt: EpochMs;
  baseState: string;        // free-text or short tag, e.g. "anxious", "at ease"
  note?: string;
  desiredRealityId?: ID;    // optional link if the check-in was goal-specific
}

// ---- Habit completion event (separate from CheckIn) ----
interface HabitCompletion {
  id: ID;
  habitId: ID;
  dateKey: LocalDateKey;
  createdAt: EpochMs;
  kept: boolean;            // true = ATFT event, false = ITFT event
  reflectionPromptUsed?: boolean; // true if the C2 reframe screen was shown/used
}

// ---- Guided exercises: Polarity Transmutation (MVP), Technique / Emotional Alchemy (post-MVP) ----
type ExerciseType =
  | "polarityTransmutation"   // C7, technique #7 — MVP
  | "technique"                // technique #8 — post-MVP
  | "emotionalAlchemy"         // C14, technique #16 — post-MVP
  | "frequencyAudit"           // C11 — post-MVP
  | "beliefAdoption"           // technique #13 — post-MVP
  | "internalValidation";      // Energetic Ceiling — post-MVP

interface ExerciseSession {
  id: ID;
  type: ExerciseType;
  desiredRealityId?: ID;
  habitId?: ID;               // if this session counts as completing a linked habit
  dateKey: LocalDateKey;
  startedAt: EpochMs;
  completedAt?: EpochMs;      // undefined = abandoned mid-flow
  relaxGateCompletedAt?: EpochMs; // C9 gate timestamp, if applicable
  steps: ExerciseStepEntry[];
}

interface ExerciseStepEntry {
  stepKey: string;   // e.g. "nameFeeling", "nameOppositePolarity", "logEvidence"
  value: string;     // user's free-text input for that step
}

// ---- C10: mental nudges inbox ----
interface MentalNudge {
  id: ID;
  text: string;
  capturedAt: EpochMs;
  actedAt?: EpochMs;          // presence = acted-on; feeds a fast-ATFT ledger event
  status: "open" | "actedOn" | "released"; // "released" = consciously let go, not "failed"
}

// ---- C13: wins/evidence log ----
type EvidenceSourceType =
  | "habitCompletion"
  | "exerciseSession"
  | "mentalNudgeActedOn"
  | "putOffItemCleared"
  | "manualEntry";

interface EvidenceEntry {
  id: ID;
  dateKey: LocalDateKey;
  createdAt: EpochMs;
  text: string;
  sourceType: EvidenceSourceType;
  sourceId?: ID;              // id of the HabitCompletion/ExerciseSession/etc. that generated it
  desiredRealityId?: ID;
}

// ---- C4: Self-Trust ledger (append-only, source of truth for the score) ----
interface SelfTrustLedgerEvent {
  id: ID;
  createdAt: EpochMs;
  kind: "ATFT" | "ITFT";
  sourceType: "habitCompletion" | "mentalNudgeActedOn" | "putOffItemCleared";
  sourceId: ID;
  delta: number;              // signed change actually applied, for audit/debug
  resultingScore: number;     // snapshot of selfTrust after this event
}

// ---- Put-off list, technique #5 ----
interface PutOffItem {
  id: ID;
  text: string;
  createdAt: EpochMs;
  clearedAt?: EpochMs;         // presence = cleared; feeds an ATFT ledger event
}

// ---- Derived/cached profile stats (recomputable from the ledger; not itself authoritative) ----
interface ProfileStats {
  selfTrust: number;           // 0-100, cached derived value
  momentumRaw: number;         // unbounded internal accumulator
  momentumDisplayed: number;   // 0-100 via soft-cap curve, see formula above
  lastComputedDateKey: LocalDateKey;
}

// ---- Settings & schema envelope ----
interface Settings {
  languageMode: "bookVocabulary" | "secular"; // Q1, secular is post-MVP but field exists early
  relaxGateEnabled: boolean;                  // C9
  remindersEnabled: boolean;                  // post-MVP, opt-in only
}

interface AppStateV1 {
  schemaVersion: 1;
  desiredRealities: DesiredReality[];
  habits: Habit[];
  checkIns: CheckIn[];
  habitCompletions: HabitCompletion[];
  exerciseSessions: ExerciseSession[];
  mentalNudges: MentalNudge[];
  evidenceEntries: EvidenceEntry[];
  selfTrustLedger: SelfTrustLedgerEvent[];
  putOffItems: PutOffItem[];
  profileStats: ProfileStats;
  settings: Settings;
}

// Top-level localStorage envelope, versioned for migration
interface StorageEnvelope {
  schemaVersion: number;
  data: AppStateV1; // swap type per version; migrations transform old -> new
}
```

---

## 5. Technology stack recommendation

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | React 18 + TypeScript | Owner's preference; TypeScript is non-negotiable given the data-model complexity above (ATFT/ITFT ledger, migrations) — catches schema drift at compile time. |
| **Build tool** | Vite | Fastest React dev-server/build story today; produces a pure static bundle (HTML/CSS/JS) with zero server requirement, matching the "deploy as static site" constraint. |
| **Routing** | React Router (or hand-rolled 4-route switch) | Only ~8 screens and a 4-tab nav; React Router is enough, no need for a meta-framework (Next.js etc. would imply a server model this app doesn't need). |
| **Styling** | Tailwind CSS | Utility-first speeds up a solo 2-4 week build and keeps the "no red / calm tone" rule enforceable via a small custom color palette in the Tailwind config rather than scattered ad hoc CSS. (No visual design is being decided here — this is a tooling choice only.) |
| **State management** | Zustand | The app is single-user/local with one in-memory state tree; Zustand gives a simple store + persist middleware without Redux's boilerplate. Its `persist` middleware is a natural fit for the versioned-envelope localStorage strategy in §4. |
| **Storage layer** | Raw `localStorage`, wrapped in a small typed repository module (`getState()/setState()/migrate()`) — see §4 for why not IndexedDB. | Simplicity, synchronous API, sufficient capacity for years of text-only journal data; avoids async-cursor complexity IndexedDB would add for no current benefit. |
| **Charts** | None in MVP; **visx** or plain SVG sparklines if/when Phase D trend charts are built. | MVP has exactly two headline numbers (Self-Trust, Momentum) — a chart library is unjustified spend before Phase D. |
| **Testing** | Vitest + React Testing Library for components/hooks; plain Vitest unit tests for the pure functions (`toLocalDateKey`, Self-Trust/Momentum formulas, migration chain). | Vitest shares Vite's config/transform pipeline (fast, zero extra bundler setup); RTL is the standard for behavior-level component tests. |
| **Deployment** | Static export (`vite build`) to any static host (Netlify/Vercel/GitHub Pages/Cloudflare Pages) | No backend exists, so "deployment" is literally uploading a static `dist/` folder; pick whichever host the owner already has an account with. |
| **Explicitly excluded** | No backend/API layer, no auth, no service worker/PWA offline caching, no push notification infra, no analytics/telemetry SDK. | Backend/auth are ruled out by the single-user/local-only constraint. Service worker is skipped because offline support was explicitly ruled out — adding one only for "installability" is scope not requested. Notifications (if ever added in Phase D) can start as simple in-tab `Notification` API prompts, not a full push pipeline. |

---

## 6. Development roadmap

| Milestone | Scope | Effort (solo dev-days) | Demoable outcome | Testing/QA strategy |
|---|---|---|---|---|
| **M0 — Project scaffold** | Vite + React + TS + Tailwind + Zustand set up; typed `StorageEnvelope`/repository module with a no-op v1 schema; basic routing shell + 4-tab nav (empty screens). | 1.5 | App boots to an empty "Today" screen on mobile viewport, tab nav works. | Unit test the storage repository's read/write/migrate-no-op path. |
| **M1 — Desired Realities + Habits CRUD** | Features #1, #2 from §1: create/edit/archive a Desired Reality with target feeling; create/edit habits with tier + start/stop type, scoped to a Desired Reality. | 3 | User can create a goal ("get a new job", feeling "secure") and add 2-3 habits under it, inner ranked above outer. | Component tests for the create/edit forms; unit tests for the Habit/DesiredReality reducers. |
| **M2 — Daily check-in + habit completion + reframe** | Features #3, #4, #7, #11: Today screen renders today's habits ordered inner-first; tap-to-keep / gentle-miss interactions write `HabitCompletion`s; base-state `CheckIn` flow; the C2 reframe screen fires on a miss. | 4 | A full daily loop is usable end-to-end: open app, do check-in, mark habits kept/missed, see the calm reframe on a miss. | RTL tests asserting the miss path never renders banned words ("fail"/"wrong"/"should"); unit test `toLocalDateKey` across a DST boundary and midnight edge case. |
| **M3 — Self-Trust + Momentum engine** | Features #5, #6: implement the ledger-driven Self-Trust formula and the decay-based Momentum formula from §4; wire both into `HabitCompletion` writes; render both on Today. | 3 | Today screen shows live Self-Trust and Momentum numbers that move correctly as habits are checked/missed over several simulated days. | Dedicated unit-test suite for the two formulas (property tests: score always in [0,100]; a single miss never drops momentum to 0; verify the asymmetric gain/loss behavior with fixed constants). This is the highest-risk logic in the app — test it more than the UI around it. |
| **M4 — Polarity Transmutation exercise + Evidence log + Nudges** | Features #8, #9, #10: generic exercise-runner shell; Polarity Transmutation flow; Evidence log feed aggregating completions/exercises/nudges; Mental Nudges inbox with time-to-act capture. | 4 | User can run the full Polarity Transmutation exercise, see it appear in the Evidence log, capture a nudge and mark it acted-on. | RTL test that an abandoned exercise session (`completedAt` undefined) doesn't corrupt the ledger; unit test evidence-feed aggregation ordering. |
| **M5 — Put-off list, Relax-first gate, Settings/export-import** | Features #12, #13, #14: put-off list CRUD feeding ATFT; relaxation timer gate in front of the exercise runner; settings screen with JSON export/import and schema-version display. | 3 | Full data lifecycle demoable: export JSON, clear all data, re-import, state is identical. | Round-trip test: export → wipe → import → deep-equal against original state; migration-chain unit test with a synthetic "v0 → v1" fixture. |
| **M6 — Responsive desktop pass + polish + hardening** | Apply the desktop layout rules from §3 (sidebar nav, two-column Today) via CSS only, no new components; storage-usage monitor; final copy-style lint pass (banned-word grep) across all strings. | 2.5 | App demoed on both a phone-width and a desktop-width browser window with no layout breakage. | Manual QA pass on 2-3 real device widths; automated grep/test asserting no banned words exist in the copy/constants files; Lighthouse mobile-usability check. |

**Total: ~21 solo dev-days (~4 weeks at 5-6 productive hours/day), matching the requested 2-4 week MVP window** with M6 as the buffer/polish milestone that can be trimmed if the schedule is tight.

---

## 7. Risks & mitigations

1. **localStorage data loss (quota eviction, browser data-clearing, private browsing, accidental "clear site data").** Single-user/local-only means there is no server backup — data loss is total and permanent. *Mitigation:* ship the JSON export/import (feature #14, M5) in the MVP, not post-MVP, and prompt users periodically (e.g. every N weeks or after big milestones) to export a backup. Add the storage-usage monitor from §4 early rather than as an afterthought.

2. **Date/timezone rollover bugs in daily check-ins and habit scheduling.** Off-by-one day bugs (an 11:58pm check-in filed under the wrong day, or a DST-transition day being double-counted/skipped in Momentum) are easy to introduce and hard to notice until a user hits the edge case. *Mitigation:* centralize all day-bucketing in the single `toLocalDateKey()` utility (§4), unit-test it explicitly across a DST-spring-forward date and a DST-fall-back date, and never derive a date key via `toISOString()` anywhere in the codebase (enforce via a lint rule/grep in CI).

3. **Scope creep from the 24-item guided-exercise inventory.** concepts.md catalogs 24 trackable practices; building all of them before shipping anything is the most likely way this project misses its 2-4 week window. *Mitigation:* the MVP scope in §1 deliberately ships only 1 of the ~6 major guided exercises (Polarity Transmutation) with a reusable exercise-runner shell (M4) designed so that Technique and Emotional Alchemy (Phase A, post-MVP) are new step-data configs against the *same* runner, not new screens — this is an architectural guardrail against creep, not just a scheduling one.

4. **Self-Trust/Momentum formulas feel wrong in practice (too punishing, too forgiving, or just numerically unstable) despite being philosophically justified on paper.** These are the two headline numbers in the entire product; if they don't *feel* calm and fair once a real user is checking in daily, the app fails its core premise (T1/T2). *Mitigation:* keep the gain/loss/decay constants (`ATFT_GAIN`, `ITFT_LOSS`, `GRACE_FACTOR`, `DECAY`, `SCALE`) as named constants in one config module, not hardcoded inline, so they can be tuned without touching logic; write the property-based unit tests called out in M3 *before* wiring up the UI, so the formula's behavior is verified against edge cases (long inactivity, all-misses, all-keeps) independent of subjective feel; plan for one round of constant-tuning after the developer's own 1-2 week dogfood period before considering the metric "done."

5. **Copy/tone regressions reintroducing punitive language ("fail," "wrong," "streak broken," red error styling) as the app grows past MVP.** This is the single most book-faithfulness-critical requirement (T5) and the easiest thing for a future feature (or a future contributor unfamiliar with concepts.md) to accidentally violate. *Mitigation:* centralize all user-facing strings in one copy/constants module and add an automated CI check (simple grep/regex test, part of M6) that fails the build if banned words appear in that module or in component JSX text; treat this the same as a linter, not a manual review step.
