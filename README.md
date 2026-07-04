# VisionSense

A calm, low-pressure habit tracker grounded in *Outsmarting Reality* by Nero Knowledge. Frequency first, action after: goals are held as feelings ("Desired Realities"), inner state-work always ranks above outer action, and progress is measured by Self-Trust and Momentum — never by streaks.

## Philosophy

The book's thesis is that reality reflects your inner frequency, so the app tracks inner state first and actions second. Every kept commitment feeds a Self-Trust ledger (the book's ATFT/ITFT model), with gains outweighing losses so the score is deliberately hard to crash. Momentum compounds with consistency and only ever decays gently — a missed day costs a little, never everything, because "you only return to square one if you decide you are." There is no red, no overdue state, and no punitive language anywhere in the product (enforced by an automated copy test).

## Development

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server
npm test        # run the Vitest suite
npm run build   # typecheck + production build
```

Built with React 18 + TypeScript, Vite, Tailwind CSS, Zustand, and Vitest. All data lives in `localStorage` on the device under a single versioned envelope (`vs_app_state`) — no backend, no accounts, no sync. Settings offers JSON export/import for backup.

## Deployment

`npm run build` produces a fully static `dist/` folder. Deploy it to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages) — no server required.

## Documentation

- [`PLAN.md`](PLAN.md) — the synthesized master plan
- [`docs/book-analysis.md`](docs/book-analysis.md) — full book analysis: concepts, page-cited techniques, trade-offs
- [`docs/engineering-plan.md`](docs/engineering-plan.md) — MVP scope, data model, formulas, roadmap M0–M6
