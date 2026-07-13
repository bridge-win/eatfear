# Crypto Manipulation Observables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ten free/public-data manipulation observables to crypto history and show honest coming-soon previews for unavailable liquidation-wall and cancellation-history feeds.

**Architecture:** A pure TypeScript calculation module derives ten daily series from existing OKX inputs. The history API registers those series through the existing staged-loading configuration, while a client-only dashboard section renders two static unavailable previews without network requests.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, Recharts, Tailwind CSS, SWR/localStorage persistence, Node 26 built-in test runner.

## Global Constraints

- Use only free, public data and require no new API key.
- Never invent liquidation prices, sizes, cancellation values, or historical points.
- Keep completed long/short liquidation history functional.
- Preserve selected-symbol behavior, staged loading, persistence, and partial-source failure handling.
- Derived curves are observables, not proof of manipulation or actor intent.
- Do not stage the pre-existing `.cursor/rules/qveris.mdc` deletion.

---

### Task 1: Pure Manipulation Metrics

**Files:**
- Create: `lib/market-manipulation-metrics.test.ts`
- Create: `lib/market-manipulation-metrics.ts`

**Interfaces:**
- Consumes: `ManipulationMetricInputs`, containing arrays of `{ timestamp: number; value: number }` for price, OI, funding, basis, taker buy/sell/cumulative net, long/short liquidations, upper/lower wick, and volume.
- Produces: `computeMarketManipulationMetrics(inputs): MarketManipulationMetrics`, a record with exactly ten `MetricPoint[]` properties named in the design specification.

- [ ] **Step 1: Write the failing calculation tests**

Create tests using `node:test` and `node:assert/strict`. Use deterministic 35-day fixtures and assert:

```ts
assert.deepEqual(Object.keys(result).sort(), [
  "manipBasisDislocationZ",
  "manipCvdPriceDivergence",
  "manipFundingSqueezeZ",
  "manipLeveragePressure",
  "manipLiquidationImbalancePct",
  "manipLiquidationIntensityZ",
  "manipPriceOiDivergence",
  "manipTakerImbalancePct",
  "manipVolumeImpactZ",
  "manipWickAsymmetryPct",
])
assert.equal(latest(result.manipTakerImbalancePct), 50)
assert.equal(latest(result.manipLiquidationImbalancePct), 0)
assert.equal(latest(result.manipWickAsymmetryPct), 20)
assert.ok(Number.isFinite(latest(result.manipVolumeImpactZ)))
```

Also provide unsorted duplicate timestamps and assert the output is day-sorted with the last value winning.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --experimental-strip-types lib/market-manipulation-metrics.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `market-manipulation-metrics.ts`.

- [ ] **Step 3: Implement the pure module**

Define and export:

```ts
export interface MetricPoint {
  timestamp: number
  value: number
}

export interface ManipulationMetricInputs {
  price: MetricPoint[]
  openInterest: MetricPoint[]
  funding: MetricPoint[]
  basis: MetricPoint[]
  takerBuy: MetricPoint[]
  takerSell: MetricPoint[]
  takerCumulativeNet: MetricPoint[]
  longLiquidations: MetricPoint[]
  shortLiquidations: MetricPoint[]
  upperWick: MetricPoint[]
  lowerWick: MetricPoint[]
  volume: MetricPoint[]
}

export interface MarketManipulationMetrics {
  manipLeveragePressure: MetricPoint[]
  manipPriceOiDivergence: MetricPoint[]
  manipFundingSqueezeZ: MetricPoint[]
  manipBasisDislocationZ: MetricPoint[]
  manipTakerImbalancePct: MetricPoint[]
  manipCvdPriceDivergence: MetricPoint[]
  manipLiquidationImbalancePct: MetricPoint[]
  manipLiquidationIntensityZ: MetricPoint[]
  manipWickAsymmetryPct: MetricPoint[]
  manipVolumeImpactZ: MetricPoint[]
}

export function computeMarketManipulationMetrics(
  inputs: ManipulationMetricInputs,
): MarketManipulationMetrics
```

Normalize to UTC day keys, sort ascending, let the last duplicate win, return only finite values, use a 30-observation population z-score, use seven observations for price/CVD changes, and return zero for zero denominators or zero standard deviation.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test --experimental-strip-types lib/market-manipulation-metrics.test.ts`

Expected: all metric tests pass with zero failures.

### Task 2: History API and Indicator Registry

**Files:**
- Modify: `app/api/crypto/history-compare/route.ts`
- Modify: `lib/crypto-indicator-config.ts`
- Modify: `lib/i18n.tsx`
- Modify: `components/crypto-history-compare.tsx`

**Interfaces:**
- Consumes: `computeMarketManipulationMetrics()` from Task 1 and the route's existing OKX input series.
- Produces: ten normal `SeriesSpec` records through `/api/crypto/history-compare`, with existing `limit`/`offset`, coverage, selected currency, caching, and refresh semantics.

- [ ] **Step 1: Add a failing registry test**

Extend `lib/market-manipulation-metrics.test.ts` to read `lib/crypto-indicator-config.ts` as text and assert all ten keys occur exactly once in config entry declarations and have orders between `360` and `459`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --experimental-strip-types lib/market-manipulation-metrics.test.ts`

Expected: FAIL because the ten config entries do not exist.

- [ ] **Step 3: Register source dependencies and outputs**

Import the calculation module into the history route. Add manipulation keys to the relevant source dependency arrays so staged requests fetch only necessary inputs. Compute once:

```ts
const manipulationMetrics = computeMarketManipulationMetrics({
  price: btcPrice,
  openInterest: oi,
  funding,
  basis,
  takerBuy: taker.buy,
  takerSell: taker.sell,
  takerCumulativeNet: taker.cumulativeNet,
  longLiquidations: liq.long,
  shortLiquidations: liq.short,
  upperWick: btcUpperWick,
  lowerWick: btcLowerWick,
  volume: btcVolumeUsd,
})
```

Spread the ten named arrays into `rawSeriesByKey`. Do not forward-fill missing inputs and retain current coverage filtering.

- [ ] **Step 4: Register ten indicator configs and localized metadata**

Add ten enabled entries with `refreshMs: 300_000`, `source: "OKX / computed observable"`, selected-instrument label variables, explicit colors, `pct` for percentage metrics and `raw` for z-score/composite metrics. Add English and Chinese labels plus info text stating that each metric is an observable requiring confirmation and does not prove manipulation.

Update the History Compare source summary to include `OKX computed manipulation observables`.

- [ ] **Step 5: Run tests and strict TypeScript**

Run:

```bash
node --test --experimental-strip-types lib/market-manipulation-metrics.test.ts
pnpm exec tsc --noEmit
```

Expected: zero test failures and TypeScript exit code 0.

### Task 3: Unavailable Market-Data Previews

**Files:**
- Create: `components/market-manipulation-monitor.tsx`
- Modify: `components/crypto-dashboard.tsx`
- Modify: `lib/i18n.tsx`

**Interfaces:**
- Consumes: selected instrument currency for the liquidation preview title and `useT()` for locale text.
- Produces: `MarketManipulationMonitor({ currency, className? })`, rendering two non-interactive cards without data fetching.

- [ ] **Step 1: Implement the static unavailable monitor**

Create a named component with two cards. The liquidation card uses three neutral summary tiles and a centered mirrored bar silhouette matching `OptionsMaxPainCard`. The cancellation card uses a muted SVG curve silhouette. Both include visible `Unavailable` and `Coming soon` badges, explanatory copy, and the public-data source line. Add `aria-disabled="true"`; do not render buttons, links, tooltips with fake numbers, or Recharts axes with synthetic values.

- [ ] **Step 2: Mount it in the dashboard**

Render directly after `OptionsMaxPainCard` and before `OpportunityRadar`:

```tsx
{canHydrateDashboard && (
  <MarketManipulationMonitor currency={instId.split("-")[0] ?? "BTC"} />
)}
```

- [ ] **Step 3: Run strict TypeScript**

Run: `pnpm exec tsc --noEmit`

Expected: exit code 0.

### Task 4: Runtime Verification, Review, Commit, and Push

**Files:**
- Review all files changed by Tasks 1–3.

**Interfaces:**
- Consumes: completed feature and repository verification commands.
- Produces: reviewed commit on `main`, pushed to `origin/main` without the unrelated deletion.

- [ ] **Step 1: Run the complete verification suite**

Run:

```bash
node --test --experimental-strip-types lib/market-manipulation-metrics.test.ts
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Expected: tests pass, TypeScript passes, production build succeeds, and diff check reports no whitespace errors.

- [ ] **Step 2: Probe API coverage and browser UI**

Start `pnpm dev` on port `3111`. Probe `/api/crypto/history-compare?ccy=BTC&range=3m`, `1y`, `5y`, `10y`, and `max`; confirm no single-page truncation and honest omission outside upstream coverage. Open `/crypto`; confirm both coming-soon previews, the unchanged BTC Options OI Wall, new manipulation labels/data, and no browser console errors.

- [ ] **Step 3: Review the final diff**

Check strict typing, finite-value handling, source-key dependency coverage, i18n completeness, accessibility, no invented values, no unused imports, and no staged secrets or `.env` files. Confirm `.cursor/rules/qveris.mdc` remains unstaged.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add app/api/crypto/history-compare/route.ts components/crypto-dashboard.tsx components/crypto-history-compare.tsx components/market-manipulation-monitor.tsx lib/crypto-indicator-config.ts lib/i18n.tsx lib/market-manipulation-metrics.ts lib/market-manipulation-metrics.test.ts docs/superpowers/plans/2026-07-13-crypto-manipulation-observables.md
git commit -m "feat: add crypto manipulation observables"
git push origin main
```

Expected: commit succeeds on `main`; push updates `origin/main`; `.cursor/rules/qveris.mdc` remains unstaged.
