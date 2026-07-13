# Crypto Manipulation Observables Design

## Objective

Extend the crypto dashboard with manipulation-focused market structure analysis while using only free, public data. Add ten functional historical curves derived from OKX market history. Show price-level liquidation walls and order-book cancellation-rate history as unavailable previews with a clear "Coming soon" state because public exchange APIs do not provide reliable backfill for either dataset.

## Product Boundaries

- Do not present inferred pending liquidation levels as observed positions.
- Do not fabricate cancellation history from sparse REST snapshots.
- Do not add a paid provider or require a new API key.
- Keep the existing aggregate daily long and short liquidation series functional.
- Preserve staged history loading, persistent local caching, selected-symbol behavior, and graceful source failure.
- The unavailable previews are informational UI, not disabled controls that appear actionable.

## Dashboard Surface

Add a `MarketManipulationMonitor` below the existing BTC/ETH Options OI Wall and above Opportunity Radar.

The monitor contains two cards:

1. **Liquidation Price Walls**
   - Mirrors the visual grammar of `OptionsMaxPainCard`: summary tiles above a centered positive/negative bar profile.
   - Uses neutral skeleton bars as a static preview; it must not display invented price or notional values.
   - Shows `Unavailable` and `Coming soon` badges.
   - Explains that the existing long/short curves show completed liquidation volume, while a true pending liquidation wall requires position and leverage-distribution data that public APIs do not expose.

2. **Order Cancellation Rate History**
   - Shows a static disabled historical-curve preview with no numeric axis labels or synthetic points.
   - Shows `Unavailable` and `Coming soon` badges.
   - Explains that public depth streams expose book updates but do not distinguish fills from cancellations with complete historical backfill.

Both cards support the app's English and Chinese locale modes. Their source line is `Public exchange APIs · unavailable without a collected or licensed feed`.

## Functional Historical Curves

Add the following ten series to `CRYPTO_INDICATOR_CONFIG` immediately after the existing raw derivatives and smart-money series. Each is computed from public OKX daily data and uses the selected crypto instrument.

1. `manipLeveragePressure`
   - Name: Leverage Build-up Pressure.
   - Formula: `returnZ * max(oiChangeZ, 0)`.
   - Interpretation: signed price pressure reinforced by unusually fast OI growth.

2. `manipPriceOiDivergence`
   - Name: Price–OI Divergence.
   - Formula: `returnZ * -oiChangeZ`.
   - Interpretation: a large absolute value flags price and leveraged-position changes moving against one another; sign follows price direction.

3. `manipFundingSqueezeZ`
   - Name: Funding Squeeze Anomaly.
   - Formula: 30-observation rolling z-score of daily funding.
   - Interpretation: positive extremes indicate expensive longs; negative extremes indicate expensive shorts.

4. `manipBasisDislocationZ`
   - Name: Perpetual Basis Dislocation.
   - Formula: 30-observation rolling z-score of perpetual-versus-spot basis.
   - Interpretation: signed abnormal premium or discount.

5. `manipTakerImbalancePct`
   - Name: Taker-flow Imbalance.
   - Formula: `(buyVolume - sellVolume) / (buyVolume + sellVolume) * 100`, returning zero when the denominator is zero.
   - Interpretation: positive means aggressive buying; negative means aggressive selling.

6. `manipCvdPriceDivergence`
   - Name: CVD–Price Divergence.
   - Formula: 30-observation rolling z-score of seven-day price return minus the rolling z-score of the seven-day change in cumulative taker net flow.
   - Interpretation: price strength unsupported by taker flow is positive; price weakness unsupported by selling is negative.

7. `manipLiquidationImbalancePct`
   - Name: Liquidation-side Imbalance.
   - Formula: `(longLiquidationUsd - shortLiquidationUsd) / totalLiquidationUsd * 100`, returning zero when total liquidation is zero.
   - Interpretation: positive means long liquidations dominated; negative means short liquidations dominated.

8. `manipLiquidationIntensityZ`
   - Name: Liquidation Intensity Anomaly.
   - Formula: 30-observation rolling z-score of total daily liquidation notional.
   - Interpretation: large positive values identify unusually concentrated forced deleveraging.

9. `manipWickAsymmetryPct`
   - Name: Wick Rejection Asymmetry.
   - Formula: `upperWickPct - lowerWickPct`.
   - Interpretation: positive indicates stronger rejection above; negative indicates stronger rejection below.

10. `manipVolumeImpactZ`
    - Name: Volume-to-Price Impact Anomaly.
    - Formula: calculate `abs(dailyReturnPct) / max(dailyVolume / rolling30VolumeMean, 0.05)`, then take its 30-observation rolling z-score.
    - Interpretation: positive extremes flag unusually large movement relative to normalized turnover.

These metrics are observables, not proof of manipulation. Every info popover must state that they require confirmation across multiple signals and do not identify an actor or intent.

## Architecture

Create `lib/market-manipulation-metrics.ts` as a pure calculation module. It accepts timestamped price, OI, funding, basis, taker buy/sell/cumulative flow, long/short liquidation, upper/lower wick, and volume series. It returns a typed record containing the ten output series. The module owns day alignment, zero-denominator behavior, rolling statistics, and finite-value filtering so the API route remains orchestration-focused.

Update `app/api/crypto/history-compare/route.ts` to:

- recognize each manipulation key in the existing source-dependency key groups;
- request only the upstream inputs needed by the selected staged slice;
- compute the manipulation bundle once per request;
- register all ten outputs in `rawSeriesByKey`;
- retain the current coverage checks, daily timeline alignment, selected-symbol label variables, refresh interval, and response format.

Update `lib/crypto-indicator-config.ts` with the ten enabled series, explicit order, source, color, unit, refresh interval, and relevance score. Put the ten entries together so they appear as a coherent section in realtime cards and History Compare.

Add localized labels, explanations, badges, and preview copy to `lib/i18n.tsx`. Update the History Compare source summary to include `OKX computed manipulation observables`.

## Data Availability and Failure Behavior

- A derived series is omitted when its required public source does not have usable coverage for the selected range, matching current History Compare behavior.
- Metrics requiring liquidation data inherit OKX's approximately 90-day public liquidation-history boundary; they must not be forward-filled into older ranges.
- Metrics requiring OI inherit the instrument-history boundary already enforced by the route.
- Partial upstream failure must not suppress unrelated curves or the rest of the dashboard.
- The two unavailable preview cards always render their explanatory state and never issue network requests.

## Testing and Verification

Use Node's built-in TypeScript test support and `node:test` for the pure calculation module.

Tests cover:

- signed leverage pressure and price–OI divergence;
- rolling z-score behavior with a zero-variance window;
- zero-denominator taker and liquidation ratios;
- CVD–price divergence direction;
- wick asymmetry direction;
- volume-impact anomaly finite output when volume is zero or very small;
- sorted, deduplicated day alignment;
- exactly ten returned metric keys.

Browser verification is the source of truth for the unavailable cards' visual state. Final verification must include:

- `node --test --experimental-strip-types lib/market-manipulation-metrics.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `git diff --check`
- browser checks on `/crypto` confirming both unavailable previews, ten new labels in History Compare/realtime data, no console errors, and unchanged BTC Options OI Wall behavior.

For API coverage, probe `3m`, `1y`, `5y`, `10y`, and `max`. A metric may be absent before its upstream source began, but no result may be silently capped by a single-page external API limit.
