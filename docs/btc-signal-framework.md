# BTC decision framework — frozen 2026-09-12

Version: `btc-horizons-v1`. Scope: spot long/cash decision support. No automated order submission. The two-day model uses hourly bars; it is not a validated HFT execution strategy.

## Hypotheses before testing

| Horizon | Decision bars | Trend | Price structure | Executed flow | Maximum hold |
|---|---|---:|---:|---:|---:|
| 2 days | 1 hour | 35% | 25% | 40% | 48 bars |
| 2 weeks | 4 hours | 45% | 30% | 25% | 84 bars |
| 2 months | UTC daily | 55% | 30% | 15% | 60 bars |

Weights are design priors, not optimized estimates or probabilities. Related EMA/momentum inputs share one capped trend contribution. RSI/MACD are diagnostics; ATR determines risk and a shock veto. CVD uses `2 × taker-buy quote volume − total quote volume` from the same venue and market. CVD divergence requires both a prior lower price low / higher CVD low and a subsequent price reclaim; it is a causal two-window comparison, not a claim of knowing the final market bottom.

The signed score ranges from −100 to +100. Missing flow contributes no directional evidence and reduces coverage; it is never upweighted into stronger conviction. Minimum coverage is 70%. Only completed candles enter decisions. Reject invalid OHLC, duplicate timestamps, stale data and gaps in the 200-bar decision window. No future observation may be aligned to an earlier timestamp.

Entry: score ≥25, a confirmed breakout/pullback/reversal, price no more than 2 ATR above EMA20, no 3-ATR single-bar shock. Exit/reduce: score ≤−15 or confirmed bearish divergence. Execute at the next open; skip a gap larger than 0.5 ATR from the deciding close. Fixed initial stops: 2/2.5/3 ATR respectively. Target: 2.5R. Stop takes priority if both stop and target occur inside one candle. Gaps through stops fill at the worse open. Time exit is 2/14/60 days. Risk budget 0.5% of equity per new position, capped at 25% spot exposure. Costs: 10 bp fee plus 5 bp slippage per side; repeat at double costs. No pyramiding. These thresholds are frozen for the initial experiment.

## Validation order

1. Unit checks of causal prefixes, missing flow, candle close timestamps, CVD sign, gaps, transaction costs and adverse stop ordering.
2. Real venue candles: ideally 180+ days hourly, 2+ years four-hourly, 5+ years daily. Persist source, exact range, row count and SHA-256. Missing or shortened history must be reported.
3. First 60% is development context; last 40% is a chronological holdout, with 200-bar warmup retained for features, flat account at the boundary. No weight search on holdout. Split holdout into three disjoint fixed-rule forward windows for consistency diagnostics.
4. Compare frozen model with EMA20/50 long/cash and spot buy-and-hold, applying identical costs. Report completed trades, net return, max drawdown, profit factor, exposure and cost stress. Open positions are closed at the sample boundary with exit costs.
5. A positive short test does not prove an edge. Fewer than 20 completed holdout trades, negative return under double costs, gaps or insufficient span prohibit an efficacy claim. New weights require a new version and untouched future observations.

Funding, OI, liquidation flow and order-book data need timestamped historical storage before adding them to a historical score. Funding sign matters; OI-USD also changes when price changes. Put/call OI does not identify buyer direction, and max pain is not a price target. A REST depth snapshot is not OFI. Current observations must never be copied backward through a multi-year backtest.

## Review findings

- History alignment previously selected points up to half the freshness window in the future.
- Composite exhaustion used absolute CVD change; larger one-way selling could increase the apparent reversal score. Missing flow also created a default exhaustion contribution.
- RSI on flat prices returned approximately 99, rather than 50; zero-loss positive returns did not reach 100.
- Regime taker strength divided by average interval volume rather than total volume, making it depend on window length.
- Regime volume bursts added bullish weight even during falling prices. Funding magnitude lost its sign, and OI was scored without price direction.
- The existing research ledger stamped fills at next open but used the new exposure for the preceding close/open gap. Legacy published evidence predates this correction and cannot validate the new framework.
- Six summary cards occupied a 12-column grid with the sixth alone on a second row; charts appeared below several expanded context panels.

## Sources and what they establish

- [Cont, Kukanov and Stoikov, The Price Impact of Order Book Events](https://arxiv.org/abs/1011.6402): OFI and market depth explain short-horizon contemporaneous price impact in equity data; this does not validate BTC forecasting weights.
- [Cont, Cucuringu and Zhang, Cross-Impact of Order Flow Imbalance](https://arxiv.org/abs/2112.13213): short-lived lagged-flow effects; horizon matters. Equity evidence is a mechanism reference, not crypto performance evidence.
- [Binance spot market API](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints): candle timestamps, base/quote volume and taker-buy fields.
- [OKX API](https://www.okx.com/docs-v5/en/): candle confirmation, UTC daily bars and historical pagination. OKX candles do not supply taker side; absence remains missing.
- [Binance USD-M market data](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest-Statistics): derivative statistics and retention limits; no invented long history.
- [Bailey et al., The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf): repeated strategy selection creates false discoveries; a single holdout is not sufficient proof.
