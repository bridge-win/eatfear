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
