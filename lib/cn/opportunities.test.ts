import { test } from "node:test"
import assert from "node:assert/strict"
import { assessTheme, RESEARCH_THEMES, equityScenario, bondScenario, readNotebook } from "./opportunities.ts"
import type { SeriesData } from "./catalog.ts"
const now = new Date("2026-10-18T00:00:00Z")
const pmi: SeriesData = { id: "pmi", points: [{ date: "2026-09-01", value: 51 }], status: "ok", complete: true, firstDate: "2026-09-01", lastDate: "2026-09-01", fetchedAt: now.toISOString(), publishedAt: null, sourceUrl: "https://example.com/pmi", warning: null }
test("theme evidence reports available support but does not conceal missing data", () => {
  const result = assessTheme(RESEARCH_THEMES.find(t => t.id === "broad")!, { pmi }, now)
  assert.equal(result.support, 1)
  assert.equal(result.missing, 2)
  assert.equal(result.label, "证据待补齐")
})
test("failed refresh and stale observations cannot produce opportunity support", () => {
  const theme = RESEARCH_THEMES.find(t => t.id === "industry")!
  assert.equal(assessTheme(theme, { pmi: { ...pmi, status: "partial" } }, now).support, 0)
  assert.equal(assessTheme(theme, { pmi }, new Date("2027-05-01")).support, 0)
})
test("threshold equality is neutral, not a manufactured positive signal", () => {
  const result = assessTheme(RESEARCH_THEMES.find(t => t.id === "broad")!, { pmi: { ...pmi, points: [{ date: "2026-09-01", value: 50 }] } }, now)
  assert.equal(result.evidence[0].state, "neutral")
})
test("earnings and multiple scenarios account for dividend without confusing PE with return", () => {
  const result = equityScenario(100, 5, 10, 18, 2)!
  assert.equal(result.terminalPrice, 99)
  assert.ok(Math.abs(result.totalReturn - 1) < 1e-9)
  assert.equal(equityScenario(0, 5, 10, 18), null)
  assert.equal(equityScenario(100, -5, 10, 18), null)
  assert.equal(equityScenario(100, 5, -100, 18), null)
})
test("duration scenario keeps basis point conversion and carry separate", () => {
  assert.deepEqual(bondScenario(8, 50, 2), { priceChange: -4, approximateReturn: -2 })
  assert.equal(bondScenario(-1, 50, 2), null)
})
test("notebook survives corrupt local data and rejects non-catalog securities and unsafe URLs", () => {
  assert.deepEqual(readNotebook("bad json", ["sh510300"]).watchlist, [])
  const saved = readNotebook(JSON.stringify({ version: 1, watchlist: ["sh510300", "sh510300", "bogus"], notes: { sh510300: { thesis: "需求恢复", confirmation: "财报", invalidation: "库存", sourceUrl: "javascript:alert(1)", reviewedAt: "2026-10-18", savedAt: "2026-10-18T00:00:00Z" } } }), ["sh510300"])
  assert.deepEqual(saved.watchlist, ["sh510300"])
  assert.equal(saved.notes.sh510300.sourceUrl, "")
})
