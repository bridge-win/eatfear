import assert from "node:assert/strict"
import test from "node:test"

import { orderGroupsByImportance } from "./history-order.ts"

const pt = [{ time: 1, value: 1 }]
const groups = [
  { key: "low", label: "低", series: [{ key: "a", label: "a", color: "#000", unit: "raw" as never, importance: 40, data: pt }] },
  { key: "high", label: "高", series: [
    { key: "b", label: "b", color: "#000", unit: "raw" as never, importance: 90, tier: "secondary" as const, data: pt },
    { key: "c", label: "c", color: "#000", unit: "raw" as never, importance: 90, tier: "core" as const, data: pt },
    { key: "d", label: "d", color: "#000", unit: "raw" as never, importance: 100, data: pt },
  ] },
]

test("groups are ordered by their most important series, series by importance then core tier", () => {
  const ordered = orderGroupsByImportance(groups)
  assert.deepEqual(ordered.map((g) => g.key), ["high", "low"])
  assert.deepEqual(ordered[0].series.map((s) => s.key), ["d", "c", "b"], "R100 first, then core before secondary at equal R")
})

test("ordering does not mutate the input", () => {
  const before = JSON.stringify(groups)
  orderGroupsByImportance(groups)
  assert.equal(JSON.stringify(groups), before)
})

import { diffCorrelation, orderGroupsByScore } from "./history-order.ts"

test("diffCorrelation uses changes, so a smoothed copy of price does not score 1", () => {
  const price = Array.from({ length: 60 }, (_, i) => ({ time: i, value: 100 + Math.sin(i / 3) * 10 + i * 0.2 }))
  const ema = price.map((p, i, arr) => ({ time: i, value: arr.slice(Math.max(0, i - 9), i + 1).reduce((a, x) => a + x.value, 0) / Math.min(10, i + 1) }))
  const inverse = price.map((p) => ({ time: p.time, value: -p.value }))
  const ref = { key: "ref", data: price }
  const rEma = diffCorrelation({ key: "ema", data: ema }, ref)!
  const rInv = diffCorrelation({ key: "inv", data: inverse }, ref)!
  assert.ok(rEma < 0.95, `smoothed series should not be ~1 in diffs, got ${rEma}`)
  assert.ok(Math.abs(rInv + 1) < 1e-9, "exact inverse must be -1")
  assert.equal(diffCorrelation({ key: "short", data: price.slice(0, 5) }, ref), null, "too few points → null")
})

test("orderGroupsByScore ranks by |score| when asked, falling back to importance", () => {
  const pt = (v: number[]) => v.map((value, time) => ({ time, value }))
  const groups = [
    { key: "a", series: [{ key: "x", importance: 99, data: pt([1, 2, 3, 4, 5]) }] },
    { key: "b", series: [{ key: "y", importance: 10, data: pt([5, 4, 3, 2, 1]) }, { key: "z", importance: 20, data: pt([1, 1, 1, 1, 1]) }] },
  ]
  const byAbs = orderGroupsByScore(groups, (s) => (s.key === "y" ? 0.9 : s.key === "x" ? 0.3 : null))
  assert.deepEqual(byAbs.map((g) => g.key), ["b", "a"])
  assert.deepEqual(byAbs[0].series.map((s) => s.key), ["y", "z"], "null score sorts last")
})
