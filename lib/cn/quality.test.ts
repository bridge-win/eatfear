import test from "node:test"
import assert from "node:assert/strict"
import { BY_ID, type Point, type SeriesData } from "./catalog.ts"
import { evaluate, eventStudy } from "./metrics.ts"
import { parseTencentKlines, loadTencentCsi } from "./tencent.ts"
const points: Point[] = Array.from({ length: 80 }, (_, i) => ({ date: new Date(Date.UTC(2018, i + 1, 0)).toISOString().slice(0, 10), value: 48 + i % 7 }))
const data: SeriesData = { id: "pmi", points, status: "ok", complete: true, fetchedAt: "2024-09-01T00:00:00Z", publishedAt: null, sourceUrl: "https://example.test", warning: null, firstDate: points[0].date, lastDate: points.at(-1)!.date }
const now = new Date("2024-09-01T00:00:00Z")
test("failed refresh cannot silently turn retained history into current temperature", () => {
  const e = evaluate(BY_ID.pmi, { ...data, status: "partial" }, now)
  assert.equal(e.value, points.at(-1)!.value)
  assert.equal(e.percentile, null)
  assert.equal(e.robustZ, null)
  assert.equal(e.label, "获取待复核")
})
test("stale history is preserved but cannot be given a current percentile", () => {
  const e = evaluate(BY_ID.pmi, data, new Date("2035-01-01"))
  assert.equal(e.percentile, null)
  assert.equal(e.z, null)
  assert.equal(e.value, points.at(-1)!.value)
})
test("monthly last-period change is unavailable across missing months", () => {
  const copy = [...points]; copy.splice(copy.length - 2, 1)
  assert.equal(evaluate(BY_ID.pmi, { ...data, points: copy }, now).delta, null)
})
test("equity price levels are not treated as stationary outlier observations", () => {
  assert.equal(evaluate(BY_ID.equity, data, now).robustZ, null)
})
test("event studies reject gaps, nonpositive prices and invalid horizons", () => {
  const ps = [{ date: "2024-01-01", value: 100 }, { date: "2024-01-02", value: 100 }, { date: "2024-03-01", value: 120 }]
  assert.equal(eventStudy(ps, "2024-01-02", 1), null)
  assert.equal(eventStudy(ps, "2024-01-02", -1), null)
  assert.equal(eventStudy(ps, "2024-01-02", 1.5), null)
})
test("Tencent parsing reads the close and discards invalid dates and prices", () => {
  const parsed = parseTencentKlines([["2024-01-02", "100", "110", "120"], ["2024-02-30", "1", "2"], ["2024-01-03", "1", ""]])
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].value, 110)
  assert.match(parsed[0].sourceUrl!, /gu.qq.com/)
})
test("Tencent rejects missing earliest-date evidence", async () => {
  await assert.rejects(() => loadTencentCsi(async () => ({ data: [] }), "2026-10-15"), /起点/)
})
test("Tencent does not mark ignored historical date bounds as complete", async () => {
  await assert.rejects(() => loadTencentCsi(async url => url.includes("weekTrends") ? { data: [["2024-01-02", 1]] } : { data: { sh000300: { day: [["2026-01-02", "100", "110"]] } } }, "2025-10-15"), /范围|完整/)
})
