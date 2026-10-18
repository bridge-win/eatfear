import { test } from "node:test"
import assert from "node:assert/strict"
import { assessRule, RESEARCH_THEMES } from "./opportunities.ts"
import { evaluate } from "./metrics.ts"
import { BY_ID, type SeriesData } from "./catalog.ts"
import { context, marketSnapshot } from "./market-fixtures.ts"
import { marketAnalysis } from "./market-analysis.ts"
function partialSeries(): SeriesData {
  const points = Array.from({ length: 100 }, (_, i) => ({ date: new Date(Date.UTC(2018, i + 6, 0)).toISOString().slice(0, 10), value: 4 - i * .01 }))
  return { id: "lg_rate", points: points.filter((_, i) => i !== 2), status: "partial", complete: false, latestVerified: true, fetchedAt: "2026-10-18T00:00Z", publishedAt: null, sourceUrl: "https://zwgls.mof.gov.cn/tjsj/", warning: "早期历史缺月", firstDate: points[0].date, lastDate: points.at(-1)!.date }
}
test("an old archive gap does not erase a verified latest observation or complete recent calculation window", () => {
  const series = partialSeries(), now = new Date("2026-10-18T00:00Z")
  const rule = RESEARCH_THEMES[0].rules.find(r => r.seriesId === "lg_rate")!
  const result = assessRule(rule, { lg_rate: series }, now)
  assert.equal(result.state, "support"); assert.notEqual(result.value, null)
  assert.notEqual(evaluate(BY_ID.lg_rate, series, now).percentile, null)
  const failed = assessRule(rule, { lg_rate: { ...series, latestVerified: false } }, now)
  assert.equal(failed.state, "missing")
  const gap = { ...series, points: series.points.filter((_, i) => i !== series.points.length - 2) }
  assert.equal(assessRule(rule, { lg_rate: gap }, now).state, "missing")
})
test("economic conclusions do not fill unavailable macro data or invent company returns", () => {
  const analysis = marketAnalysis(context(marketSnapshot()))
  assert.equal(analysis.findings.length, 0)
  assert.equal(analysis.presets.length, 3)
  assert.ok(analysis.themes.every(t => t.missing === t.evidence.length))
})
