# Smart Money Intelligence Platform

> Route: `/crypto/smart-money`
> Status: v3 implemented
> Product area: Crypto

## 1. Product objective

This page is an evidence-first command center for observing consistently profitable market participants across centralized exchanges, Hyperliquid, and Polymarket. It combines:

- near-real-time ranked-actor activity;
- one normalized discovery table across four venues;
- exchange copy-trading detail and performance curves;
- user-managed Hyperliquid wallet tracking;
- derivatives positioning, aggressive flow, funding, open interest, and cross-venue checks;
- explicit source health, freshness, confidence, verification class, and limitations.

The page does not claim that a visible large trade is smart. A participant qualifies through a versioned evidence score or a current public leaderboard. Large unranked fills remain clearly labeled observations.

## 2. Command-center surfaces

| Tab | Purpose |
| --- | --- |
| Pulse | Live evidence tape, ranked-actor consensus, multi-factor intelligence, positioning, taker flow, and capital verification |
| Live Feed | Filterable Hyperliquid and Polymarket fills with actor, action, amount, market, age, source, confidence, and verification link |
| Discover | Unified OKX, Binance, Hyperliquid, and Polymarket ranking with score components, flags, limitations, and venue profile links |
| Wallets | Guest-local Hyperliquid watchlist with equity, PnL windows, open positions, leverage, liquidation price, and ROE |
| Sources | Independent source probes, optional licensed-provider readiness, methodology, and risk disclosure |

The evidence feed refreshes every 15 seconds. Discovery and source-health snapshots refresh every 60 seconds. The same feed payload drives the tape, Pulse consensus, and Live Feed so the page does not issue duplicate live-feed requests.

## 3. First-party sources

| Capability | Source | Upstream contract | Verification and limitations |
| --- | --- | --- | --- |
| Lead-trader leaderboard and drill-down | OKX Copy Trading | `public-lead-traders`, `public-stats`, `public-pnl`, `public-current-subpositions` | Venue-calculated performance; identity, full exposure, and external hedges remain unknown |
| Lead-trader leaderboard | Binance Copy Trading | Public web `query-list` used by Binance's frontend | Venue-reported and useful, but the endpoint is undocumented and always identified as degraded-contract data |
| Public perp actors | Hyperliquid Stats | `stats-data.hyperliquid.xyz/Mainnet/leaderboard` | Official opt-in public leaderboard; address ownership and external hedges remain unknown |
| Recent perp fills | Hyperliquid Info API | `POST /info {"type":"recentTrades","coin":"BTC"}` | Settled buyer/seller counterparties; a fill does not reveal whether a position opened or closed |
| Prediction-market actors | Polymarket Data API | `/v1/leaderboard` | Monthly leaderboard window; profile verification does not prove intent |
| Prediction-market activity | Polymarket Data API | `/trades` | Observable fills and market links; complete exposure and off-platform hedges remain unknown |
| Positioning and crowd baseline | Binance Futures | `topLongShortPositionRatio`, `topLongShortAccountRatio`, `globalLongShortAccountRatio`, `takerlongshortRatio` | Public aggregate derivatives statistics with bounded retention |
| Cross-venue positioning and flow | OKX Rubik | `long-short-account-ratio`, `taker-volume`, `open-interest-volume` | Public venue aggregates with source-specific retention |
| Funding verification | OKX | `funding-rate-history` | Observable holding-cost history, not actor identity evidence |
| Wallet positions and PnL | Hyperliquid Info API | `clearinghouseState`, `portfolio` | Public account state; address attribution and external positions remain unknown |

Hyperliquid's leaderboard is approximately 33 MB. The adapter incrementally parses the first 100 complete rows from the response stream and cancels the remainder, reducing latency while preserving the official source.

## 4. Normalized evidence contract

Every actor contains:

- venue, stable ID, name/address, profile URL, and categories;
- normalized performance and capital metrics;
- `actor-quality-v1` score, copyability score, category, confidence, coverage, components, and flags;
- provenance with source, source type, observation time, freshness, verification class, confidence, and limitations.

Every event contains:

- stable event ID, actor, venue, action, asset, market, amount, price, PnL, and transaction ID;
- `ranked` or `observed_large_trade` qualification;
- source/event/observation timestamps and freshness;
- direct market or transaction verification link;
- explicit limitations.

Percentage fields use percentage points everywhere: `12.5` means `12.5%`. OKX ratio fields are multiplied by 100 once. Binance's already-percent fields are not multiplied. Missing or invalid numbers remain `null`; they never become zero.

## 5. Actor quality and copyability

`actor-quality-v1` scores available evidence from 0 to 100:

| Component | Weight |
| --- | ---: |
| Realized or venue-calculated PnL percentile | 25% |
| Normalized ROI percentile | 20% |
| Win-rate percentile | 15% |
| Drawdown protection | 15% |
| Activity duration | 10% |
| Capital at risk/account value | 10% |
| Data completeness | 5% |

Weights are renormalized over available inputs. Coverage below 50% is low confidence and cannot receive a proven or elite classification. Categories are elite (90+), proven (75+), watch (60+), and unranked.

Copyability starts at 100 and applies transparent penalties for high or missing drawdown, short or missing history, full follower capacity, extreme ROI without matching capital/history, low coverage, and unavailable liquidity/slippage evidence. The scores are descriptive research outputs, not return forecasts or copy recommendations.

## 6. Live feed and consensus

The feed qualifies Hyperliquid addresses against the streamed top 100 and Polymarket addresses against the monthly top 50. It also fetches recent trades for leading Polymarket addresses so ranked evidence remains visible when the global tape is dominated by smaller accounts.

- Ranked fills enter actor consensus.
- Unranked Hyperliquid fills require at least USD 100,000 to appear.
- Unranked Polymarket fills require at least USD 5,000 to appear.
- Unranked fills are observations and never contribute to smart-actor consensus.
- Events are deduplicated by deterministic ID and sorted by real event time.
- Future timestamps are rejected and are never marked live.

Consensus counts each qualifying actor once using its most recent directional event. A directional label requires at least three actors and two independent venues. Otherwise the response is `insufficient`, even when one venue has many events.

## 7. API routes

| Route | Main response |
| --- | --- |
| `GET /api/crypto/smart-money/discovery?venue&sort&limit` | `{ actors, sources, filters, updatedAt }` |
| `GET /api/crypto/smart-money/feed?ccy&limit&minUsd` | `{ events, consensus, sources, filters, updatedAt }` |
| `GET /api/crypto/smart-money/health` | `{ sources, updatedAt }` |
| `GET /api/crypto/smart-money/leaders?source&sort&page` | Legacy OKX/Binance venue leaderboard |
| `GET /api/crypto/smart-money/leader-detail?uniqueCode&range` | OKX statistics, normalized ROI curve, and current public positions |
| `GET /api/crypto/smart-money/positioning?ccy&range` | Top-vs-crowd positioning and taker ratios |
| `GET /api/crypto/smart-money/verification?ccy` | Funding, open interest, cross-venue checks, and evidence states |
| `GET /api/crypto/smart-money/wallet?address` | Hyperliquid account equity, PnL, and positions |

Aggregate routes fetch sources concurrently. One source failure does not fail the response. Discovery returns HTTP 502 only when every first-party actor source fails. Feed returns HTTP 502 only when both event sources are unavailable.

## 8. Source health and optional enrichment

The health route independently probes small first-party endpoints with four-second deadlines:

- OKX public time;
- Binance futures time;
- Hyperliquid `allMids`;
- a one-row Polymarket leaderboard.

Health statuses are:

- `operational`: a current request and schema validation succeeded;
- `degraded`: data is usable with a known contract/methodology limitation or a schema/configuration concern;
- `unavailable`: request failed or timed out;
- `not_configured`: an optional licensed connection is absent.

Server-only optional connections are recognized for Nansen, Arkham, Cielo, Helius, Alchemy, and Bubblemaps. Their keys and environment-variable names never enter browser responses. Missing connections do not trigger scraping, fixtures, or inferred replacement data.

## 9. Persistence and privacy

`scripts/004_smart_money_intelligence_schema.sql` adds:

- `smart_money_actors`;
- `smart_money_events`;
- `smart_money_source_health`;
- `smart_money_wallets`;
- `smart_money_alert_rules`.

Actor, event, and source-health rows are publicly readable and service-role writable. Authenticated users can manage only their own wallet and alert rows under RLS. Guest wallet lists remain in local storage and do not imply server-side monitoring or alert delivery.

## 10. Accuracy, security, and failure behavior

- API credentials remain server-only.
- No production route returns mock or placeholder market data.
- Empty successful payloads are distinct from failed requests.
- All upstream requests have explicit deadlines.
- Direct trading and automatic copy execution are outside scope.
- A settled fill proves that an event occurred; it does not establish identity, intent, complete exposure, or off-platform hedges.
- Public profile labels are attribution evidence, not proof of wallet ownership.
- The interface always retains a concise research-only/not-investment-advice disclosure.

## 11. Verification gate

The shipped implementation is checked with:

- normalization, scoring, consensus, health, and interface-structure tests;
- strict `tsc --noEmit`;
- Next.js production build;
- live discovery, feed, health, OKX, and Binance API smoke tests;
- desktop and 390 px browser checks across all five tabs, filters, evidence links, network behavior, and console output.

The repository currently lacks an installed ESLint executable, so `pnpm lint` remains unavailable independently of this feature. Tests, strict TypeScript, production build, live APIs, and browser QA are the enforced gates.
