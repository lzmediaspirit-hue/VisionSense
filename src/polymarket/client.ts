// Live Polymarket data client (Gamma catalog + CLOB price history).
//
// Read-only, no API key needed. Two public hosts:
//   Gamma  https://gamma-api.polymarket.com  — market metadata & resolution
//   CLOB   https://clob.polymarket.com       — historical price time-series
//
// Gamma ships `outcomes`, `outcomePrices` and `clobTokenIds` as JSON *strings*,
// not arrays, so they must be parsed. A resolved binary market has final
// outcomePrices of ["1","0"] or ["0","1"]; the "1" marks the winning outcome.
//
// NOTE: this file only runs where outbound HTTPS to Polymarket is allowed. In
// restricted CI/sandbox environments use the fixtures path instead (`--offline`).

import type { ResolvedMarket } from './types.ts'

const GAMMA = 'https://gamma-api.polymarket.com'
const CLOB = 'https://clob.polymarket.com'

interface GammaMarket {
  conditionId?: string
  id?: string
  question?: string
  outcomes?: string
  outcomePrices?: string
  clobTokenIds?: string
  closed?: boolean
  volumeNum?: number
  volume?: string | number
  endDate?: string
  endDateIso?: string
}

interface PricePoint {
  t: number
  p: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseJsonArray(s: string | undefined): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

/** Index of the "Yes" outcome, or -1 if this isn't a Yes/No market. */
function yesIndex(outcomes: string[]): number {
  if (outcomes.length !== 2) return -1
  const lower = outcomes.map((o) => o.toLowerCase())
  const yi = lower.indexOf('yes')
  const ni = lower.indexOf('no')
  return yi >= 0 && ni >= 0 ? yi : -1
}

/** YES price at `targetTs` = last observed price at or before that instant. */
function priceAt(history: PricePoint[], targetTs: number): number | null {
  let chosen: number | null = null
  for (const pt of history) {
    if (pt.t <= targetTs) chosen = pt.p
    else break
  }
  // Fall back to the earliest point if the target predates all history.
  if (chosen === null && history.length > 0) chosen = history[0].p
  return chosen
}

export interface FetchResolvedOptions {
  /** How many Gamma markets to scan (paged in batches of 100). */
  scan?: number
  /** Keep at most this many usable resolved markets. */
  maxMarkets?: number
  /** Enter this many hours before market close (the backtest lead time). */
  leadHours?: number
  /** Skip markets with less than this dollar volume. */
  minVolume?: number
  /** Optional logger for progress. */
  log?: (msg: string) => void
}

/**
 * Fetch resolved binary markets and, for each, the YES entry price `leadHours`
 * before it closed. This is the historical dataset the backtest consumes.
 */
export async function fetchResolvedMarkets(
  opts: FetchResolvedOptions = {},
): Promise<ResolvedMarket[]> {
  const scan = opts.scan ?? 500
  const maxMarkets = opts.maxMarkets ?? 200
  const leadSeconds = (opts.leadHours ?? 24) * 3600
  const minVolume = opts.minVolume ?? 5000
  const log = opts.log ?? (() => {})

  const out: ResolvedMarket[] = []
  const pageSize = 100
  for (let offset = 0; offset < scan && out.length < maxMarkets; offset += pageSize) {
    const url =
      `${GAMMA}/markets?closed=true&limit=${pageSize}&offset=${offset}` +
      `&order=volumeNum&ascending=false`
    const page = await getJson<GammaMarket[]>(url)
    if (page.length === 0) break
    log(`Gamma page @${offset}: ${page.length} markets (kept ${out.length})`)

    for (const m of page) {
      if (out.length >= maxMarkets) break
      const outcomes = parseJsonArray(m.outcomes)
      const prices = parseJsonArray(m.outcomePrices)
      const tokens = parseJsonArray(m.clobTokenIds)
      const yi = yesIndex(outcomes)
      if (yi < 0 || prices.length !== 2 || tokens.length !== 2) continue

      // Resolved markets settle to exactly 1 / 0.
      const finalYes = Number(prices[yi])
      if (finalYes !== 0 && finalYes !== 1) continue
      const volume = Number(m.volumeNum ?? m.volume ?? 0)
      if (volume < minVolume) continue

      const endIso = m.endDate ?? m.endDateIso
      if (!endIso) continue
      const endTs = Math.floor(new Date(endIso).getTime() / 1000)
      if (!Number.isFinite(endTs)) continue

      try {
        const hist = await getJson<{ history: PricePoint[] }>(
          `${CLOB}/prices-history?market=${tokens[yi]}&interval=max&fidelity=60`,
        )
        const entry = priceAt(hist.history ?? [], endTs - leadSeconds)
        if (entry === null || entry <= 0 || entry >= 1) continue
        out.push({
          id: m.conditionId ?? m.id ?? String(out.length),
          question: m.question ?? '(unknown)',
          entryPrice: entry,
          wonYes: finalYes === 1 ? 1 : 0,
          volume,
          closedTs: endTs,
        })
      } catch (err) {
        log(`  skip ${m.question ?? m.id}: ${(err as Error).message}`)
      }
      await sleep(120) // be polite to the CLOB endpoint
    }
  }
  return out
}

export interface LiveMarket {
  id: string
  question: string
  price: number
  volume: number
}

/** Fetch currently-open binary markets and their YES price, for edge scoring. */
export async function fetchLiveMarkets(
  opts: { limit?: number; minVolume?: number } = {},
): Promise<LiveMarket[]> {
  const limit = opts.limit ?? 200
  const minVolume = opts.minVolume ?? 5000
  const url =
    `${GAMMA}/markets?closed=false&active=true&limit=${limit}` +
    `&order=volumeNum&ascending=false`
  const page = await getJson<GammaMarket[]>(url)
  const out: LiveMarket[] = []
  for (const m of page) {
    const outcomes = parseJsonArray(m.outcomes)
    const prices = parseJsonArray(m.outcomePrices)
    const yi = yesIndex(outcomes)
    if (yi < 0 || prices.length !== 2) continue
    const price = Number(prices[yi])
    if (!(price > 0 && price < 1)) continue
    const volume = Number(m.volumeNum ?? m.volume ?? 0)
    if (volume < minVolume) continue
    out.push({
      id: m.conditionId ?? m.id ?? String(out.length),
      question: m.question ?? '(unknown)',
      price,
      volume,
    })
  }
  return out
}
