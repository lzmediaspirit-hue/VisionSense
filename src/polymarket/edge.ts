// The edge model — the "theory" the tool tests and then uses to find bets.
//
// Theory: prediction markets exhibit a *favorite–longshot bias* (FLB).
// Longshots (cheap YES) tend to be over-priced and favorites (expensive YES)
// tend to be under-priced, because bettors overpay for lottery-like payoffs.
// If that holds, the market-implied probability is a *shrunk* version of the
// true probability, and we can recover a fair value by un-shrinking it.
//
// We model it as logistic regression of the realised outcome on the log-odds
// of the market price:
//
//     P(YES wins | price p) = sigmoid(a + b * logit(p))
//
// A slope b > 1 means the true log-odds are *more extreme* than the market's —
// i.e. favorites should be even more favored and longshots even less — which is
// exactly FLB. b = 1, a = 0 is a perfectly efficient, un-biased market.
//
// Fitting a and b on a *training* set of resolved markets gives a fair-value
// curve. The per-market edge for a live market at price p is fairValue(p) - p.

import type { Observation, ResolvedMarket } from './types.ts'

const EPS = 1e-6

export function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0.5
  return Math.min(1 - EPS, Math.max(EPS, p))
}

export function logit(p: number): number {
  const c = clampProb(p)
  return Math.log(c / (1 - c))
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}

export interface EdgeModel {
  /** Intercept in log-odds space. */
  a: number
  /** Slope on the market log-odds. b > 1 => favorite–longshot bias. */
  b: number
  /** Number of training observations the fit used. */
  n: number
}

/** The efficient-market prior: fair value equals price. */
export const EFFICIENT_MODEL: EdgeModel = { a: 0, b: 1, n: 0 }

export function reduceToObservations(markets: ResolvedMarket[]): Observation[] {
  return markets
    .filter((m) => m.entryPrice > 0 && m.entryPrice < 1)
    .map((m) => ({
      id: m.id,
      question: m.question,
      price: m.entryPrice,
      wonYes: m.wonYes,
      volume: m.volume,
      closedTs: m.closedTs,
    }))
}

/**
 * Fit the logistic edge model by Newton–Raphson (IRLS) on two parameters.
 * Deterministic: same input always yields the same fit, so tests are stable.
 * `l2` is a small ridge penalty that keeps the slope finite when the training
 * set is tiny or perfectly separable.
 */
export function fitEdgeModel(obs: Observation[], l2 = 1e-3): EdgeModel {
  const xs = obs.map((o) => logit(o.price))
  const ys = obs.map((o) => o.wonYes)
  const n = ys.length
  if (n < 2) return { ...EFFICIENT_MODEL, n }

  let a = 0
  let b = 1
  for (let iter = 0; iter < 100; iter++) {
    // Gradient g (2) and Hessian H (2x2) of the penalised log-likelihood.
    let g0 = 0
    let g1 = 0
    let h00 = 0
    let h01 = 0
    let h11 = 0
    for (let i = 0; i < n; i++) {
      const x = xs[i]
      const mu = sigmoid(a + b * x)
      const r = ys[i] - mu
      g0 += r
      g1 += r * x
      const w = mu * (1 - mu)
      h00 += w
      h01 += w * x
      h11 += w * x * x
    }
    // Ridge on b only (never penalise the intercept).
    g1 -= l2 * b
    h11 += l2
    // Newton step: [a,b] += H^{-1} g. H is positive definite here.
    const det = h00 * h11 - h01 * h01
    if (Math.abs(det) < 1e-12) break
    const da = (h11 * g0 - h01 * g1) / det
    const db = (-h01 * g0 + h00 * g1) / det
    a += da
    b += db
    if (Math.abs(da) < 1e-9 && Math.abs(db) < 1e-9) break
  }
  return { a, b, n }
}

/** Model-implied fair probability for a market currently priced at p. */
export function fairValue(model: EdgeModel, p: number): number {
  return sigmoid(model.a + model.b * logit(p))
}

/** Signed edge on the YES side: positive => YES under-priced (buy YES). */
export function yesEdge(model: EdgeModel, p: number): number {
  return fairValue(model, p) - p
}

export interface ScoredMarket {
  id: string
  question: string
  price: number
  fair: number
  /** Signed YES edge (fair - price). */
  edge: number
  /** Which side the model would back, and its expected ROI per unit staked. */
  side: 'YES' | 'NO'
  expectedRoi: number
  volume: number
}

/**
 * Score live (unresolved) markets for tradeable edge and rank best-first.
 * A market is only worth backing if the model's fair value diverges from the
 * price by more than `minEdge` and the market clears `minVolume`.
 *
 * Expected ROI uses the model's fair value as the probability of winning:
 *   back YES at cost p  -> E[roi] = fair/p - 1
 *   back NO  at cost 1-p -> E[roi] = (1-fair)/(1-p) - 1
 */
export function scoreMarkets(
  model: EdgeModel,
  markets: { id: string; question: string; price: number; volume: number }[],
  opts: { minEdge?: number; minVolume?: number } = {},
): ScoredMarket[] {
  const minEdge = opts.minEdge ?? 0.03
  const minVolume = opts.minVolume ?? 0
  const scored: ScoredMarket[] = []
  for (const m of markets) {
    if (m.price <= 0 || m.price >= 1) continue
    if (m.volume < minVolume) continue
    const fair = fairValue(model, m.price)
    const edge = fair - m.price
    if (Math.abs(edge) < minEdge) continue
    const side: 'YES' | 'NO' = edge > 0 ? 'YES' : 'NO'
    const expectedRoi =
      side === 'YES' ? fair / m.price - 1 : (1 - fair) / (1 - m.price) - 1
    scored.push({
      id: m.id,
      question: m.question,
      price: m.price,
      fair,
      edge,
      side,
      expectedRoi,
      volume: m.volume,
    })
  }
  scored.sort((x, y) => y.expectedRoi - x.expectedRoi)
  return scored
}
