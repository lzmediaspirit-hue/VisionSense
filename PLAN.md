# Habit Tracker — Master Plan (grounded in *Outsmarting Reality* by Nero Knowledge)

**Status: awaiting product-owner approval. No UI design or code has been produced.**

This is the synthesized plan. Full supporting detail lives in:
- [`docs/book-analysis.md`](docs/book-analysis.md) — complete book analysis: chapter map, 14 key concepts (page-cited), concept→feature translation, 24-item practical-techniques inventory, trade-offs, and flagged outside sources.
- [`docs/engineering-plan.md`](docs/engineering-plan.md) — full engineering plan: MVP scope, phased advanced features, UI/UX approach, complete TypeScript data model with scoring formulas, stack rationale, roadmap M0–M6, risks.

**Locked constraints:** mobile-first responsive single codebase · single user · local-only storage · no offline requirement · React-friendly.

---

## 1. What the book actually is (and why it changes the product)

*Outsmarting Reality* is a metaphysical "reality creation" book, not a behavioral-science habit book. Its thesis: reality is a reflection of your inner **frequency** (state of consciousness); effort and external results are downstream effects, never causes ("you cannot outhustle your frequency," p.108). A faithful tracker therefore inverts the usual formula: it tracks **inner state first, actions second**, and it treats slips with explicit grace (Law of Rhythm, p.173–174: "you only return to square one if you decide you're back there," p.172).

## 2. The five book mechanics that define the app

1. **Self-Trust (ATFT/ITFT) replaces streaks.** The book's own scoring model (p.33–34): the mind logs every kept commitment (ATFT) and every broken one (ITFT), building or eroding self-trust. → A 0–100 Self-Trust meter is the headline stat, with asymmetric math (losses ≈ half of gains) per the book's grace mandate.
2. **Momentum compounds, never snaps.** Consistency is "alchemy" that compounds (p.39, p.49), but relapse is normal and rhythmic (p.173). → An exponential-decay accumulator (~10%/inactive day) instead of a resettable chain.
3. **Frequency first, action after** (p.113). The sequence Frequency → Intuition → Mental Nudges → Action → Reality (p.108). → Two-tier habits (inner above outer everywhere) + a Mental Nudges inbox that rewards fast execution.
4. **You want the feeling, not the thing** (p.102–103). → Every goal ("Desired Reality") stores a target feeling; progress is partly "how often did you access that feeling this week."
5. **Calm is a hard requirement, not a style choice.** Relaxation is the prerequisite for subconscious access (p.68–71); wanting/urgency creates energetic distance (p.56–63). → No countdowns, no red, no overdue states, no punitive language ("fail/wrong/should" banned and CI-enforced).

## 3. MVP (target ~4 weeks solo)

Onboarding with target-feeling capture · habit CRUD (inner/outer, start/stop with "exchanging this for" framing) · Today screen ordered inner-first with Self-Trust + Momentum · one-tap kept / gentle "not today" check-ins · daily base-emotional-state check-in · Polarity Transmutation guided exercise (via a reusable exercise-runner shell) · Evidence/Wins log · Mental Nudges inbox · setback reframe screen using the book's three prompts verbatim (p.22–23) · put-off list · relax-first gate · JSON export/import (load-bearing: local-only storage has no backup).

## 4. Post-MVP phases

- **A — Deepen inner work:** Seven-Keys taxonomy + weekly Frequency Audit (p.82); the full two-part visualization Technique wizard (p.93–96); Emotional Alchemy 8-step reset (p.146).
- **B — Conviction tools:** belief-adoption wizard (p.124–125), daily expectation entry (p.133), micro-manifestation starter quests (p.98–99), "be a source" templates (p.61).
- **C — Reflection layer:** collective-belief release, self-sabotage/social-contract reflection, internal validation scene, perception-projection prompt, attention audit.
- **D — QoL:** secular-language toggle, internal-state trend sparklines, opt-in gentle reminders, theming.

## 5. UI/UX approach (described, not designed)

Four-tab mobile nav (Today / Goals / Evidence / Settings); check-ins and exercises are flows launched from Today, one question per screen, daily interactions ≤ 2 minutes. Desktop (≥1024px) converts tabs to a sidebar and widens layout via CSS only — no desktop-only components; reflective flows stay centered at ~560px max width. Interaction principles: no red, no urgency mechanics, no streak-snap animations, every dead end redirects to the Wins log or a reframe.

## 6. Data model & storage

Entities: `DesiredReality`, `Habit`, `CheckIn`, `HabitCompletion`, `ExerciseSession`, `MentalNudge`, `EvidenceEntry`, `SelfTrustLedgerEvent` (append-only source of truth), `PutOffItem`, `ProfileStats` (derived cache), `Settings` — full TypeScript interfaces in the engineering plan. Self-Trust: bounded 0–100, diminishing-returns gains, grace-factored losses. Momentum: `m(d) = m(d−1)·0.9 + activity(d)`, displayed through a soft-cap curve. Local date keys computed once at write time via a single `toLocalDateKey()` utility (DST-safe). **localStorage** (not IndexedDB) under one versioned envelope with a migration chain and an 18-month roll-up compaction strategy; ~4.4 MB at 3 years of heavy use.

## 7. Stack recommendation

React 18 + TypeScript · Vite · Tailwind CSS · Zustand (persist middleware) · Vitest + React Testing Library · static deployment (Netlify/Vercel/GitHub Pages). Explicitly excluded: backend, auth, service worker/PWA, push infra, analytics.

## 8. Roadmap (≈21 solo dev-days)

| Milestone | Scope | Days |
|---|---|---|
| M0 | Scaffold, storage envelope, nav shell | 1.5 |
| M1 | Desired Realities + Habits CRUD | 3 |
| M2 | Daily loop: Today screen, check-ins, reframe flow | 4 |
| M3 | Self-Trust + Momentum engine (property-tested first) | 3 |
| M4 | Exercise runner + Polarity Transmutation + Evidence + Nudges | 4 |
| M5 | Put-off list, relax gate, export/import round-trip | 3 |
| M6 | Desktop responsive pass, storage monitor, banned-word CI check | 2.5 |

## 9. Top risks

localStorage data loss (→ export/import ships in MVP + periodic backup prompts) · date/timezone rollover bugs (→ single utility + DST unit tests) · scope creep from the 24-exercise inventory (→ one reusable runner, one MVP exercise) · scoring formulas feeling wrong in practice (→ tunable constants + dogfood period) · punitive-copy regressions (→ centralized strings + CI grep).

## 10. Open decisions needing the product owner

1. **Language register:** ship the book's vocabulary ("frequency," "old frequency," "alchemy") as the only MVP copy layer (current recommendation), or build the secular toggle into v1?
2. **Any visible streak at all?** Recommendation is none — Self-Trust + Momentum only. Confirm.
3. **Home-screen inversion:** state/inner-work leads, actions second. This is the biggest departure from conventional trackers — sign-off needed.
4. **Time-bound goals** (e.g., an exam date): how to represent without urgency mechanics the book forbids?
5. **Gamification depth:** current stance is light and meaning-first (two stats, no badges/points). Confirm.
6. **Fasting template:** include intermittent fasting (a book practice, p.36) with its medical caveat, or omit?
