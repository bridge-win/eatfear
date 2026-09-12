# BTC review and operating plan — 2026-09-12

Latest inspected candles: Binance BTCUSDT spot; 1h close 05:00 UTC, 4h close 04:00 UTC, daily close 00:00 UTC on September 12. These are completed candle observations, not a real-time quote. The 1h reference close is $77,222.75.

## Decision

**Wait for confirmation in all three horizons. The proposed grouped weights have not established a profitable edge and are restricted to research / paper trading.** A bullish score without a price setup is insufficient. The daily score is positive (+28.5), while 1h and 4h scores are negative (−7.7 and −13.3); a broad trend does not establish an intraday bottom.

## Historical evaluation

Frozen rules, 60/40 chronological split, no holdout parameter search. Each trade risks 0.5% equity and uses at most 25% spot exposure. Commission 10 bp plus slippage 5 bp each side; double-cost run uses 20+10 bp each side. Net returns are account returns, not leveraged trade returns.

| Horizon | Bars | Holdout net | Double costs | Max drawdown | Trades | EMA with same risk rules | 100% buy-and-hold |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2d | 4569 | -2.44% | -4.15% | -3.14% | 27 | -1.66% | +28.01% |
| 2w | 4629 | -1.03% | -1.82% | -4.41% | 18 | +0.17% | -23.28% |
| 2m | 2074 | -0.41% | -0.56% | -1.68% | 10 | +0.43% | +11.89% |

The full-exposure buy-and-hold benchmark has a different risk budget. Reduced drawdown or a better result than EMA does not demonstrate alpha. All three grouped-weight models underperformed their EMA baselines and lost money after costs. Increasing CVD weight has not demonstrated an improvement in this experiment. The two-week and two-month models also fail the minimum 20 completed-trade gate. Three disjoint forward windows do not show consistent positive results. No weight was selected after inspecting this holdout.

History: 1h 2026-03-05 → 2026-09-12 (holdout from 2026-06-28); 4h 2024-08-01 → 2026-09-12 (holdout from 2025-11-07); daily 2021-01-07 → 2026-09-12 (holdout from 2024-06-04). No timestamp gaps detected. Exact timestamps, source queries, checksums and metrics are in `public/research/btc-plan-validation.json`.

## Conditional operating plan

| Horizon | Present evidence | Buy observation / confirmation | Reduce / invalidate |
|---|---|---|---|
| Next 2 days | 1h below EMA20 77,366, EMA50 77,579 and rolling VWAP 77,655; RSI 46.6. Recent taker imbalance +4.54% has not confirmed a price reversal. | First reclaim 77,650–77,700 on a completed hour; then a pullback that holds and a score ≥25, or a volume breakout above the moving 20-bar high (currently 79,890). Avoid a >2ATR extension. | A completed loss of 76,047 support / score ≤−15 strengthens the defensive case. Illustrative 2ATR stop from the snapshot close is 76,394, not an instruction to enter now. |
| Next 2 weeks | 4h EMA20 77,748 < EMA50 78,277; price below VWAP 77,939. RSI 41.3, taker imbalance −0.99%. | Look for 4h reclaim of the 77,940–78,280 area, EMA alignment and confirmed pullback/volume breakout. 79,890 is the current 20-bar high, not a guaranteed target. | Failure to hold 76,047 or persistent negative score weakens the setup. Snapshot 2.5ATR stop example: 75,038; recompute from actual entry, with a 14-day time stop. |
| Next 2 months | Daily EMA20 77,019 > EMA50 72,881, but price below 20-bar VWAP 78,697; recent flow −6.34%, no confirmed divergence. | Observe daily reclaim of 78,697 with positive flow and a qualifying setup. A sustained break/retest of 82,300 would strengthen the trend case. Positive EMA structure alone is insufficient. | Watch 75,546 range support, then the 72,881–72,935 daily EMA50/200 area. Stop example at snapshot close: 70,210 (3ATR); this is a risk calculation, not a recommended trade. |

At an actual entry, recalculate all moving levels. Position fraction = min(25%, 0.5% / stop distance as a fraction of entry). Reduce aggregate exposure when horizons overlap: all three positions would be the same BTC risk, so do not independently spend 0.5% on each. A sell condition means reducing spot holdings; this study does not justify shorting perpetuals. Funding and borrow costs are excluded because this is a spot long/cash study.

## Top signals by role

| Signal | Mechanism / use | Limit |
|---|---|---|
| Executed taker delta / CVD | Aggressor demand; divergence plus subsequent price reclaim | Same venue/market and quote units; do not infer from candle colour |
| Event OFI | Additions, cancellations and trades at bid/ask; short-lived supply/demand pressure | Requires sequence-correct L2 event history, not a REST snapshot |
| Spread, depth and microprice | Execution cost and queue imbalance | A filter for entry quality; spoofing and latency matter |
| Funding + coin-denominated OI change | Crowded leverage with price/flow confirmation | Funding sign matters; USD OI partly reflects price |
| Liquidation burst then decay | Forced deleveraging followed by stabilization | Exchange liquidation streams may be sampled; absence is not zero |
| VWAP reclaim / rejection | Whether price regains a recent traded-cost level | Rolling candle VWAP differs from an exact event-anchored trade VWAP |
| EMA structure + slope | Direction and regime | EMA/MACD are related price transforms; cap their shared weight |
| Donchian break + relative volume | Completed price structure break and participation | Exclude the current candle from the reference high/low |
| ATR / realized volatility | Stop distance, sizing, shock veto | Volatility has no intrinsic bullish direction |
| RSI divergence / return toward 50 | Secondary exhaustion / momentum confirmation | Oversold alone can remain oversold; no standalone bottom call |

For a two-month allocation, ETF flows, stablecoin supply, macro liquidity and valuation are useful background. They are slower and may have publication lags; current values cannot be replayed through old candles. Options put/call OI and max pain do not reveal directional positioning without dealer-side and trade-side information.

## HFT boundary and next evidence needed

The dashboard polls public REST data and the collector runs on scheduled infrastructure. It cannot validate millisecond trading. A defensible HFT extension requires a persistent WebSocket collector for trades and sequence-numbered L2 book updates; snapshot/delta reconciliation; exchange and receive timestamps; gap recovery; maker queue position, partial fills and taker costs; latency and impact stress; and archived funding/OI/liquidation observations. Use these data first to estimate incremental predictive value at 1s/5s/30s/5m horizons. Do not assign OFI, liquidations or a book snapshot a large historical score without this archive.

## Using the application

Open `/crypto`, choose BTC, and inspect the new three-horizon plan before the history chart. On mobile, choose a horizon using the tabs. Open “Triggers, exits & evidence” for thresholds, ATR risk examples, historical performance and direct source links. A missing or stale feed displays a wait state. Detailed options / flow / radar context remains available below the chart. Old static research badges are marked for re-audit after the ledger correction. `/api/crypto/trade-plan?ccy=BTC` returns the same signal inputs used by the visible plan.

Reproduce: `python scripts/fetch-btc-research.py --output /tmp/eatfear-data`, then `node scripts/backtest-btc-plan.ts /tmp/eatfear-data public/research/btc-plan-validation.json`. The fetcher defaults to the present timestamp, so a future rerun produces a different dataset; preserve the original raw files or request the exact recorded queries for the original audit.

Research references and the frozen experiment specification are in [btc-signal-framework.md](btc-signal-framework.md).

## Engineering verification

- 74 tests passed, including causal prefixes, missing-data decisions, CVD sign, stop ordering and independent Python/TypeScript ledger reconciliation.
- `tsc --noEmit` passed separately; the existing Next configuration skips build-time type checking.
- Production build passed using the environment system certificate store for Google Fonts (`NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1`).
- `/crypto` served HTTP 200 with the new plan rendered. Invalid currencies returned HTTP 400; complete upstream failure returned HTTP 503 with no fabricated values.
- Final live API verification returned HTTP 200, all three Binance spot plans with 100% model-input coverage, `watch` decisions, `validation: not_validated` and `executionEnabled: false`.
- Cloud Browser URL policy blocked both the local preview and local rendered HTML. No screenshot or interactive browser verification is claimed; the responsive layout remains a visual verification limitation.
