import test from "node:test"
import assert from "node:assert/strict"
import { loadTencentCsi } from "./tencent.ts"

test("vendor overlap is clipped only after validating the requested window", async () => {
  const rows = Array.from({ length: 33 }, (_, i) => [new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), "100", "110"])
  const result = await loadTencentCsi(async url => url.includes("weekTrends") ? { data: [["2025-01-02", 1]] } : { data: { sh000300: { day: rows } } }, "2025-02-01")
  assert.equal(result.complete, true)
  assert.equal(result.points[0].date, "2025-01-02")
  assert.equal(result.points.at(-1)!.date, "2025-02-01")
  assert.equal(result.points.length, 31)
})
test("a repeated recent page cannot masquerade as older calendar-year coverage", async () => {
  await assert.rejects(() => loadTencentCsi(async url => url.includes("weekTrends") ? { data: [["2015-01-02", 1]] } : { data: { sh000300: { day: [["2025-01-02", "100", "110"]] } } }, "2025-10-15"), /2015.*完整性/)
})
