// Shared types for the Polymarket edge-finding + backtesting tool.
//
// The pipeline has four stages, each a pure function over these types:
//   research (fetch) -> observations -> edge model -> backtest -> report.
// Keeping the types in one place lets every stage stay a plain, testable
// function with no hidden coupling to the network or the CLI.

/** A resolved binary (Yes/No) market, reduced to what the backtest needs. */
export interface ResolvedMarket {
  /** Stable identifier (Polymarket conditionId, or a fixture id). */
  id: string
  /** Human-readable market question, for the report. */
  question: string
  /**
   * YES price at the chosen lead time before the market closed, in (0, 1).
   * This is the price we would have paid to enter, not the final 0/1 price.
   */
  entryPrice: number
  /** Did the YES side resolve to true? 1 = YES won, 0 = NO won. */
  wonYes: 0 | 1
  /** Dollar volume traded, used to filter illiquid noise. */
  volume: number
  /** Unix seconds the market closed, for reporting / ordering. */
  closedTs: number
}

/** One backtest observation: an entry price and the realised outcome. */
export interface Observation {
  id: string
  question: string
  price: number
  wonYes: 0 | 1
  volume: number
  closedTs: number
}

/** A single calibration bucket over a price range. */
export interface CalibrationBucket {
  /** Inclusive lower / exclusive upper price bound of the bucket. */
  lo: number
  hi: number
  /** Number of markets that fell in this bucket. */
  count: number
  /** Mean market-implied probability (mean entry price) in the bucket. */
  meanPrice: number
  /** Realised YES win frequency in the bucket. */
  realizedFreq: number
  /**
   * Realised minus implied. Positive means the market under-priced YES here
   * (buying YES was +EV); negative means YES was over-priced.
   */
  edge: number
}

/** A directional bet the strategy chose to place. */
export interface Bet {
  id: string
  question: string
  /** 'YES' = bought YES at price; 'NO' = bought NO at (1 - price). */
  side: 'YES' | 'NO'
  /** Cost paid per share for the chosen side, in (0, 1). */
  cost: number
  /** 1 if the chosen side won, else 0. */
  won: 0 | 1
  /** Return on the one unit staked: (won - cost) / cost. */
  roi: number
}

/** Aggregate performance of a strategy over the backtest set. */
export interface StrategyResult {
  name: string
  nBets: number
  winRate: number
  /** Mean ROI per unit staked (flat stake of 1 per bet). */
  avgRoi: number
  /** Total profit/loss in units, flat staking. */
  totalPnl: number
  /** Standard deviation of per-bet ROI. */
  stdRoi: number
  /** t-statistic of mean ROI vs 0; |t| >~ 2 is suggestive of a real edge. */
  tStat: number
  /** Final bankroll starting from 1.0, compounding a fixed fraction per bet. */
  finalBankroll: number
  bets: Bet[]
}

/** Brier score and base rate for the whole set (lower Brier = better calibrated). */
export interface CalibrationSummary {
  brier: number
  baseRate: number
  n: number
  buckets: CalibrationBucket[]
}
