// The backtest engine.
//
// Given resolved markets reduced to (entry price, realised outcome), it:
//   1. builds a calibration table (does a 0.80 market win ~80% of the time?),
//   2. runs candidate betting strategies and scores their P&L, and
//   3. reports honest, out-of-sample-friendly performance metrics.
//
// Everything here is a pure function of its inputs so it is fully unit-testable
// with fixtures and never touches the network.

import type {
  Bet,
  CalibrationBucket,
  CalibrationSummary,
  Observation,
  StrategyResult,
} from './types.ts'
import type { EdgeModel } from './edge.ts'
import { fairValue } from './edge.ts'

/** Chronological split: older markets train the model, newer ones test it. */
export function splitByTime(
  obs: Observation[],
  trainFraction = 0.5,
): { train: Observation[]; test: Observation[] } {
  const sorted = [...obs].sort((a, b) => a.closedTs - b.closedTs)
  const cut = Math.floor(sorted.length * trainFraction)
  return { train: sorted.slice(0, cut), test: sorted.slice(cut) }
}

/** Build an equal-width calibration table plus Brier score and base rate. */
export function calibrate(obs: Observation[], nBuckets = 10): CalibrationSummary {
  const buckets: CalibrationBucket[] = []
  for (let i = 0; i < nBuckets; i++) {
    const lo = i / nBuckets
    const hi = (i + 1) / nBuckets
    const inBucket = obs.filter(
      (o) => o.price >= lo && (i === nBuckets - 1 ? o.price <= hi : o.price < hi),
    )
    const count = inBucket.length
    const meanPrice =
      count === 0 ? (lo + hi) / 2 : inBucket.reduce((s, o) => s + o.price, 0) / count
    const realizedFreq =
      count === 0 ? 0 : inBucket.reduce((s, o) => s + o.wonYes, 0) / count
    buckets.push({
      lo,
      hi,
      count,
      meanPrice,
      realizedFreq,
      edge: count === 0 ? 0 : realizedFreq - meanPrice,
    })
  }
  const n = obs.length
  const brier =
    n === 0 ? 0 : obs.reduce((s, o) => s + (o.price - o.wonYes) ** 2, 0) / n
  const baseRate = n === 0 ? 0 : obs.reduce((s, o) => s + o.wonYes, 0) / n
  return { brier, baseRate, n, buckets }
}

/** A strategy decides, per market, whether and which side to back. */
export type ChooseFn = (o: Observation) => { side: 'YES' | 'NO' } | null

function toBet(o: Observation, side: 'YES' | 'NO'): Bet {
  const cost = side === 'YES' ? o.price : 1 - o.price
  const won: 0 | 1 = (side === 'YES' ? o.wonYes : (1 - o.wonYes)) as 0 | 1
  // On Polymarket a winning share pays $1, so ROI on the unit staked is:
  const roi = (won - cost) / cost
  return { id: o.id, question: o.question, side, cost, won, roi }
}

/**
 * Run a strategy over observations and compute performance.
 * Bankroll compounds a fixed fraction `f` of the current balance per bet,
 * in chronological order — a simple, leverage-free money-management sanity check.
 */
export function runStrategy(
  name: string,
  obs: Observation[],
  choose: ChooseFn,
  f = 0.05,
): StrategyResult {
  const chronological = [...obs].sort((a, b) => a.closedTs - b.closedTs)
  const bets: Bet[] = []
  let bankroll = 1
  for (const o of chronological) {
    const pick = choose(o)
    if (!pick) continue
    const bet = toBet(o, pick.side)
    bets.push(bet)
    bankroll *= 1 + f * bet.roi
  }
  const nBets = bets.length
  if (nBets === 0) {
    return {
      name,
      nBets: 0,
      winRate: 0,
      avgRoi: 0,
      totalPnl: 0,
      stdRoi: 0,
      tStat: 0,
      finalBankroll: 1,
      bets,
    }
  }
  const wins = bets.reduce((s, b) => s + b.won, 0)
  const totalPnl = bets.reduce((s, b) => s + b.roi, 0)
  const avgRoi = totalPnl / nBets
  const variance =
    nBets < 2 ? 0 : bets.reduce((s, b) => s + (b.roi - avgRoi) ** 2, 0) / (nBets - 1)
  const stdRoi = Math.sqrt(variance)
  const tStat = stdRoi === 0 ? 0 : avgRoi / (stdRoi / Math.sqrt(nBets))
  return {
    name,
    nBets,
    winRate: wins / nBets,
    avgRoi,
    totalPnl,
    stdRoi,
    tStat,
    finalBankroll: bankroll,
    bets,
  }
}

// ---- Strategy factories -------------------------------------------------

/** Back the favorite side whenever its price is at least `threshold`. */
export function backFavorites(threshold = 0.8): ChooseFn {
  return (o) => {
    if (o.price >= threshold) return { side: 'YES' }
    if (1 - o.price >= threshold) return { side: 'NO' }
    return null
  }
}

/** Control: back the cheap side (should lose money if FLB is real). */
export function backLongshots(threshold = 0.2): ChooseFn {
  return (o) => {
    if (o.price <= threshold) return { side: 'YES' }
    if (1 - o.price <= threshold) return { side: 'NO' }
    return null
  }
}

/** Naive baseline: always buy YES. */
export const buyAllYes: ChooseFn = () => ({ side: 'YES' })

/**
 * The model strategy: back the side the fitted edge model prefers, but only
 * when the model's fair value diverges from the price by more than `minEdge`.
 * Fit the model on the *train* split and pass it here to evaluate on *test*.
 */
export function modelStrategy(model: EdgeModel, minEdge = 0.03): ChooseFn {
  return (o) => {
    const edge = fairValue(model, o.price) - o.price
    if (Math.abs(edge) < minEdge) return null
    return { side: edge > 0 ? 'YES' : 'NO' }
  }
}
