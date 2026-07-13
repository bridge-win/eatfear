import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  computeMarketManipulationMetrics,
  type ManipulationMetricInputs,
  type MetricPoint,
} from "./market-manipulation-metrics.ts"

const DAY_MS = 86_400_000
const MANIPULATION_KEYS = [
  "manipLeveragePressure",
  "manipPriceOiDivergence",
  "manipFundingSqueezeZ",
  "manipBasisDislocationZ",
  "manipTakerImbalancePct",
  "manipCvdPriceDivergence",
  "manipLiquidationImbalancePct",
  "manipLiquidationIntensityZ",
  "manipWickAsymmetryPct",
  "manipVolumeImpactZ",
] as const

function series(values: number[]): MetricPoint[] {
  return values.map((value, index) => ({ timestamp: index * DAY_MS, value }))
}

function fixture(overrides: Partial<ManipulationMetricInputs> = {}): ManipulationMetricInputs {
  const index = Array.from({ length: 35 }, (_, item) => item)
  return {
    price: series(index.map((item) => 100 + item + (item === 34 ? 10 : 0))),
    openInterest: series(index.map((item) => 1_000 + item * 10 + (item === 34 ? 300 : 0))),
    funding: series(index.map((item) => item / 10_000)),
    basis: series(index.map((item) => item / 100)),
    takerBuy: series(index.map(() => 75)),
    takerSell: series(index.map(() => 25)),
    takerCumulativeNet: series(index.map((item) => item * 50)),
    longLiquidations: series(index.map(() => 100)),
    shortLiquidations: series(index.map(() => 100)),
    upperWick: series(index.map(() => 30)),
    lowerWick: series(index.map(() => 10)),
    volume: series(index.map((item) => (item === 34 ? 0 : 1_000 + item))),
    ...overrides,
  }
}

function latest(points: MetricPoint[]): number {
  const point = points.at(-1)
  assert.ok(point)
  return point.value
}

test("returns exactly the ten manipulation metric series", () => {
  const result = computeMarketManipulationMetrics(fixture())

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
})

test("computes signed leverage and price-open-interest pressure", () => {
  const result = computeMarketManipulationMetrics(fixture())

  assert.ok(latest(result.manipLeveragePressure) > 0)
  assert.ok(latest(result.manipPriceOiDivergence) < 0)
})

test("computes taker, liquidation, and wick imbalance with zero-safe ratios", () => {
  const result = computeMarketManipulationMetrics(fixture())
  const zeroResult = computeMarketManipulationMetrics(fixture({
    takerBuy: series([0]),
    takerSell: series([0]),
    longLiquidations: series([0]),
    shortLiquidations: series([0]),
  }))

  assert.equal(latest(result.manipTakerImbalancePct), 50)
  assert.equal(latest(result.manipLiquidationImbalancePct), 0)
  assert.equal(latest(result.manipWickAsymmetryPct), 20)
  assert.equal(latest(zeroResult.manipTakerImbalancePct), 0)
  assert.equal(latest(zeroResult.manipLiquidationImbalancePct), 0)
})

test("keeps rolling anomaly outputs finite for constant and zero-volume inputs", () => {
  const constant = series(Array.from({ length: 35 }, () => 1))
  const result = computeMarketManipulationMetrics(fixture({
    funding: constant,
    basis: constant,
    volume: series(Array.from({ length: 35 }, () => 0)),
  }))

  assert.equal(latest(result.manipFundingSqueezeZ), 0)
  assert.equal(latest(result.manipBasisDislocationZ), 0)
  assert.ok(Number.isFinite(latest(result.manipVolumeImpactZ)))
})

test("reports positive price divergence when price outruns cumulative taker flow", () => {
  const flatFlow = series(Array.from({ length: 35 }, () => 100))
  const result = computeMarketManipulationMetrics(fixture({ takerCumulativeNet: flatFlow }))

  assert.ok(latest(result.manipCvdPriceDivergence) > 0)
})

test("sorts days and lets the last duplicate value win", () => {
  const result = computeMarketManipulationMetrics(fixture({
    upperWick: [
      { timestamp: 2 * DAY_MS, value: 10 },
      { timestamp: 0, value: 5 },
      { timestamp: 2 * DAY_MS, value: 40 },
      { timestamp: DAY_MS, value: 20 },
    ],
    lowerWick: [
      { timestamp: DAY_MS, value: 2 },
      { timestamp: 2 * DAY_MS, value: 4 },
      { timestamp: 0, value: 1 },
    ],
  }))

  assert.deepEqual(result.manipWickAsymmetryPct, [
    { timestamp: 0, value: 4 },
    { timestamp: DAY_MS, value: 18 },
    { timestamp: 2 * DAY_MS, value: 36 },
  ])
})

test("registers each manipulation curve once in the history indicator config", () => {
  const source = readFileSync(new URL("./crypto-indicator-config.ts", import.meta.url), "utf8")

  for (const key of MANIPULATION_KEYS) {
    const entries = Array.from(source.matchAll(new RegExp(`\\{ key: "${key}", enabled: true, order: (\\d+)`, "g")))
    assert.equal(entries.length, 1, `${key} must have one enabled config entry`)
    const order = Number(entries[0]?.[1])
    assert.ok(order >= 360 && order <= 459, `${key} order must remain in the manipulation section`)
  }
})

test("requires full selected-range coverage for every manipulation curve", () => {
  const source = readFileSync(
    new URL("../app/api/crypto/history-compare/route.ts", import.meta.url),
    "utf8",
  )
  const strictCoverageSet = source.match(
    /const STRICT_RANGE_COVERAGE_KEYS = new Set<string>\(\[([\s\S]*?)\]\)/,
  )

  assert.ok(strictCoverageSet)
  assert.match(strictCoverageSet[1], /\.\.\.MANIPULATION_KEYS/)
  for (const key of MANIPULATION_KEYS) {
    assert.match(source, new RegExp(`const MANIPULATION_KEYS[\\s\\S]*?"${key}"`))
  }
})

test("keeps unavailable market-data previews static and explicitly disabled", () => {
  const source = readFileSync(
    new URL("../components/market-manipulation-monitor.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /aria-disabled="true"/)
  assert.match(source, /manipMonitor\.liquidation\.title/)
  assert.match(source, /manipMonitor\.cancellation\.title/)
  assert.doesNotMatch(source, /fetch\(|usePersistentSWR|jsonFetcher|Math\.random/)
})
