// Deterministic synthetic dataset for offline runs and tests.
//
// Real Polymarket data can't be fetched from restricted environments, and even
// where it can, a committed test must be reproducible. So we generate resolved
// markets from a *known* data-generating process that embeds a favorite–longshot
// bias, then check that the tool recovers it. Nothing here is presented as real
// market history — it exists to exercise and validate the pipeline mechanics.
//
// Process, per market:
//   true prob q ~ Uniform(0.02, 0.98)
//   market log-odds = SHRINK * logit(q) + noise      (SHRINK < 1 => under-confident)
//   entry price p   = sigmoid(market log-odds)
//   outcome         ~ Bernoulli(q)
// SHRINK < 1 means the market is less extreme than the truth: favorites are
// under-priced and longshots over-priced — exactly the bias the model tests for.

import type { ResolvedMarket } from './types.ts'
import { logit, sigmoid } from './edge.ts'

/** mulberry32 — a tiny, fast, fully deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface FixtureOptions {
  n?: number
  seed?: number
  /** Log-odds shrink factor; < 1 injects favorite–longshot bias. */
  shrink?: number
  /** SD of Gaussian noise added to the market log-odds. */
  noiseSd?: number
}

/** Box–Muller standard normal from two uniforms. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(1e-12, rng())
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export function makeFixtureMarkets(opts: FixtureOptions = {}): ResolvedMarket[] {
  const n = opts.n ?? 1200
  const seed = opts.seed ?? 42
  const shrink = opts.shrink ?? 0.78
  const noiseSd = opts.noiseSd ?? 0.15
  const rng = mulberry32(seed)

  const oneYear = 365 * 24 * 3600
  const startTs = 1_700_000_000 // ~Nov 2023, arbitrary but fixed
  const markets: ResolvedMarket[] = []

  for (let i = 0; i < n; i++) {
    const q = 0.02 + rng() * 0.96
    const marketLogit = shrink * logit(q) + gaussian(rng) * noiseSd
    const price = sigmoid(marketLogit)
    if (!(price > 0.01 && price < 0.99)) continue
    const wonYes: 0 | 1 = rng() < q ? 1 : 0
    const volume = Math.round(5000 + rng() * 495000)
    const closedTs = startTs + Math.floor(rng() * oneYear)
    markets.push({
      id: `fixture-${i}`,
      question: `Synthetic market #${i} (true p=${q.toFixed(2)})`,
      entryPrice: price,
      wonYes,
      volume,
      closedTs,
    })
  }
  return markets
}
