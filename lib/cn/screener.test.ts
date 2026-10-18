import { test } from "node:test"
import assert from "node:assert/strict"
import { parseScreenFilters, presetFilters, screenFailures, screenMarket, companyConclusions, selectRows } from "./screener.ts"
import { marketRow, marketSnapshot, context } from "./market-fixtures.ts"
import { readNotebook } from "./opportunities.ts"
test("presets implement explicit numeric rules without manufacturing missing values", () => {
  const f = presetFilters("value"), r = marketRow()
  assert.deepEqual(screenFailures(r, f), [])
  assert.ok(screenFailures({ ...r, revenueGrowth: 0 }, f).includes("收入同比"))
  assert.ok(screenFailures({ ...r, pePercentile: null }, f).includes("同行PE分位/样本不足"))
  assert.ok(screenFailures({ ...r, annualRoe: 9.99 }, f).includes("完整年度ROE"))
  assert.deepEqual(screenFailures({ ...r, pePercentile: 40, annualRoe: 10 }, f), [])
  assert.ok(screenFailures({ ...r, peTtm: -1 }, f).length > 0)
})
test("financial companies do not pass industrial cash flow and leverage gates", () => {
  const r = marketRow({ financial: true, industry: "银行Ⅱ", pb: .8 })
  assert.deepEqual(screenFailures(r, presetFilters("financial")), [])
  assert.ok(screenFailures(r, { ...presetFilters("custom"), cashFlow: "positive" }).includes("经营现金流/金融行业不适用"))
  assert.ok(screenFailures(r, { ...presetFilters("custom"), debtRatioMax: 99 }).includes("资产负债率/金融行业不适用"))
})
test("improvement requires real same-period cash improvement and positive-base profit growth", () => {
  const f = presetFilters("improving")
  assert.deepEqual(screenFailures(marketRow(), f), [])
  assert.ok(screenFailures(marketRow({ previousOperatingCashFlow: null }), f).length)
  assert.ok(screenFailures(marketRow({ operatingCashFlow: 1e8 }), f).length)
  assert.ok(screenFailures(marketRow({ profitGrowth: null, profitState: "turnaround" }), f).length)
})
test("filters reject arbitrary parameters, duplicate values, impossible ranges and huge pages", () => {
  for (const q of ["peMax=NaN", "page=0", "pageSize=101", "peMin=20&peMax=10", "pePercentileMax=101", "search=x&search=y", "url=https://example.com", "exchange=HK", "industry=x)or(1=1)"]) assert.throws(() => parseScreenFilters(new URLSearchParams(q)), q)
  assert.equal(parseScreenFilters(new URLSearchParams("preset=value&roeMin=")).roeMin, null)
  assert.equal(parseScreenFilters(new URLSearchParams("preset=custom&exchange=BSE")).exchange, "BSE")
})
test("stable sorting and pagination retain unique identities; empty results explain exclusion", () => {
  const rows = Array.from({ length: 60 }, (_, i) => marketRow({ id: `sh${600000 + i}`, code: String(600000 + i), secucode: `${600000 + i}.SH` }))
  const c = context(marketSnapshot(rows)), f = presetFilters("value")
  const first = screenMarket(c, f), second = screenMarket(c, { ...f, page: 2 })
  assert.equal(first.total, 60); assert.equal(first.items.length, 50); assert.equal(second.items.length, 10)
  assert.equal(new Set([...first.items, ...second.items].map(i => i.row.id)).size, 60)
  assert.equal(first.snapshotId, second.snapshotId)
  const empty = screenMarket(c, { ...f, roeMin: 99 }); assert.equal(empty.total, 0); assert.equal(empty.excluded[0].reason, "完整年度ROE")
})
test("topic is an explicit industry association and does not silently relax thresholds", () => {
  const s = marketSnapshot([marketRow()])
  assert.equal(selectRows(s, { ...presetFilters("value"), theme: "industry" }).rows.length, 1)
  assert.equal(selectRows(s, { ...presetFilters("value"), theme: "consumption" }).rows.length, 0)
})
test("cross-market sort ties follow security code rather than exchange prefix", () => {
  const rows = [marketRow({ id: "bj920001", code: "920001", secucode: "920001.BJ", exchange: "BSE" }), marketRow()]
  assert.deepEqual(selectRows(marketSnapshot(rows), presetFilters("value")).rows.map(r => r.code), ["600001", "920001"])
})
test("loss PE and nonpositive PB stay outside low-valuation ordering in either direction", () => {
  const rows = [marketRow({ id: "sh600000", code: "600000", secucode: "600000.SH", peTtm: -3, pb: -.5 }), marketRow(), marketRow({ id: "sh600002", code: "600002", secucode: "600002.SH", peTtm: 20, pb: 2 })]
  for (const sort of ["peTtm", "pb"] as const) for (const direction of ["asc", "desc"] as const) {
    const result = selectRows(marketSnapshot(rows), { ...presetFilters("custom"), sort, direction }).rows
    assert.equal(result.at(-1)!.code, "600000")
    assert.equal(result[0].code, direction === "asc" ? "600001" : "600002")
  }
})
test("conclusions contain actual values, periods, sources and adverse evidence", () => {
  const r = marketRow({ operatingCashFlow: -1e8, revenueGrowth: -10 }), c = companyConclusions(r, presetFilters("value"))
  assert.deepEqual(c.map(x => x.kind), ["business", "valuation", "match", "risk", "missing"])
  assert.match(c[0].text, /-10%/); assert.match(c[3].text, /现金流不为正/); assert.match(c[2].text, /未满足/)
  assert.ok(c.every(x => x.sourceUrl.startsWith("https://") && x.period !== null))
})
test("edited preset conclusions describe actual thresholds rather than claiming the original preset", () => {
  const f = { ...presetFilters("value"), roeMin: 8, pePercentileMax: null }
  const c = companyConclusions(marketRow({ annualRoe: 9, pePercentile: 90 }), f).find(x => x.kind === "match")!
  assert.match(c.text, /9%≥8%/); assert.doesNotMatch(c.text, /估值较低|≤40/)
})
test("legacy notebook retains full-market and ETF records without accepting arbitrary keys", () => {
  const note = { thesis: "证据", confirmation: "", invalidation: "", sourceUrl: "https://www.cninfo.com.cn/", reviewedAt: "", savedAt: "" }
  const n = readNotebook(JSON.stringify({ version: 1, watchlist: ["bj920000", "sh510300", "garbage"], notes: { bj920000: note, sh510300: note } }), ["sh510300"], true)
  assert.deepEqual(n.watchlist, ["bj920000", "sh510300"]); assert.equal(n.notes.bj920000.thesis, "证据")
})
