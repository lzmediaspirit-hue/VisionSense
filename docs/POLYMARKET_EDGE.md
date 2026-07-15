# Polymarket Edge Finder & Backtester

A small, dependency-free tool that **researches** Polymarket markets, fits an
**edge model**, **backtests** it out-of-sample, and **ranks the best current
bets** by that edge. It lives in [`src/polymarket/`](../src/polymarket) and is
independent of the VisionSense app.

```
node src/polymarket/cli.ts                 # offline demo on synthetic fixtures
node src/polymarket/cli.ts --live          # real resolved markets (needs open HTTPS)
node src/polymarket/cli.ts --live --picks  # also score current OPEN markets
```

> The npm alias `npm run polymarket -- --live` does the same thing.

## The theory being tested: favorite–longshot bias (FLB)

A well-documented regularity across betting and prediction markets: **longshots
(cheap outcomes) are over-priced and favorites (expensive outcomes) are
under-priced**, because bettors overpay for lottery-like payoffs. If it holds,
the market-implied probability is a *shrunk* version of the true probability,
and un-shrinking it recovers a fair value we can trade against.

We model it as logistic regression of the realised outcome on the market's
log-odds:

```
P(YES wins | price p) = sigmoid(a + b · logit(p))
```

- `b = 1, a = 0` → a perfectly efficient market (fair value = price).
- `b > 1` → true log-odds are *more extreme* than the market's: favorites should
  be even more favored, longshots even less. **That is FLB**, and it makes
  backing favorites +EV.

The per-market YES edge is `fairValue(p) − p`; positive means buy YES, negative
means buy NO.

## Pipeline (four pure stages)

| Stage | File | What it does |
|------|------|--------------|
| 1. Research | [`client.ts`](../src/polymarket/client.ts) | Fetch resolved binary markets from the Gamma catalog API and, per market, the YES **entry price `--lead` hours before it closed** from the CLOB price-history API. |
| 2. Edge model | [`edge.ts`](../src/polymarket/edge.ts) | Fit `a, b` by Newton–Raphson (IRLS) with a small ridge penalty. Deterministic. |
| 3. Backtest | [`backtest.ts`](../src/polymarket/backtest.ts) | Calibration table + Brier score, and strategy P&L (win rate, avg ROI, t-stat, compounding bankroll). |
| 4. Best bets | [`edge.ts` `scoreMarkets`](../src/polymarket/edge.ts) | Rank markets by expected ROI, filtered by min edge and min volume. |

### Backtest discipline

- **Chronological train/test split** (`splitByTime`): the model is fit on the
  *older* half and evaluated on the *newer* half — no lookahead.
- **Honest P&L math.** A Polymarket share bought at cost `c` pays \$1 if it wins,
  so ROI on the staked unit is `(won − c) / c`. Backing NO costs `1 − p`.
- **A control strategy** (`back-longshots`) that should *lose* money if FLB is
  real — a sanity check against fooling ourselves. `buy-all-YES` is a naive
  baseline.
- **Calibration table**: does an 0.80 market really win ~80% of the time? The
  `edge` column (realized − implied) is the raw, model-free signal.

Read the `t-stat` as significance of the mean ROI: `|t| ≳ 2` is suggestive of a
real edge, not noise. **Treat it as an upper bound**: it assumes bets are
independent, but live Polymarket markets cluster (a single event split into many
correlated binaries, crypto price ladders), so the effective sample is smaller
than the bet count and the t-stat runs anti-conservative. Favorite payoffs are
also skewed (many small wins, rare −100% losses), which the normal
approximation handles poorly at small `n`.

## Sample offline run

The committed fixtures (`fixtures.ts`) generate resolved markets from a *known*
process that injects FLB (`SHRINK = 0.78`). A run recovers it:

```
Edge model  P(win) = sigmoid(-0.042 + 1.125·logit(price))   -> b>1, FLB present
back-favorites>=0.80   170 bets   89.4% win   +3.1% avgROI
edge-model (OOS)       105 bets   82.9% win   +8.5% avgROI  t=1.74  bankroll 1.51x
back-longshots<=0.20   170 bets   10.6% win  -24.2% avgROI   (control loses, as expected)
```

**These numbers validate the machinery, not the real market** — the fixtures
*inject* the bias by construction. For a verdict on live Polymarket, run
`--live`.

## Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--live` | off | Fetch real data instead of fixtures |
| `--picks` | off | With `--live`, also score current open markets |
| `--lead=<hours>` | 24 | Enter this long before market close |
| `--min-volume=<$>` | 5000 | Skip illiquid markets |
| `--max=<n>` | 300 | Max resolved markets to keep (live) |
| `--fav-threshold=<0..1>` | 0.8 | Price cutoff for the favorites strategy |
| `--min-edge=<0..1>` | 0.03 | Minimum \|fair − price\| to place a bet |
| `--train=<0..1>` | 0.5 | Fraction of history used to fit the model |
| `--seed=<int>` | 42 | Fixture RNG seed (offline) |

## Data sources

- **Gamma API** `https://gamma-api.polymarket.com/markets` — market metadata &
  resolution. `outcomes`, `outcomePrices`, `clobTokenIds` arrive as JSON
  *strings* and must be parsed; a resolved binary market settles to `["1","0"]`.
- **CLOB API** `https://clob.polymarket.com/prices-history` — historical price
  time-series per outcome token: `{ history: [{ t, p }] }`.

Both are read-only and need no API key.

## Caveats (read before betting real money)

- FLB is **regime- and category-dependent**; it can be weaker or absent in
  liquid, heavily-arbitraged markets. Always judge on `--live` data.
- The backtest ignores **fees, slippage, and the bid/ask spread**; entering at
  the mid-price overstates returns. Treat `avgROI` as an upper bound.
- Resolution risk (disputed UMA outcomes) and thin-book fills are not modeled.
- Past calibration does not guarantee future calibration. This is a research
  tool, not investment advice.
