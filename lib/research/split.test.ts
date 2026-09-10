import assert from "node:assert/strict"
import test from "node:test"

import type { Bar } from "./ledger.ts"
import { assertNoLeakage, selectParams, evaluate, walkForward, verdict, deflatedSharpe, type Rule } from "./split.ts"

function series(n: number, seed = 1): Bar[] {
  const bars: Bar[] = []
  let price = 100
  let s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    const shock = (s / 2147483648 - 0.5) * 0.06
    const open = price
    price *= 1 + shock
    bars.push({ time: Date.UTC(2015, 0, 1) + i * 86_400_000, open, high: Math.max(open, price) * 1.01, low: Math.min(open, price) * 0.99, close: price })
  }
  return bars
}

const maRule: Rule<{ n: number }> = {
  id: "ma", name: "均线择时", family: "趋势",
  grid: [{ n: 20 }, { n: 50 }, { n: 100 }, { n: 200 }],
  targets: (bars, { n }) =>
    bars.map((b, i) => {
      if (i < n) return 0
      const ma = bars.slice(i - n + 1, i + 1).reduce((a, x) => a + x.close, 0) / n
      return b.close > ma ? 1 : 0
    }),
}

const CUT = Date.UTC(2022, 0, 1)
const CFG = { fee: 0.0006 }

test("assertNoLeakage throws when a bar reaches the cutoff", () => {
  const bars = series(3200)
  assert.throws(() => assertNoLeakage(bars, CUT), /Leakage/)
  assert.doesNotThrow(() => assertNoLeakage(bars.filter((b) => b.time < CUT), CUT))
})

test("selectParams refuses test-window data", () => {
  const bars = series(3200)
  assert.throws(() => selectParams(maRule, bars, CUT, CFG), /Leakage/)
})

test("selection depends only on the training window", () => {
  const bars = series(3200)
  const train = bars.filter((b) => b.time < CUT)
  const picked = selectParams(maRule, train, CUT, CFG).params
  const shocked = bars.map((b) => (b.time >= CUT ? { ...b, open: b.open * 5, high: b.high * 5, low: b.low * 5, close: b.close * 5 } : b))
  const pickedAgain = selectParams(maRule, shocked.filter((b) => b.time < CUT), CUT, CFG).params
  assert.deepEqual(picked, pickedAgain, "test-window shock must not move the chosen parameters")
})

test("evaluate reports a plane spread and concentration over the test window", () => {
  const bars = series(3200)
  const res = evaluate(maRule, bars, CUT, CFG)
  assert.equal(res.plane.length, maRule.grid.length)
  assert.ok(res.planeSpread >= 0)
  assert.ok(res.concentration.n >= 0)
  assert.ok(Object.keys(res.yearly).length > 3)
  assert.ok(Number.isFinite(res.oos.sharpe))
})

test("walkForward re-picks parameters per window and reports consistency", () => {
  const bars = series(2600)
  const wf = walkForward(maRule, bars, CFG)
  assert.ok(wf.nWindows >= 3, `expected several windows, got ${wf.nWindows}`)
  assert.ok(wf.pctWindows >= 0 && wf.pctWindows <= 1)
  assert.equal(wf.winWindows, wf.windows.filter((w) => w.total > 0).length)
  wf.windows.forEach((w) => assert.ok(new Date(w.trainEnd) < new Date(w.testEnd)))
})

test("verdict flags a knife-edge parameter surface", () => {
  const base = {
    params: { n: 1 }, is: {} as never,
    oos: { total: 0.4, cagr: 0.4, sharpe: 1.1, maxdd: -0.2, trades: 10, win: 0.6, pf: 1.8, exposure: 0.5 },
    plane: [], planeSpread: 1.9,
    concentration: { all: 0.4, drop1: 0.3, drop3: 0.2, n: 10 },
    yearly: { "2023": 0.2, "2024": 0.3 }, equity: [],
  }
  assert.ok(verdict(base as never).includes("参数尖峰"))
  const thin = { ...base, planeSpread: 0.2, concentration: { all: 0.4, drop1: 0.1, drop3: -0.05, n: 8 } }
  assert.ok(verdict(thin as never).includes("靠少数几笔"))
  const clean = { ...base, planeSpread: 0.2 }
  assert.deepEqual(verdict(clean as never), ["未被证伪"])
})

test("deflatedSharpe falls as the number of trials rises", () => {
  const rs = Array.from({ length: 500 }, (_, i) => 0.002 + Math.sin(i) * 0.01)
  const few = deflatedSharpe(rs, 2, 0.01)
  const many = deflatedSharpe(rs, 200, 0.01)
  assert.ok(few > many, `${few} should exceed ${many}`)
  assert.ok(many >= 0 && few <= 1)
})
