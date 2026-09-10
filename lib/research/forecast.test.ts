import assert from "node:assert/strict"
import test from "node:test"

import { forecast, volForecasts, calibrate, QUANTILES, type Candle } from "./forecast.ts"

function gbm(n: number, sigma = 0.5, seed = 7): Candle[] {
  const out: Candle[] = []
  let price = 100
  let s = seed
  const daily = sigma / Math.sqrt(365)
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    const u1 = (s % 10000) / 10000 || 0.5
    s = (s * 1103515245 + 12345) % 2147483648
    const u2 = (s % 10000) / 10000 || 0.5
    const shock = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * daily
    price *= Math.exp(shock - 0.5 * daily * daily)
    out.push({ time: Date.UTC(2015, 0, 1) + i * 86_400_000, close: price })
  }
  return out
}

test("volatility forecasts recover the generating sigma", () => {
  const candles = gbm(2500, 0.5)
  const models = volForecasts(candles, 30)
  const last = models.rv30[candles.length - 1]
  assert.ok(last !== null && last > 0.3 && last < 0.8, `rv30 was ${last}`)
  assert.ok(models.ensemble[candles.length - 1] !== null, "ensemble needs all four members")
})

test("no volatility forecast uses future data", () => {
  const candles = gbm(2500)
  const base = volForecasts(candles, 30)
  const shocked = candles.map((c, i) => (i >= candles.length - 100 ? { ...c, close: c.close * 4 } : c))
  const after = volForecasts(shocked, 30)
  const guard = candles.length - 130
  for (const model of ["const", "rv30", "ewma"] as const) {
    for (let i = 0; i < guard; i++) {
      const a = base[model][i], b = after[model][i]
      if (a === null || b === null) continue
      assert.ok(Math.abs(a - b) < 1e-9, `${model} changed at ${i}`)
    }
  }
})

test("the delivered median is exactly the spot price", () => {
  const candles = gbm(3000)
  const f = forecast(candles, 30, [2019, 2021], 2022)
  assert.ok(Math.abs(f.zQuantiles["0.5"]) < 1e-9, "standardised median must be centred")
  assert.ok(Math.abs(f.bands[f.bands.length - 1].quantiles["0.5"] / f.spot - 1) < 1e-9)
})

test("quantile bands are monotonic and widen with horizon", () => {
  const candles = gbm(3000)
  const f = forecast(candles, 60, [2019, 2021], 2022)
  assert.equal(f.bands.length, 60)
  for (const band of f.bands) {
    const vals = QUANTILES.map((q) => band.quantiles[String(q)])
    for (let i = 1; i < vals.length; i++) assert.ok(vals[i] >= vals[i - 1], `band ${band.day} not monotonic`)
    assert.ok(vals.every((v) => v > 0))
  }
  const first = f.bands[0].quantiles
  const lastBand = f.bands[59].quantiles
  assert.ok(lastBand["0.95"] - lastBand["0.05"] > first["0.95"] - first["0.05"], "uncertainty must grow")
})

test("model choice never uses the holdout winner alone", () => {
  const candles = gbm(3000)
  const f = forecast(candles, 30, [2019, 2021], 2022)
  assert.ok(f.selectedBecause.length > 0)
  if (f.selectedBecause.includes("不一致")) assert.equal(f.volModel, "ensemble")
})

test("calibration coverage lands near its nominal level on GBM data", () => {
  const candles = gbm(3200, 0.5)
  const models = volForecasts(candles, 30)
  const c = calibrate(candles, models.rv30, 30, "rv30", 2022, 2023)
  assert.ok(c, "expected a calibration result")
  assert.ok(c!.coverage.p80 > 0.55 && c!.coverage.p80 <= 1, `p80 coverage ${c!.coverage.p80}`)
  assert.ok(c!.pitKs < 0.35, `PIT-KS ${c!.pitKs}`)
  assert.ok(Number.isFinite(c!.qlike) && c!.qlike >= 0)
})

test("probabilities are a valid CDF over the price grid", () => {
  const candles = gbm(3000)
  const f = forecast(candles, 30, [2019, 2021], 2022)
  const probs = f.probabilities
  for (let i = 1; i < probs.length; i++) {
    assert.ok(probs[i].price > probs[i - 1].price)
    assert.ok(probs[i].below >= probs[i - 1].below - 1e-12, "CDF must be non-decreasing")
  }
  assert.ok(probs.every((p) => p.below >= 0 && p.below <= 1))
})

test("effective sample size accounts for overlapping windows", () => {
  const candles = gbm(3000)
  const f = forecast(candles, 90, [2019, 2021], 2022)
  assert.ok(f.effectiveSampleSize < f.sampleSize / 50, "90-day overlap must shrink the effective count")
})
