import test from "node:test"
import assert from "node:assert/strict"
import { loadCsi300, normalizeLpr, parseKlines } from "./equity.ts"

test("LPR keeps only comparable reform-era monthly observations", () => {
  assert.deepEqual(normalizeLpr([{ date: "2018-01-01", value: 4 }, { date: "2019-08-16", value: 4 }, { date: "2019-08-20", value: 4.25 }, { date: "2019-09-20", value: 4.2 }]).map(p => p.date), ["2019-08-20", "2019-09-20"])
})
test("stock kline reads close rather than open and rejects invalid values", () => {
  const points = parseKlines(["2024-01-02,10,12,14,9,100", "2024-01-03,11,,14,9,100", "2024-02-30,10,11,14,9,100"])
  assert.equal(points.length, 1)
  assert.equal(points[0].value, 12)
})
test("a quote-only Yahoo response is never a complete historical series", async () => {
  const result = await loadCsi300(async url => {
    if (url.includes("yahoo")) return { chart: { result: [{ timestamp: [1725926400], indicators: { quote: [{ close: [3000] }] } }] } }
    throw new Error("upstream unavailable")
  }, "2026-10-15")
  assert.equal(result.complete, false)
  assert.equal(result.points.length, 1)
})
test("equity historical fallback walks end dates until no earlier records", async () => {
  let calls = 0
  const result = await loadCsi300(async url => {
    if (url.includes("yahoo")) throw new Error("unavailable")
    calls++
    if (calls === 1) return { rc: 0, data: { klines: ["2025-01-02,10,11,12,9,100"] } }
    if (calls === 2) { assert.equal(new URL(url).searchParams.get("end"), "20250101"); return { rc: 0, data: { klines: ["2024-01-02,9,10,12,8,100"] } } }
    return { rc: 0, data: null }
  }, "2026-10-15")
  assert.equal(result.complete, true)
  assert.equal(calls, 3)
  assert.deepEqual(result.points.map(p => p.value), [10, 11])
})
test("equity repetition is reported as partial history, not silent truncation", async () => {
  const result = await loadCsi300(async url => {
    if (url.includes("yahoo")) throw new Error("unavailable")
    return { rc: 0, data: { klines: ["2025-01-02,10,11,12,9,100"] } }
  }, "2026-10-15")
  assert.equal(result.complete, false)
  assert.match(result.warning ?? "", /更早|截止/)
})
