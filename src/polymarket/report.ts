// Text report rendering for the CLI. Pure string builders — no I/O — so the
// output can be snapshot-tested or redirected to a file.

import type { CalibrationSummary, StrategyResult } from './types.ts'
import type { EdgeModel, ScoredMarket } from './edge.ts'

function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length)
}

function padL(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s
}

export function renderCalibration(cal: CalibrationSummary): string {
  const lines: string[] = []
  lines.push(
    `Calibration  (n=${cal.n}, base rate=${pct(cal.baseRate)}, Brier=${cal.brier.toFixed(4)})`,
  )
  lines.push(
    `  ${pad('price bucket', 14)}${padL('n', 6)}${padL('impliedP', 11)}` +
      `${padL('realized', 11)}${padL('edge', 10)}`,
  )
  for (const b of cal.buckets) {
    if (b.count === 0) continue
    const label = `${b.lo.toFixed(1)}-${b.hi.toFixed(1)}`
    const edgeStr = `${b.edge >= 0 ? '+' : ''}${pct(b.edge)}`
    lines.push(
      `  ${pad(label, 14)}${padL(String(b.count), 6)}` +
        `${padL(pct(b.meanPrice), 11)}${padL(pct(b.realizedFreq), 11)}${padL(edgeStr, 10)}`,
    )
  }
  return lines.join('\n')
}

export function renderModel(model: EdgeModel): string {
  const bias =
    model.b > 1.05
      ? 'favorite–longshot bias present (favorites under-priced)'
      : model.b < 0.95
        ? 'inverse bias (favorites over-priced)'
        : 'roughly efficient'
  return (
    `Edge model  P(win) = sigmoid(${model.a.toFixed(3)} + ${model.b.toFixed(3)}·logit(price))\n` +
    `  slope b = ${model.b.toFixed(3)}  ->  ${bias}  (fit on ${model.n} markets)`
  )
}

export function renderStrategies(results: StrategyResult[]): string {
  const lines: string[] = []
  lines.push('Strategy performance  (flat 1-unit stake; bankroll compounds 5%/bet)')
  lines.push(
    `  ${pad('strategy', 22)}${padL('bets', 6)}${padL('win%', 8)}` +
      `${padL('avgROI', 9)}${padL('t-stat', 8)}${padL('bankroll', 11)}`,
  )
  for (const r of results) {
    const roiStr = `${r.avgRoi >= 0 ? '+' : ''}${pct(r.avgRoi)}`
    lines.push(
      `  ${pad(r.name, 22)}${padL(String(r.nBets), 6)}${padL(pct(r.winRate), 8)}` +
        `${padL(roiStr, 9)}${padL(r.tStat.toFixed(2), 8)}${padL(r.finalBankroll.toFixed(2) + 'x', 11)}`,
    )
  }
  return lines.join('\n')
}

export function renderPicks(picks: ScoredMarket[], limit = 15): string {
  const lines: string[] = []
  lines.push(`Top edge picks  (model fair value vs market price, best ${limit})`)
  if (picks.length === 0) {
    lines.push('  (no market cleared the edge / volume thresholds)')
    return lines.join('\n')
  }
  lines.push(
    `  ${pad('side', 5)}${padL('price', 7)}${padL('fair', 7)}` +
      `${padL('edge', 8)}${padL('E[ROI]', 9)}  question`,
  )
  for (const p of picks.slice(0, limit)) {
    const edgeStr = `${p.edge >= 0 ? '+' : ''}${pct(p.edge)}`
    const q = p.question.length > 60 ? p.question.slice(0, 57) + '...' : p.question
    lines.push(
      `  ${pad(p.side, 5)}${padL(pct(p.price), 7)}${padL(pct(p.fair), 7)}` +
        `${padL(edgeStr, 8)}${padL('+' + pct(p.expectedRoi), 9)}  ${q}`,
    )
  }
  return lines.join('\n')
}
