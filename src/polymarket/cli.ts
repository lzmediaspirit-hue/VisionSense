// Orchestrator: research -> edge model -> backtest -> report.
//
// Run offline against the committed fixtures (default), or live against real
// Polymarket data:
//
//   node src/polymarket/cli.ts                 # offline, synthetic fixtures
//   node src/polymarket/cli.ts --live          # fetch real resolved markets
//   node src/polymarket/cli.ts --live --picks  # + score current open markets
//
// Flags: --lead=<hours> --min-volume=<$> --max=<markets> --seed=<int>
//        --fav-threshold=<0..1> --min-edge=<0..1> --train=<0..1>
//
// The four stages are pure functions from ./edge, ./backtest, ./fixtures and
// ./client; this file only parses flags, sequences the stages, and prints.

import type { ResolvedMarket } from './types.ts'
import { fitEdgeModel, reduceToObservations, scoreMarkets } from './edge.ts'
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
import {
  renderCalibration,
  renderModel,
  renderPicks,
  renderStrategies,
} from './report.ts'

interface Args {
  live: boolean
  picks: boolean
  leadHours: number
  minVolume: number
  max: number
  seed: number
  favThreshold: number
  minEdge: number
  trainFraction: number
}

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>()
  const bare = new Set<string>()
  for (const a of argv.slice(2)) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v === undefined) bare.add(k)
      else flags.set(k, v)
    }
  }
  const num = (k: string, d: number) =>
    flags.has(k) ? Number(flags.get(k)) : d
  return {
    live: bare.has('live'),
    picks: bare.has('picks'),
    leadHours: num('lead', 24),
    minVolume: num('min-volume', 5000),
    max: num('max', 300),
    seed: num('seed', 42),
    favThreshold: num('fav-threshold', 0.8),
    minEdge: num('min-edge', 0.03),
    trainFraction: num('train', 0.5),
  }
}

function line(s = ''): void {
  console.log(s)
}

function header(title: string): void {
  line()
  line('='.repeat(72))
  line(title)
  line('='.repeat(72))
}

async function acquireData(args: Args): Promise<ResolvedMarket[]> {
  if (!args.live) {
    line(`Data source: offline synthetic fixtures (seed=${args.seed})`)
    return makeFixtureMarkets({ seed: args.seed })
  }
  line('Data source: LIVE Polymarket (Gamma + CLOB)')
  const { fetchResolvedMarkets } = await import('./client.ts')
  return fetchResolvedMarkets({
    maxMarkets: args.max,
    leadHours: args.leadHours,
    minVolume: args.minVolume,
    log: (m) => line('  ' + m),
  })
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  header('STAGE 1 — RESEARCH: acquire resolved markets')
  let markets: ResolvedMarket[]
  try {
    markets = await acquireData(args)
  } catch (err) {
    line(`\nLive fetch failed: ${(err as Error).message}`)
    line(
      'Polymarket hosts are unreachable here (common in sandboxes with egress\n' +
        'policy). Run this on a machine with open outbound HTTPS, or omit --live\n' +
        'to use the offline fixtures.',
    )
    process.exit(1)
  }
  line(`Acquired ${markets.length} resolved binary markets.`)
  if (markets.length < 20) {
    line('Too few markets to draw conclusions — widen --max or lower --min-volume.')
    process.exit(1)
  }

  const obs = reduceToObservations(markets)
  const { train, test } = splitByTime(obs, args.trainFraction)

  header('STAGE 2 — EDGE MODEL: fit the favorite–longshot curve (train split)')
  const model = fitEdgeModel(train)
  line(renderModel(model))
  line()
  line('Full-sample calibration (is the market well-calibrated?):')
  line(renderCalibration(calibrate(obs)))

  header('STAGE 3 — BACKTEST: out-of-sample on the held-out test split')
  line(
    `Train: ${train.length} markets  |  Test: ${test.length} markets ` +
      `(chronological split, no lookahead)\n`,
  )
  const results = [
    runStrategy('buy-all-YES', test, buyAllYes),
    runStrategy(`back-longshots<=${(1 - args.favThreshold).toFixed(2)}`, test, backLongshots(1 - args.favThreshold)),
    runStrategy(`back-favorites>=${args.favThreshold.toFixed(2)}`, test, backFavorites(args.favThreshold)),
    runStrategy('edge-model (OOS)', test, modelStrategy(model, args.minEdge)),
  ]
  line(renderStrategies(results))
  line()
  line('Read: avgROI is return per $1 staked; t-stat > ~2 suggests a real edge.')
  line('back-longshots is the control — if the bias is real it should lose money.')

  header('STAGE 4 — FIND BEST BETS: rank markets by model edge')
  if (args.live && args.picks) {
    const { fetchLiveMarkets } = await import('./client.ts')
    line('Scoring current OPEN markets...\n')
    const liveMarkets = await fetchLiveMarkets({ minVolume: args.minVolume })
    const picks = scoreMarkets(model, liveMarkets, {
      minEdge: args.minEdge,
      minVolume: args.minVolume,
    })
    line(renderPicks(picks))
  } else {
    line('Illustrative ranking over the test-split markets (their entry prices')
    line('treated as current quotes). Use --live --picks to score real open markets.\n')
    const candidates = test.map((o) => ({
      id: o.id,
      question: o.question,
      price: o.price,
      volume: o.volume,
    }))
    const picks = scoreMarkets(model, candidates, {
      minEdge: args.minEdge,
      minVolume: args.minVolume,
    })
    line(renderPicks(picks))
  }

  header('SUMMARY')
  const edgeModelResult = results[results.length - 1]
  const control = results[1]
  const verdict =
    model.b > 1.05 && edgeModelResult.avgRoi > 0 && edgeModelResult.tStat > 1.5
      ? 'The favorite–longshot edge is present and profitable out-of-sample.'
      : model.b > 1.05
        ? 'A favorite–longshot bias is detectable but the OOS edge is weak/noisy.'
        : 'No exploitable favorite–longshot edge detected in this sample.'
  line(verdict)
  line(
    `  model slope b=${model.b.toFixed(3)} | edge-model OOS avgROI=` +
      `${(edgeModelResult.avgRoi * 100).toFixed(1)}% (t=${edgeModelResult.tStat.toFixed(2)}, n=${edgeModelResult.nBets})` +
      ` | control avgROI=${(control.avgRoi * 100).toFixed(1)}%`,
  )
  if (!args.live) {
    line(
      '\nNOTE: these numbers are from synthetic fixtures that *inject* the bias,\n' +
        'so a positive result here validates the machinery, not the real market.\n' +
        'Run with --live for a verdict on live Polymarket data.',
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
