import { test } from "node:test"
import assert from "node:assert/strict"
import { reportingPeriods, yoy, profitState, addPeerValuations, validateSnapshot, isDepositaryReceiptCode } from "./market-model.ts"
import { selectStatementRows, parsePage, table } from "./market-providers.ts"
import { marketRow, marketSnapshot, peerRows } from "./market-fixtures.ts"
test("reporting seasons switch only after the common reporting deadline, annual ROE is independent", () => {
  assert.deepEqual(reportingPeriods(new Date("2026-10-18T00:00Z")), { reportDate: "2026-06-30", comparisonDate: "2025-06-30", annualReportDate: "2025-12-31" })
  assert.equal(reportingPeriods(new Date("2026-10-31T15:59Z")).reportDate, "2026-06-30")
  assert.equal(reportingPeriods(new Date("2026-10-31T16:00Z")).reportDate, "2026-09-30")
  assert.equal(reportingPeriods(new Date("2026-02-01T00:00Z")).annualReportDate, "2024-12-31")
})
test("negative and zero profit bases never create ordinary growth rates", () => {
  assert.equal(yoy(50, -100), null); assert.equal(yoy(50, 0), null); assert.equal(yoy(null, 100), null)
  assert.equal(yoy(120, 100), 19.999999999999996)
  assert.equal(profitState(50, -100), "turnaround"); assert.equal(profitState(-50, -100), "loss-narrowing"); assert.equal(profitState(-150, -100), "loss-widening")
})
test("STAR depositary receipts are not ordinary A shares in the candidate universe", () => {
  assert.equal(isDepositaryReceiptCode("689009"), true)
  for (const code of ["688330", "302132", "920000", "600036"]) assert.equal(isDepositaryReceiptCode(code), false)
})
test("peer valuation requires ten same-day same-industry profitable peers and excludes loss PE", () => {
  assert.equal(peerRows(9)[0].pePercentile, null)
  const rows = peerRows(10); assert.equal(rows[0].pePercentile, 5); assert.equal(rows[9].pePercentile, 95)
  rows.push(marketRow({ id: "sh699999", peTtm: -5, netIncome: -100 }))
  addPeerValuations(rows); assert.equal(rows[10].pePercentile, null); assert.equal(rows[0].pePeers, 10)
  rows[9].quoteDate = "2026-10-15"; addPeerValuations(rows); assert.equal(rows[0].pePercentile, null)
})
test("positive TTM PE and current YTD profit are separate measures", () => {
  const rows = peerRows(10)
  rows[0].netIncome = -100
  addPeerValuations(rows)
  assert.equal(rows[0].pePercentile, 5)
  assert.equal(rows[0].pePeers, 10)
})
test("financial tables reject period mismatch and ignore future announcements", () => {
  const base = { SECUCODE: "600001.SH", REPORTDATE: "2026-06-30 00:00:00", NOTICE_DATE: "2026-08-01" }
  assert.equal(selectStatementRows([base], "2026-06-30", "2026-10-18").size, 1)
  assert.equal(selectStatementRows([{ ...base, NOTICE_DATE: "2026-12-01" }], "2026-06-30", "2026-10-18").size, 0)
  assert.throws(() => selectStatementRows([base], "2026-03-31", "2026-10-18"))
  assert.throws(() => selectStatementRows([{ ...base, NOTICE_DATE: "2026-01-01" }], "2026-06-30", "2026-10-18"))
  assert.throws(() => selectStatementRows([{ ...base, REPORT_DATE: "2026-06-30", REPORT_TYPE_CODE: "001", DATE_TYPE_CODE: "003" }], "2026-06-30", "2026-10-18", true))
})
test("pagination checks metadata, missing and repeated pages", async () => {
  assert.throws(() => parsePage({ success: false }))
  const mock = (rows: unknown[][], count = 2) => async (url: string | URL | Request) => new Response(JSON.stringify({ success: true, result: { pages: 2, count, data: rows[Number(new URL(String(url)).searchParams.get("pageNumber")) - 1] } }))
  assert.equal((await table("test", "", mock([[{ SECUCODE: "600001.SH" }], [{ SECUCODE: "600002.SH" }]]) as typeof fetch)).length, 2)
  await assert.rejects(table("test", "", mock([[{ SECUCODE: "600001.SH" }], [{ SECUCODE: "600001.SH" }]]) as typeof fetch))
  await assert.rejects(table("test", "", mock([[{ SECUCODE: "600001.SH" }], []]) as typeof fetch))
})
test("public snapshot validation rejects identity conflicts, future periods and forged coverage", () => {
  validateSnapshot(marketSnapshot())
  assert.throws(() => validateSnapshot(marketSnapshot([marketRow({ secucode: "600001.BJ" })])))
  assert.throws(() => validateSnapshot(marketSnapshot([marketRow(), marketRow()])))
  assert.throws(() => validateSnapshot({ ...marketSnapshot(), tradeDate: "2099-01-01" }))
  assert.throws(() => validateSnapshot({ ...marketSnapshot(), coverage: { universe: 999 } }))
  assert.throws(() => validateSnapshot(marketSnapshot([marketRow({ price: NaN })])))
})
