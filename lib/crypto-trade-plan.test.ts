import test from "node:test"
import assert from "node:assert/strict"
import { alignPastOnly } from "./causal-series.ts"
import { buildPlanFeatures, cleanTradeBars, HORIZONS, planDecision, type TradeBar } from "./crypto-trade-plan.ts"
import { computeRegimeScore, type RawRegimeMetrics } from "./crypto-regime-score.ts"
import { runPlanBacktest } from "./crypto-plan-backtest.ts"

function candles(n = 360): TradeBar[] {
  let price = 100
  return Array.from({ length: n }, (_, i) => {
    const open = price; price *= 1 + Math.sin(i / 8) * 0.006 + 0.001
    return { time: i * 3_600_000, open, close: price, high: Math.max(open, price) + 0.2, low: Math.min(open, price) - 0.2, volume: 100, quoteVolume: 100 * (open + price) / 2, takerBuyQuote: 60 * (open + price) / 2 }
  })
}

test("alignment never borrows future data and expires old observations", () => {
  assert.deepEqual(alignPastOnly([{ timestamp: 12, value: 7 }], [10, 12, 15, 18], 4), [null, 7, 7, null])
})
test("rejects unclosed candles, invalid OHLC and deduplicates", () => {
  const b = candles(3)
  assert.equal(cleanTradeBars([...b, b[0], { ...b[1], high: 0 }], 3_600_000, b[2].time + 1).length, 2)
})
test("future prices and flows cannot change earlier decisions", () => {
  const b = candles()
  const before = buildPlanFeatures(b, "2d")
  const altered = buildPlanFeatures(b.map((c, i) => i < 300 ? c : { ...c, close: c.close * 2, takerBuyQuote: 0 }), "2d")
  assert.deepEqual(before.slice(0, 300), altered.slice(0, 300))
})
test("missing aggressor volume reduces coverage and blocks hourly entries", () => {
  const f = buildPlanFeatures(candles().map((c) => ({ ...c, takerBuyQuote: null })), "2d").at(-1)!
  assert.equal(f.flow, null); assert.equal(f.coverage, 60)
  assert.equal(planDecision(f, "2d", f.time + 3_600_000).action, "wait")
})
test("CVD retains sell direction; flat-market RSI is neutral", () => {
  const b = candles().map((c) => ({ ...c, open: 100, high: 101, low: 99, close: 100, quoteVolume: 10000, takerBuyQuote: 2000 }))
  const f = buildPlanFeatures(b, "2d").at(-1)!
  assert.equal(f.rsi, 50); assert.ok(f.cvd! < 0); assert.ok(f.flow! < 0)
  assert.equal(f.bullishDivergence, false)
})
test("stale data or gaps veto decisions", () => {
  const b = candles(); b[300].time += 1000
  const f = buildPlanFeatures(b, "2d").at(-1)!
  assert.equal(planDecision(f, "2d", f.time + HORIZONS["2d"].stepMs).action, "wait")
  assert.equal(planDecision({ ...f, continuous: true }, "2d", f.time + 10 * HORIZONS["2d"].stepMs).action, "wait")
})
test("execution uses next open, cost stress lowers unchanged trade outcomes", () => {
  const b = candles(600)
  const base = runPlanBacktest(b, "2d", { startIndex: 220, baseline: "ema" })
  const stress = runPlanBacktest(b, "2d", { startIndex: 220, baseline: "ema", costMultiplier: 2 })
  assert.ok(base.trades > 0)
  assert.ok(base.ledger.every((t) => t.entryTime >= b[220].time))
  assert.ok(base.fees > 0); assert.ok(stress.netReturn < base.netReturn)
  assert.ok(base.equity.every(Number.isFinite))
})
test("stop wins when an entry candle crosses both stop and target", () => {
  const b = candles(225)
  const f = buildPlanFeatures(b, "2d")[219]
  const edited = b.slice(0, 221)
  edited[220] = { ...edited[220], open: f.price, low: f.price - 10 * f.atr, high: f.price + 10 * f.atr }
  const result = runPlanBacktest(edited, "2d", { startIndex: 220, baseline: "ema" })
  if (f.ema20 > f.ema50 && !f.shock) {
    assert.equal(result.ledger[0]?.reason, "stop")
    assert.ok(result.ledger[0].pnl < 0)
  } else {
    const trend = candles(225).map((c, i) => ({ ...c, open: 100 + i, close: 101 + i, low: 99 + i, high: 102 + i, quoteVolume: (101 + i) * 100 }))
    trend[220] = { ...trend[220], high: 400, low: 200 }
    const forced = runPlanBacktest(trend.slice(0, 221), "2d", { startIndex: 220, baseline: "ema" })
    assert.equal(forced.ledger[0]?.reason, "stop")
  }
})


test("regime without data cannot emit a directional call", () => {
  const metrics: RawRegimeMetrics = { assetCcy: "BTC", stablecoinPct7d: null, etfAvgDailyUsdLast5: null, etfDailyDeltaVsPriorWeekUsd: null, exchangeStablePct7d: null, exchangeBtcPct7d: null, fundingRatePct: null, oiUsdSeries: [], longShortRatio: null, takerNetRecent: null, orderBookImbalancePct: null, priceChange24hPct: null, volumeSpikeRatio: null, priceVsSma200GapPct: null, athDistancePct: null, dvolClose: null, hashrateRatioTail: null, optionPutCallRatio7d: null }
  const result = computeRegimeScore(metrics)
  assert.equal(result.coverage, 0)
  assert.equal(result.signalBand, "neutral")
  assert.equal(result.total, 50)
  const down = computeRegimeScore({ ...metrics, volumeSpikeRatio: 3, priceChange24hPct: -4 })
  const up = computeRegimeScore({ ...metrics, volumeSpikeRatio: 3, priceChange24hPct: 4 })
  assert.ok(down.factors.find((f) => f.id === "marketStructure")!.score < up.factors.find((f) => f.id === "marketStructure")!.score)
  const negative = computeRegimeScore({ ...metrics, fundingRatePct: -0.08 })
  const positive = computeRegimeScore({ ...metrics, fundingRatePct: 0.08 })
  assert.ok(negative.factors[1].score > positive.factors[1].score)
})
