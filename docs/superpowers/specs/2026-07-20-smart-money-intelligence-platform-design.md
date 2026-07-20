# Smart Money Intelligence Platform Design

**Date:** 2026-07-20
**Status:** Approved for autonomous execution
**Route:** `/crypto/smart-money`
**Scope:** Crypto-first, cross-asset-ready data contracts

## 1. Product thesis

The page must answer three questions quickly:

1. What are demonstrably successful or institutionally relevant actors doing now?
2. How reliable, fresh, and independently verifiable is each observation?
3. Is the activity actionable after drawdown, liquidity, crowding, and copy-lag are considered?

The product will not call an account “smart” solely because it is large, visible, or profitable over one short window. “Smart money” is a versioned evidence classification derived from realized performance, consistency, risk, activity, capital at risk, and data completeness. Identity attribution remains separate from behavioral quality.

## 2. Competitive research translated into product requirements

| Product pattern | Representative products | Capability adopted | Data acquisition rule |
| --- | --- | --- | --- |
| Labeled entities and fund flows | Arkham, Nansen | Human-readable actors, holdings, transfers, net flows, confidence | Licensed API only; labels always name their provider |
| Smart-wallet discovery | Nansen, GMGN, Cielo | Rank profitable wallets by risk-adjusted and copyability-aware performance | First-party venue leaderboards plus licensed enrichment |
| Real-time wallet feed and alerts | Cielo, GMGN, Arkham | Filterable event tape, saved actors, large-action alerts | Public WebSocket/REST or signed provider webhook; no HTML scraping |
| Holder concentration and clusters | Bubblemaps | Concentration/cluster context and investigation link | Licensed iframe/API; do not reverse-engineer private data |
| Trader and position analytics | Hyperliquid dashboards, CEX copy trading | Open positions, account value, PnL windows, drawdown, leverage | First-party venue APIs; normalize units per source |
| Prediction-market intelligence | Polymarket, Arkham | Leaderboards, positions, trades, conviction by market | Polymarket public Data API and CLOB market data |
| Derivatives positioning | CoinGlass-style surfaces, exchanges | Top-vs-crowd ratios, taker flow, funding, open interest | Binance and OKX official/public market endpoints |

The product differentiates itself by combining these workflows in one evidence model instead of presenting disconnected cards.

## 3. Selected approach

Use a hybrid evidence graph:

- First-party exchange, protocol, and chain records are authoritative for fills, positions, balances, and timestamps.
- Optional paid providers enrich attribution, historical wallet PnL, and cross-chain coverage.
- Missing paid keys reduce coverage but never replace missing data with estimates or fixtures.
- Every normalized record carries provenance and freshness metadata.
- Every score is deterministic, versioned, decomposable, and visibly labeled as derived.

## 4. Truth and provenance contract

Every response surface uses a shared `DataProvenance` contract:

```ts
interface DataProvenance {
  sourceId: string
  sourceName: string
  sourceType: "first_party" | "licensed" | "derived"
  sourceUrl: string
  eventAt: number | null
  observedAt: number
  freshness: "live" | "fresh" | "delayed" | "stale" | "unavailable"
  freshnessMs: number | null
  verification: "settled" | "reported" | "attributed" | "inferred"
  confidence: number
  limitations: string[]
}
```

Rules:

- `settled` means a first-party venue fill/position or an on-chain record, not that the actor’s intent or identity is proven.
- `attributed` means an external provider associated an address with an entity; the provider and confidence must remain visible.
- `inferred` covers composite signals and scores. It must never be styled as a verified fact.
- Freshness is computed from `eventAt` when available and otherwise from `observedAt`.
- UI timestamps display the event age and data receipt age when they differ materially.
- Upstream failures return structured source health and partial data, not silent empty arrays presented as “no activity.”

## 5. Normalized domain model

### 5.1 Actors and performance

```ts
type SmartMoneyVenue = "okx" | "binance" | "hyperliquid" | "polymarket" | "nansen" | "arkham" | "cielo"

interface SmartMoneyActor {
  id: string
  venue: SmartMoneyVenue
  name: string
  address: string | null
  avatarUrl: string | null
  profileUrl: string
  categories: string[]
  metrics: {
    pnlUsd: number | null
    roiPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    accountValueUsd: number | null
    volumeUsd: number | null
    followers: number | null
    activeDays: number | null
  }
  quality: SmartMoneyQuality
  provenance: DataProvenance
}
```

Percentages are stored as percentage points everywhere: `12.5` means `12.5%`. Source adapters are solely responsible for converting ratios such as OKX `0.125` and already-percent values such as Binance `12.5`.

### 5.2 Events

```ts
type SmartMoneyAction = "buy" | "sell" | "long" | "short" | "close" | "transfer" | "deposit" | "withdraw"

interface SmartMoneyEvent {
  id: string
  actorId: string
  actorName: string
  address: string | null
  venue: SmartMoneyVenue
  action: SmartMoneyAction
  asset: string
  market: string
  amountUsd: number | null
  priceUsd: number | null
  pnlUsd: number | null
  transactionId: string | null
  verificationUrl: string
  provenance: DataProvenance
}
```

Event identity is deterministic: `sourceId + transactionId/fillId + actorId + action`. Duplicate webhook deliveries are idempotent.

### 5.3 Source health

```ts
interface SmartMoneySourceHealth {
  sourceId: string
  name: string
  status: "operational" | "degraded" | "unavailable" | "not_configured"
  latencyMs: number | null
  lastSuccessAt: number | null
  message: string
  sourceUrl: string
}
```

## 6. Source adapters

### 6.1 Available without new credentials

- OKX copy trading: leaderboard, statistics, PnL curve, current public lead positions.
- Binance copy trading: public web endpoint used by Binance’s frontend, explicitly marked `reported` and `degraded` if its undocumented contract changes.
- Hyperliquid: official stats leaderboard plus `/info` positions, portfolio, fills, and public WebSocket feeds.
- Polymarket: public leaderboard, positions, activity, trades, and market links.
- Binance/OKX derivatives: positioning, taker flow, funding, open interest, margin loan, and options ratios.

### 6.2 Optional licensed enrichment

- `NANSEN_API_KEY`: Smart Money net flows, DEX trades, holdings, historical holdings, Hyperliquid perps.
- `ARKHAM_API_KEY`: entity/address labels, transfers, swaps, portfolios, counterparties, and token flows.
- `CIELO_API_KEY`: wallet feed, PnL, trading stats, related wallets, and tags.
- `HELIUS_API_KEY`: real-time Solana enhanced transactions and webhook ingestion.
- `ALCHEMY_API_KEY`: EVM/Solana address activity and historical transfers.
- `BUBBLEMAPS_API_KEY`: holder clusters; without a key the UI provides a clearly labeled investigation link only.

API keys remain server-only. Optional adapters return `not_configured`, never mock data.

## 7. Scoring

### 7.1 Actor quality score v1

`qualityScore` ranges from 0 to 100 and is calculated only from available metrics:

- 25% realized or venue-settled PnL percentile.
- 20% ROI percentile after source-unit normalization.
- 15% win-rate percentile.
- 15% drawdown protection.
- 10% account age/activity duration.
- 10% capital-at-risk/account value.
- 5% data completeness.

The weight denominator is renormalized over present inputs. A score with less than 50% metric coverage is `low` confidence and cannot receive the “proven” category. Category thresholds:

- `90–100`: elite
- `75–89`: proven
- `60–74`: watch
- below `60`: unranked

The score is descriptive, not a recommendation.

### 7.2 Copyability score v1

Copyability starts at 100 and subtracts penalties for:

- drawdown above 20%;
- account age below 30 days;
- missing current positions or trade timestamps;
- returns dominated by a very short visible history;
- follower capacity already full;
- extremely high reported ROI without matching account value/history;
- unavailable liquidity/slippage evidence.

### 7.3 Market consensus

The pulse aggregates unique qualifying actors, not event count. It reports:

- qualifying buyers vs sellers;
- buy/sell USD where available;
- top assets by net actor count;
- venue diversity;
- time-decayed confidence;
- explicit coverage percentage.

No bullish/bearish label is produced when fewer than two independent sources or three qualifying actors contribute.

## 8. Product surfaces

The current long vertical page becomes a command center with persistent tabs.

### 8.1 Pulse

- Evidence tape hero: latest qualifying activity with live age, venue color, verification state, and direct source link.
- Market consensus strip: net actor direction, capital, source diversity, and coverage.
- Existing multi-factor derivatives intelligence, positioning, flow, and verification modules remain available below the actor-derived pulse.
- Wording changes from “authentic/cannot be faked” to “observable/settled; identity and intent may remain uncertain.”

### 8.2 Live feed

- Unified Hyperliquid and Polymarket activity plus optional Nansen/Arkham/Cielo events.
- Filters for venue, action, asset, minimum USD amount, verification type, and freshness.
- Auto-refresh every 15 seconds for first-party polling feeds; source health shows their upstream cadence.
- Every row has actor, action, amount, asset/market, event age, source, confidence, and verification link.

### 8.3 Discover

- One normalized leaderboard across OKX, Binance, Hyperliquid, and Polymarket.
- Filters for venue and minimum confidence.
- Sort by quality, PnL, ROI, drawdown, account value, or copyability.
- Source metrics retain their original time window in the detail panel.
- Actor drill-down shows performance evidence, open positions or active markets, limitations, and source link.

### 8.4 Tracked wallets

- Users can save Hyperliquid, Polymarket, EVM, or Solana addresses with a label.
- Guest state persists locally; authenticated Supabase persistence is supported by the schema.
- Profile inspection exposes holdings/positions/activity only from configured sources.
- Alert configuration stores asset, action, minimum value, and delivery channel.

### 8.5 Data sources

- Health table for every adapter: operational state, latency, last success, cadence, verification level, and limitations.
- “Not configured” sources explain which capability they unlock without exposing key names or secrets to the browser.
- Methodology displays score version, weights, and missing-input handling.

## 9. Information design

### Visual system

- Preserve the site’s neutral theme and existing Geist typography.
- Add restrained venue colors only as semantic identifiers: Hyperliquid `#5CE1B9`, Polymarket `#2563EB`, OKX `#111827`, Binance `#F0B90B`, licensed enrichment `#8B5CF6`.
- Use tabular numerals for all market data and a compact utility scale for provenance.
- Avoid decorative gradients and oversized marketing metrics.

### Signature element

The evidence tape is a horizontally scan-friendly stream modeled on a market terminal tape, but each observation has a second provenance line. This makes verification—not visual decoration—the memorable product behavior.

### Layout

```text
┌ title / asset / range / global freshness ───────────────────────┐
├ evidence tape: actor · action · amount · market · age · source ┤
├ Pulse | Live feed | Discover | Wallets | Sources                ┤
├ active tab content                                                ┤
└ methodology / risk disclosure                                     ┘
```

Mobile uses a horizontally scrollable tab rail and stacked feed rows. Filters collapse into a sheet. Keyboard focus is visible and reduced-motion preference disables tape animation.

## 10. Data flow and deployment

```text
First-party REST ─┐
First-party WS ───┼─ adapters ─ normalization ─ scoring ─ API snapshot ─ UI
Provider webhook ─┤                    │
Licensed REST ────┘                    ├─ source health
                                      └─ optional Supabase history/alerts
```

The current Vercel deployment serves snapshot endpoints and webhook receivers. Low-latency UI uses 15-second refresh for public sources in this implementation. Provider webhooks are the production real-time path for Helius/Alchemy. A long-lived WebSocket collector is packaged as a separate future deployment unit only when continuous multi-wallet Hyperliquid ingestion exceeds serverless polling capacity; the UI and normalized contracts do not change.

## 11. Persistence schema

Add idempotent SQL migrations for:

- `smart_money_actors`
- `smart_money_events`
- `smart_money_wallets`
- `smart_money_alert_rules`
- `smart_money_source_health`

RLS permits authenticated users to manage their own tracked wallets and alert rules. Public actor/event rows are read-only to authenticated/anonymous clients and written only by the service role. Guest watchlists remain local and never imply server-side monitoring.

## 12. Failure behavior

- Adapter requests use explicit deadlines.
- One source failure cannot fail the aggregate response.
- Empty successful data and upstream failure are distinct states.
- Stale cached data may render only with its age and stale badge.
- Invalid numeric fields remain `null`; they never coerce to zero.
- Impossible percentages, negative account values, or future timestamps add quality flags and are excluded from scores.
- Upstream schema drift fails its contract test and marks the source degraded.

## 13. Security and compliance

- No API keys or provider responses containing secrets enter client bundles.
- Webhook receivers verify provider signatures when configured.
- Addresses are public identifiers but user labels/lists remain private under RLS.
- Direct trading and automatic copy execution are outside scope; the product provides observation, simulation context, and external links.
- Every screen retains a concise “not investment advice” disclosure.

## 14. Testing and verification

- Node test runner exercises unit conversion, validation, scoring, confidence, freshness, and deterministic identifiers.
- Recorded contract fixtures cover OKX, Binance, Hyperliquid, and Polymarket response normalization.
- Route-level tests cover partial failure and source-health semantics.
- TypeScript strict check must pass independently because Next currently ignores build type errors.
- Production build must pass.
- Live smoke tests must read non-empty OKX, Binance, and Polymarket data and verify timestamps are plausible.
- Browser verification covers desktop and mobile layouts, tab navigation, filters, empty states, stale badges, source links, and no console errors.

## 15. Delivery sequence

1. Correctness foundation and tests.
2. Unified public-source discovery and health APIs.
3. Live evidence feed and market consensus.
4. Command-center tabs and evidence-tape UI.
5. Wallet tracking, optional enrichment adapters, and persistence schema.
6. End-to-end verification, review, merge, and production push.

Each step must leave the existing derivatives intelligence usable while moving the page toward the unified product.
