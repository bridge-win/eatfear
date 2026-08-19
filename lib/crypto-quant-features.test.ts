import assert from "node:assert/strict"
import test from "node:test"

import { getEnabledCryptoIndicators } from "./crypto-indicator-config.ts"
import {
  computeDerivativeFeatures,
  computeQuantFeatures,
  type QuantCandle,
} from "./crypto-quant-features.ts"

const MINUTE_MS = 60_000

function candle(index: number, volume = 100): QuantCandle {
  const close = 100 + index
  return {
    timestamp: index * MINUTE_MS,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume,
    quoteVolume: volume * close,
  }
}

test("computes btc-qt wick primitives on the selected candle interval", () => {
  const candles = Array.from({ length: 80 }, (_, index) => candle(index, index === 79 ? 1_000 : 100))
  const result = computeQuantFeatures(candles, 1_440)

  assert.equal(result.dev.length, candles.length)
  assert.equal(result.atr60.length, candles.length)
  assert.equal(result.ema60.length, candles.length)
  assert.ok((result.dev.at(-1)?.value ?? 0) > 0)
  assert.ok((result.vel5.at(-1)?.value ?? 0) > 0)
  assert.ok((result.sigma1m.at(-1)?.value ?? 0) > 0)
  assert.ok((result.volumeBurst.at(-1)?.value ?? 0) > 9)
})

test("computes five-minute OI change and liquidation burst percentile", () => {
  const oi = [100, 110, 121].map((value, index) => ({ timestamp: index * 5 * MINUTE_MS, value }))
  const longLiquidations = [10, 20, 100].map((value, index) => ({ timestamp: index * 5 * MINUTE_MS, value }))
  const result = computeDerivativeFeatures({
    funding: [],
    oi,
    longLiquidations,
    shortLiquidations: [],
  })

  assert.ok(Math.abs((result.oiChange5m.at(-1)?.value ?? 0) - 10) < 0.001)
  assert.equal(result.liquidationPercentile.at(-1)?.value, 100)
})

test("orders direct wick decision inputs ahead of display composites", () => {
  const keys = getEnabledCryptoIndicators().slice(0, 10).map((indicator) => indicator.key)

  assert.deepEqual(keys, [
    "dev",
    "atr60",
    "trendRegime",
    "vel5",
    "fundingPct90d",
    "cascadeScore",
    "ema60",
    "liquidationPercentile",
    "oiChange5m",
    "volumeBurst",
  ])
})
