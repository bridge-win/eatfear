import assert from "node:assert/strict"
import test from "node:test"

import { runLedger, summarize, reconcile, type Bar } from "./ledger.ts"

function ramp(n: number, step = 0.01): Bar[] {
  const bars: Bar[] = []
  let price = 100
  for (let i = 0; i < n; i++) {
    bars.push({ time: i * 86_400_000, open: price, high: price * 1.02, low: price * 0.98, close: price * (1 + step) })
    price *= 1 + step
  }
  return bars
}

test("full long with no costs compounds the close-to-close return from the entry open", () => {
  const bars = ramp(10)
  const result = runLedger(bars, Array(10).fill(1), { fee: 0, slippage: 0 })
  assert.equal(result.exposure[0], 0, "no exposure on the first bar")
  assert.equal(result.exposure[1], 1, "target from bar 0 is effective on bar 1")
  const expected = bars[9].close / bars[1].open
  assert.ok(Math.abs(result.equity[9] / result.equity[1] - bars[9].close / bars[1].close) < 1e-9)
  assert.ok(expected > 1)
})

test("fills happen at the next open, never the deciding close", () => {
  const bars = ramp(5)
  // Only bar 2 asks for exposure; the fill must be stamped at bar 3's time.
  const targets = [0, 0, 1, 0, 0]
  const result = runLedger(bars, targets, { fee: 0.001 })
  assert.equal(result.fills[0].time, bars[3].time)
  assert.equal(result.fills[0].price, bars[3].open)
})

test("a future price shock cannot change earlier equity", () => {
  const bars = ramp(20)
  const targets = bars.map((_, i) => (i % 4 === 0 ? 1 : 0))
  const base = runLedger(bars, targets, { fee: 0.0006 })
  const shocked = bars.map((b, i) => (i >= 15 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b))
  const after = runLedger(shocked, targets, { fee: 0.0006 })
  for (let i = 0; i < 15; i++) {
    assert.ok(Math.abs(base.equity[i] - after.equity[i]) < 1e-12, `equity diverged at bar ${i}`)
  }
})

test("fees reduce equity and reconcile against fills", () => {
  const bars = ramp(30)
  const targets = bars.map((_, i) => (i % 2 === 0 ? 1 : 0))
  const free = runLedger(bars, targets, { fee: 0 })
  const paid = runLedger(bars, targets, { fee: 0.001 })
  assert.ok(paid.equity[29] < free.equity[29], "paying fees must cost money")
  assert.ok(paid.totalFees > 0)
  reconcile(paid, { fee: 0.001 })
})

test("wick stress fills worse than the open in both directions", () => {
  const bars = ramp(6)
  const targets = [1, 1, 1, 1, 1, 1]
  const calm = runLedger(bars, targets, { fee: 0, wickWeight: 0 })
  const stressed = runLedger(bars, targets, { fee: 0, wickWeight: 0.5 })
  assert.ok(stressed.fills[0].price > calm.fills[0].price, "buying under stress fills higher")
  const shortTargets = [-1, -1, -1, -1, -1, -1]
  const shortCalm = runLedger(bars, shortTargets, { fee: 0, wickWeight: 0 })
  const shortStressed = runLedger(bars, shortTargets, { fee: 0, wickWeight: 0.5 })
  assert.ok(shortStressed.fills[0].price < shortCalm.fills[0].price, "selling under stress fills lower")
})

test("flat targets produce no fills, no fees and flat equity", () => {
  const bars = ramp(12)
  const result = runLedger(bars, Array(12).fill(0), { fee: 0.001 })
  assert.equal(result.fills.length, 0)
  assert.equal(result.totalFees, 0)
  assert.ok(result.equity.every((v) => Math.abs(v - 1) < 1e-12))
  assert.equal(summarize(result).trades, 0)
})

test("summarize counts a round trip as one trade", () => {
  const bars = ramp(10)
  const targets = [0, 1, 1, 1, 0, 0, 0, 0, 0, 0]
  const stats = summarize(runLedger(bars, targets, { fee: 0 }))
  assert.equal(stats.trades, 1)
  assert.ok(stats.exposure > 0 && stats.exposure < 1)
})

test("golden numbers: TS ledger reconciles with the Python research engine", async () => {
  const golden = (await import("./__fixtures__/golden-faber200.json", { with: { type: "json" } })).default as {
    bars: Bar[]
    targets: number[]
    fee: number
    expected: { equity: number[]; fills: { i: number; delta: number; price: number; fee: number }[]; final: number; nFills: number }
  }
  const result = runLedger(golden.bars, golden.targets, { fee: golden.fee })
  assert.equal(result.fills.length, golden.expected.nFills, "fill count")
  result.fills.forEach((fill, k) => {
    const want = golden.expected.fills[k]
    assert.ok(Math.abs(fill.delta - want.delta) < 1e-9, `fill ${k} delta`)
    assert.ok(Math.abs(fill.price - want.price) < 1e-9, `fill ${k} price`)
    assert.ok(Math.abs(fill.fee - want.fee) < 1e-9, `fill ${k} fee`)
  })
  golden.expected.equity.forEach((want, i) => {
    assert.ok(Math.abs(result.equity[i] - want) < 1e-9, `equity bar ${i}: ${result.equity[i]} vs ${want}`)
  })
  assert.ok(Math.abs(result.equity[result.equity.length - 1] - golden.expected.final) < 1e-9)
})


test("entry at an up-gap cannot earn the gap; existing holdings do earn exit gaps", () => {
  const bars: Bar[] = [
    { time: 0, open: 100, high: 100, low: 100, close: 100 },
    { time: 1, open: 200, high: 220, low: 200, close: 220 },
    { time: 2, open: 242, high: 300, low: 242, close: 300 },
  ]
  const result = runLedger(bars, [1, 0, 0], { fee: 0 })
  assert.ok(Math.abs(result.equity[1] - 1.1) < 1e-12)
  assert.ok(Math.abs(result.equity[2] - 1.21) < 1e-12)
  assert.equal(result.fills[1].price, 242)
})
