import {
  clampProb,
  fairValue,
  fitEdgeModel,
  logit,
  reduceToObservations,
  scoreMarkets,
  sigmoid,
} from './edge.ts'
import {
  backFavorites,
  backLongshots,
  buyAllYes,
  calibrate,
  modelStrategy,
  runStrategy,
  splitByTime,
} from './backtest.ts'
import { makeFixtureMarkets } from './fixtures.ts'
import type { Observation } from './types.ts'

function obs(price: number, wonYes: 0 | 1, id = 'x', ts = 0): Observation {
  return { id, question: id, price, wonYes, volume: 10000, closedTs: ts }
}

describe('numeric helpers', () => {
  it('sigmoid inverts logit', () => {
    for (const p of [0.05, 0.2, 0.5, 0.73, 0.95]) {
      expect(sigmoid(logit(p))).toBeCloseTo(p, 9)
    }
  })
  it('clampProb keeps values strictly inside (0,1)', () => {
    expect(clampProb(0)).toBeGreaterThan(0)
    expect(clampProb(1)).toBeLessThan(1)
    expect(clampProb(NaN)).toBe(0.5)
  })
})

describe('runStrategy ROI math', () => {
  it('computes YES ROI correctly for a win and a loss', () => {
    const data = [obs(0.25, 1, 'win'), obs(0.25, 0, 'loss')]
    const r = runStrategy('t', data, buyAllYes, 0)
    // win: (1-0.25)/0.25 = 3 ; loss: (0-0.25)/0.25 = -1 ; avg = 1
    expect(r.bets[0].roi).toBeCloseTo(3, 9)
    expect(r.bets[1].roi).toBeCloseTo(-1, 9)
    expect(r.avgRoi).toBeCloseTo(1, 9)
    expect(r.winRate).toBeCloseTo(0.5, 9)
  })
  it('prices the NO side at 1 - price', () => {
    // price 0.2 => NO is the favorite (1-0.2=0.8 >= threshold), NO cost = 0.8.
    // YES lost (wonYes=0) so NO won; ROI = (1-0.8)/0.8 = 0.25
    const r = runStrategy('t', [obs(0.2, 0)], backFavorites(0.8), 0)
    expect(r.bets[0].side).toBe('NO')
    expect(r.bets[0].cost).toBeCloseTo(0.8, 9)
    expect(r.bets[0].roi).toBeCloseTo(0.25, 9)
  })
  it('bankroll compounds the fixed fraction per bet', () => {
    const r = runStrategy('t', [obs(0.25, 1)], buyAllYes, 0.1)
    // one bet, roi=3, bankroll = 1 * (1 + 0.1*3) = 1.3
    expect(r.finalBankroll).toBeCloseTo(1.3, 9)
  })
})

describe('edge model fitting', () => {
  it('recovers a favorite–longshot slope (b > 1) on biased data', () => {
    const markets = makeFixtureMarkets({ n: 2000, seed: 7, shrink: 0.75 })
    const model = fitEdgeModel(reduceToObservations(markets))
    expect(model.b).toBeGreaterThan(1.05)
    // fair value should push a high price even higher (favorite under-priced)
    expect(fairValue(model, 0.85)).toBeGreaterThan(0.85)
    // and a low price even lower (longshot over-priced)
    expect(fairValue(model, 0.15)).toBeLessThan(0.15)
  })
  it('stays near efficient (b ~ 1) when no bias is injected', () => {
    const markets = makeFixtureMarkets({ n: 4000, seed: 11, shrink: 1, noiseSd: 0 })
    const model = fitEdgeModel(reduceToObservations(markets))
    expect(Math.abs(model.b - 1)).toBeLessThan(0.15)
  })
  it('returns the efficient prior for degenerate input', () => {
    expect(fitEdgeModel([]).b).toBe(1)
    expect(fitEdgeModel([obs(0.5, 1)]).b).toBe(1)
  })
})

describe('calibration', () => {
  it('reports higher realized frequency in higher price buckets under FLB', () => {
    const markets = makeFixtureMarkets({ n: 3000, seed: 3 })
    const cal = calibrate(reduceToObservations(markets))
    const low = cal.buckets[1] // 0.1-0.2
    const high = cal.buckets[8] // 0.8-0.9
    expect(high.realizedFreq).toBeGreaterThan(low.realizedFreq)
    // FLB signature: favorites under-priced (edge>0), longshots over-priced (edge<0)
    expect(high.edge).toBeGreaterThan(0)
    expect(low.edge).toBeLessThan(0)
    // Brier score is a valid probability score in [0,1]
    expect(cal.brier).toBeGreaterThan(0)
    expect(cal.brier).toBeLessThan(1)
  })
})

describe('out-of-sample backtest', () => {
  it('edge model beats the longshot control and buy-all-YES on held-out data', () => {
    const markets = makeFixtureMarkets({ n: 4000, seed: 5 })
    const { train, test } = splitByTime(reduceToObservations(markets), 0.5)
    const model = fitEdgeModel(train)

    const edge = runStrategy('edge', test, modelStrategy(model, 0.03))
    const longshots = runStrategy('long', test, backLongshots(0.2))
    const allYes = runStrategy('yes', test, buyAllYes)

    expect(edge.avgRoi).toBeGreaterThan(0)
    expect(edge.avgRoi).toBeGreaterThan(longshots.avgRoi)
    expect(edge.avgRoi).toBeGreaterThan(allYes.avgRoi)
    expect(longshots.avgRoi).toBeLessThan(0) // control loses under FLB
  })
})

describe('scoreMarkets', () => {
  it('ranks by expected ROI and respects edge/volume thresholds', () => {
    const model = fitEdgeModel(reduceToObservations(makeFixtureMarkets({ n: 2000 })))
    const candidates = [
      { id: 'a', question: 'a', price: 0.9, volume: 100000 },
      { id: 'b', question: 'b', price: 0.5, volume: 100000 }, // ~efficient, low edge
      { id: 'c', question: 'c', price: 0.1, volume: 100 }, // filtered by volume
    ]
    const picks = scoreMarkets(model, candidates, { minEdge: 0.02, minVolume: 5000 })
    expect(picks.every((p) => p.volume >= 5000)).toBe(true)
    expect(picks.every((p) => Math.abs(p.edge) >= 0.02)).toBe(true)
    // sorted best-first
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i - 1].expectedRoi).toBeGreaterThanOrEqual(picks[i].expectedRoi)
    }
  })
})
