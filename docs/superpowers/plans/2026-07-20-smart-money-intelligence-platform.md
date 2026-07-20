# Smart Money Intelligence Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disconnected and partly mis-normalized smart-money page with an evidence-first command center that unifies real OKX, Binance, Hyperliquid, and Polymarket data, exposes provenance and source health, ranks actors transparently, and delivers a near-real-time activity feed.

**Architecture:** Pure shared normalization and scoring modules define the domain contract. Server-only adapters fetch each upstream with deadlines and return data plus structured source health. Three aggregate route handlers expose discovery, feed/consensus, and source health; focused client components render a persistent tabbed command center while retaining the existing derivatives and wallet analysis modules.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Node 26 test runner, SWR persistent cache, Tailwind CSS 4, Radix Tabs, Supabase SQL migrations.

## Global Constraints

- Percentages are stored as percentage points: `12.5` means `12.5%`.
- Never convert missing numeric values to zero.
- First-party settlement proves an event happened, not the actor’s identity or intent.
- Every response row includes source, event/observation time, freshness, verification class, confidence, limitations, and a verification URL.
- Missing optional API keys produce `not_configured`; no fixtures or estimates appear in production responses.
- One upstream failure cannot fail an aggregate response.
- Preserve the unrelated `.cursor/rules/qveris.mdc` deletion in the main checkout.
- Run `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` before completion; `pnpm lint` is unavailable until the repository installs ESLint.
- Commit and push each independently verified task to `codex/smart-money-platform`; merge and push `main` after final verification.

---

## File map

- `lib/smart-money/types.ts`: public normalized contracts and raw adapter input types.
- `lib/smart-money/normalize.ts`: numeric validation, freshness, deterministic IDs, and source-specific normalization.
- `lib/smart-money/scoring.ts`: actor quality, copyability, and market consensus.
- `lib/smart-money/server.ts`: deadline-aware fetch utility plus OKX, Binance, Hyperliquid, Polymarket, and provider-status adapters.
- `lib/smart-money/normalize.test.ts`: fixture-driven unit/contract tests.
- `lib/smart-money/scoring.test.ts`: deterministic score and consensus tests.
- `app/api/crypto/smart-money/discovery/route.ts`: unified actor leaderboard.
- `app/api/crypto/smart-money/feed/route.ts`: live evidence events and actor-derived consensus.
- `app/api/crypto/smart-money/health/route.ts`: current first-party probes and optional-provider configuration state.
- `components/smart-money-command-center.tsx`: shared feed fetch, tabs, and tab composition.
- `components/smart-money-evidence-tape.tsx`: provenance-coded live hero tape.
- `components/smart-money-live-feed.tsx`: event filters and evidence rows.
- `components/smart-money-discovery.tsx`: unified actor table and score explanations.
- `components/smart-money-source-health.tsx`: source health and methodology.
- `components/smart-money-copy-dashboard.tsx`: header plus command-center integration.
- `components/copy-trading-leaderboard.tsx`: percentage-point formatting and accurate dynamic source attribution.
- `app/api/crypto/smart-money/leaders/route.ts`: corrected Binance response fields and normalized units.
- `lib/i18n.tsx`: bilingual command-center copy.
- `scripts/004_smart_money_intelligence_schema.sql`: idempotent persistence and RLS schema.
- `package.json`: Node test command.

---

### Task 1: Correctness and provenance foundation

**Files:**
- Create: `lib/smart-money/types.ts`
- Create: `lib/smart-money/normalize.ts`
- Create: `lib/smart-money/normalize.test.ts`
- Modify: `package.json`
- Modify: `app/api/crypto/smart-money/leaders/route.ts`
- Modify: `app/api/crypto/smart-money/leader-detail/route.ts`
- Modify: `components/copy-trading-leaderboard.tsx`

**Interfaces:**
- Produces: `SmartMoneyActor`, `SmartMoneyEvent`, `DataProvenance`, `SmartMoneySourceHealth`, `normalizeOkxActor`, `normalizeBinanceActor`, `normalizePolymarketActor`, `normalizeHyperliquidActor`, `freshnessFrom`.
- Percentage fields produced by every normalizer are percentage points.

- [ ] **Step 1: Add the Node test command and failing normalization tests**

```json
"test": "node --test lib/market-manipulation-metrics.test.ts lib/smart-money/*.test.ts"
```

```ts
test("normalizes OKX ratio fields and Binance percentage fields to percentage points", () => {
  assert.equal(normalizeOkxActor(okxFixture, NOW).metrics.roiPct, 33.41)
  assert.equal(normalizeBinanceActor(binanceFixture, NOW).metrics.roiPct, 5301.99005542)
  assert.equal(normalizeBinanceActor(binanceFixture, NOW).metrics.winRatePct, 60)
  assert.equal(normalizeBinanceActor(binanceFixture, NOW).metrics.accountValueUsd, 349040.50145467)
})

test("keeps absent and invalid numeric fields null", () => {
  const actor = normalizeBinanceActor({ leadPortfolioId: "1", roi: "", aum: "NaN" }, NOW)
  assert.equal(actor.metrics.roiPct, null)
  assert.equal(actor.metrics.accountValueUsd, null)
})
```

- [ ] **Step 2: Run the tests and confirm the expected module-not-found failure**

Run: `pnpm test`

Expected: FAIL because `lib/smart-money/normalize.ts` does not exist.

- [ ] **Step 3: Implement normalized contracts and validation**

```ts
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ratioToPercentagePoints(value: unknown): number | null {
  const parsed = toFiniteNumber(value)
  return parsed === null ? null : parsed * 100
}

export function percentagePoints(value: unknown): number | null {
  return toFiniteNumber(value)
}
```

Each source normalizer builds `DataProvenance`, rejects impossible future timestamps, uses the correct source profile URL, and records limitations.

- [ ] **Step 4: Fix the legacy Binance adapter and UI unit handling**

Extend the raw Binance interface with `aum`, `winRate`, `mdd`, `chartItems`, and `startTime`. Normalize Binance `roi`/`winRate` as already-percent values and map `aum`; convert OKX ratio fields to percentage points. Apply the same percentage-point contract to OKX leader detail stats, PnL curves, and position ROE. Update the legacy component so values are formatted exactly once and its tooltip follows the selected source.

- [ ] **Step 5: Run focused tests and strict TypeScript**

Run: `pnpm test && pnpm exec tsc --noEmit`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit and push**

```bash
git add package.json lib/smart-money/types.ts lib/smart-money/normalize.ts lib/smart-money/normalize.test.ts app/api/crypto/smart-money/leaders/route.ts app/api/crypto/smart-money/leader-detail/route.ts components/copy-trading-leaderboard.tsx
git commit -m "fix: normalize smart money evidence accurately"
git push
```

---

### Task 2: Transparent scoring and source adapters

**Files:**
- Create: `lib/smart-money/scoring.ts`
- Create: `lib/smart-money/scoring.test.ts`
- Create: `lib/smart-money/server.ts`
- Create: `app/api/crypto/smart-money/discovery/route.ts`

**Interfaces:**
- Consumes: normalized actors from Task 1.
- Produces: `scoreActorCohort(actors): SmartMoneyActor[]`, `fetchActorSources(): Promise<ActorSourceResult[]>`, and `GET /api/crypto/smart-money/discovery` returning `{ actors, sources, updatedAt }`.

- [ ] **Step 1: Write failing score tests**

```ts
test("scores stronger risk-adjusted evidence above one-off ROI", () => {
  const [consistent, lottery] = scoreActorCohort([consistentFixture, lotteryFixture])
  assert.ok(consistent.quality.score > lottery.quality.score)
  assert.ok(consistent.quality.copyabilityScore > lottery.quality.copyabilityScore)
})

test("never marks low-coverage actors proven", () => {
  const [actor] = scoreActorCohort([minimalFixture])
  assert.equal(actor.quality.confidence, "low")
  assert.equal(actor.quality.category, "unranked")
})
```

- [ ] **Step 2: Run the tests and confirm scoring is missing**

Run: `pnpm test`

Expected: FAIL because `lib/smart-money/scoring.ts` does not exist.

- [ ] **Step 3: Implement deterministic quality and copyability scores**

```ts
const QUALITY_VERSION = "actor-quality-v1"

export function scoreActorCohort(actors: SmartMoneyActor[]): SmartMoneyActor[] {
  const rankedMetrics = buildMetricPercentiles(actors)
  return actors.map((actor) => ({
    ...actor,
    quality: calculateActorQuality(actor, rankedMetrics, QUALITY_VERSION),
  }))
}
```

Use the exact weights and category gates from the design. Renormalize weights over present metrics and include a component list explaining each contribution.

- [ ] **Step 4: Implement deadline-aware adapters**

```ts
export async function fetchJsonWithHealth<T>(input: {
  source: SourceDefinition
  url: string
  init?: RequestInit
  timeoutMs: number
}): Promise<{ data: T | null; health: SmartMoneySourceHealth }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    const response = await fetch(input.url, { ...input.init, signal: controller.signal })
    // Return parsed data and operational/degraded health.
  } finally {
    clearTimeout(timeout)
  }
}
```

Implement OKX and Binance from their current response contracts, Polymarket from `/v1/leaderboard`, and Hyperliquid from the official stats leaderboard. A timed-out Hyperliquid payload marks only that source unavailable.

- [ ] **Step 5: Implement the discovery route**

Fetch all four sources concurrently, score each source cohort, combine and sort by quality, accept `venue`, `sort`, and `limit`, and return HTTP 200 whenever at least one source succeeds. Return HTTP 502 only when all first-party sources fail.

- [ ] **Step 6: Verify tests, TypeScript, and live source shapes**

Run:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm dev
curl -sS 'http://localhost:3111/api/crypto/smart-money/discovery?limit=5' | jq '{actors: [.actors[] | {venue,name,quality,metrics}], sources}'
```

Expected: tests/typecheck pass; response contains real actors and source health with no impossible percentage conversions.

- [ ] **Step 7: Commit and push**

```bash
git add lib/smart-money/scoring.ts lib/smart-money/scoring.test.ts lib/smart-money/server.ts app/api/crypto/smart-money/discovery/route.ts
git commit -m "feat: add evidence-scored smart money discovery"
git push
```

---

### Task 3: Near-real-time evidence feed and consensus

**Files:**
- Modify: `lib/smart-money/types.ts`
- Modify: `lib/smart-money/normalize.ts`
- Modify: `lib/smart-money/scoring.ts`
- Modify: `lib/smart-money/normalize.test.ts`
- Modify: `lib/smart-money/scoring.test.ts`
- Create: `app/api/crypto/smart-money/feed/route.ts`

**Interfaces:**
- Produces: `normalizePolymarketTrade`, `normalizeHyperliquidTrade`, `calculateMarketConsensus` and `GET /api/crypto/smart-money/feed?ccy=BTC&limit=80` returning `{ events, consensus, sources, updatedAt }`.

- [ ] **Step 1: Write failing event and consensus tests**

```ts
test("builds stable event ids and preserves direct verification links", () => {
  const first = normalizePolymarketTrade(polymarketTrade, NOW)
  const second = normalizePolymarketTrade(polymarketTrade, NOW + 1000)
  assert.equal(first.id, second.id)
  assert.match(first.verificationUrl, /^https:\/\/polymarket\.com\//)
})

test("requires actor and venue diversity before directional consensus", () => {
  assert.equal(calculateMarketConsensus(singleVenueEvents).direction, "insufficient")
  assert.equal(calculateMarketConsensus(diverseEvents).direction, "buying")
})
```

- [ ] **Step 2: Run tests and confirm missing event normalizers**

Run: `pnpm test`

Expected: FAIL on missing exports.

- [ ] **Step 3: Implement event normalization and consensus**

Polymarket trades become settled buy/sell events and are qualified against the fetched monthly leaderboard. Hyperliquid `recentTrades` become settled events; unranked counterparties remain `observed-large-trade` with low confidence rather than being called smart.

- [ ] **Step 4: Implement the feed route with partial failure**

Fetch Polymarket leaderboard/trades and Hyperliquid recent trades concurrently. Filter Hyperliquid to the selected currency and material USD size. Sort descending by `eventAt`, deduplicate by event ID, cap the response, and compute consensus only from qualifying actors.

- [ ] **Step 5: Verify feed freshness live**

Run:

```bash
pnpm test
pnpm exec tsc --noEmit
curl -sS 'http://localhost:3111/api/crypto/smart-money/feed?ccy=BTC&limit=20' | jq '{count:(.events|length), newest:.events[0], consensus, sources}'
```

Expected: non-empty first-party events when upstreams are active; all event timestamps are at or before current time and freshness is not fabricated.

- [ ] **Step 6: Commit and push**

```bash
git add lib/smart-money/types.ts lib/smart-money/normalize.ts lib/smart-money/scoring.ts lib/smart-money/normalize.test.ts lib/smart-money/scoring.test.ts app/api/crypto/smart-money/feed/route.ts
git commit -m "feat: stream verifiable smart money evidence"
git push
```

---

### Task 4: Source health and optional-provider readiness

**Files:**
- Modify: `lib/smart-money/server.ts`
- Create: `app/api/crypto/smart-money/health/route.ts`
- Create: `scripts/004_smart_money_intelligence_schema.sql`

**Interfaces:**
- Produces: `probeSmartMoneySources()` and `GET /api/crypto/smart-money/health` returning `{ sources, updatedAt }`.

- [ ] **Step 1: Add source-health behavior tests**

Test the pure health constructor: successful timely data is operational, a schema mismatch is degraded, a timeout is unavailable, and absent paid keys are not configured.

- [ ] **Step 2: Implement small first-party probes and optional configuration states**

Probe OKX time, Binance futures time, Hyperliquid `allMids`, and a one-row Polymarket leaderboard concurrently with four-second deadlines. Report Nansen, Arkham, Cielo, Helius, Alchemy, and Bubblemaps configuration using server-only environment checks.

- [ ] **Step 3: Add idempotent persistence/RLS migration**

Create the five tables from the design with indexes, service-role-only writes for shared actor/event/health rows, and owner-only RLS for wallet and alert rows. Alert fields are `venue`, `address`, `asset`, `action`, `minimum_usd`, `channels`, and `enabled`.

- [ ] **Step 4: Verify route and SQL invariants**

Run:

```bash
pnpm test
pnpm exec tsc --noEmit
curl -sS 'http://localhost:3111/api/crypto/smart-money/health' | jq
rg -n 'ENABLE ROW LEVEL SECURITY|auth.uid\(\) = user_id|CREATE INDEX' scripts/004_smart_money_intelligence_schema.sql
```

- [ ] **Step 5: Commit and push**

```bash
git add lib/smart-money/server.ts app/api/crypto/smart-money/health/route.ts scripts/004_smart_money_intelligence_schema.sql
git commit -m "feat: expose smart money source health"
git push
```

---

### Task 5: Command-center interface

**Files:**
- Create: `components/smart-money-command-center.tsx`
- Create: `components/smart-money-evidence-tape.tsx`
- Create: `components/smart-money-live-feed.tsx`
- Create: `components/smart-money-discovery.tsx`
- Create: `components/smart-money-source-health.tsx`
- Modify: `components/smart-money-copy-dashboard.tsx`
- Modify: `lib/i18n.tsx`

**Interfaces:**
- Consumes: Task 2–4 route contracts.
- Produces: `<SmartMoneyCommandCenter ccy={string} range={TimeRangeId} />`.

- [ ] **Step 1: Add a structural source test**

Use `node:test` and `readFileSync` to require the five tab IDs, a 15-second feed refresh, verification links with `rel="noreferrer"`, source health rendering, and removal of the misleading “cannot be faked” copy.

- [ ] **Step 2: Run tests and confirm the command center is missing**

Run: `pnpm test`

Expected: FAIL because the component files do not exist.

- [ ] **Step 3: Build the shared command center and evidence tape**

The command center fetches the feed once with `refreshInterval: 15_000`, displays global freshness, renders the evidence tape above a horizontally scrollable Radix tab rail, and passes the same payload to Pulse and Live Feed.

- [ ] **Step 4: Build Pulse and Live Feed**

Pulse shows consensus plus the existing intelligence, positioning, flow, and verification components. Live Feed provides venue/action/asset/minimum-value filters, clear partial-source failure messages, and evidence rows with source/age/confidence/direct links.

- [ ] **Step 5: Build Discover, Wallets, and Sources tabs**

Discover renders the unified actor ranking and keeps the existing OKX detail table below it. Wallets retains the Hyperliquid tracker with explicit guest/local monitoring language. Sources renders current health plus scoring weights, configuration limitations, and provider capability descriptions.

- [ ] **Step 6: Integrate the page and bilingual copy**

Replace the long vertical module stack with the command center while preserving the header asset/range controls. Add all required English and Chinese labels to `lib/i18n.tsx`.

- [ ] **Step 7: Run tests, TypeScript, and production build**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 8: Commit and push**

```bash
git add components/smart-money-command-center.tsx components/smart-money-evidence-tape.tsx components/smart-money-live-feed.tsx components/smart-money-discovery.tsx components/smart-money-source-health.tsx components/smart-money-copy-dashboard.tsx lib/i18n.tsx lib/smart-money/ui-structure.test.ts
git commit -m "feat: turn smart money into an evidence command center"
git push
```

---

### Task 6: End-to-end verification, review, and delivery

**Files:**
- Modify only files required by defects found during verification.
- Update: `docs/SMART_MONEY_COPY_TRADING_SPEC.md`

**Interfaces:**
- Verifies the complete user-visible system and documents the final source/freshness behavior.

- [ ] **Step 1: Update the legacy spec to the shipped architecture**

Document the unified sources, percentage-point invariant, health semantics, 15-second feed cadence, optional providers, and verification limits. Remove claims that on-chain identity/intent “cannot be faked.”

- [ ] **Step 2: Run the full automated gate**

Run:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Expected: zero test failures, zero type errors, successful production build, clean diff check.

- [ ] **Step 3: Run live API smoke tests**

Start `pnpm dev` and verify discovery, feed, health, OKX legacy leaders, and Binance legacy leaders. Confirm source health matches actual upstream status, actor metrics are plausible, and no future/stale record is marked live.

- [ ] **Step 4: Verify the browser at desktop and mobile sizes**

Open `/crypto/smart-money`, exercise every tab and filter, verify direct evidence links, inspect console/network errors, and capture screenshots at approximately 1440px and 390px widths. Fix any overflow, inaccessible control, stale copy, or runtime error and rerun the automated gate.

- [ ] **Step 5: Review the final diff against the design**

Check each design requirement against code/runtime evidence. Confirm no mock data, no exposed secrets, no hidden upstream failure, no inconsistent percentage unit, and no unrelated user change staged.

- [ ] **Step 6: Commit, push, merge to main, and verify main**

```bash
git add docs/SMART_MONEY_COPY_TRADING_SPEC.md
git commit -m "docs: document the smart money evidence platform"
git push
```

Then merge `codex/smart-money-platform` into `main` without force, preserve the unrelated `.cursor` deletion, run the full gate on merged `main`, and push `origin main`.
