import test from "node:test"
import assert from "node:assert/strict"
import { assembleCnFundamentals, getCnFundamentals, isCnFundamentalsId, type StatementKind } from "./fundamentals.ts"

const now = Date.parse("2026-10-18T00:00:00Z")
const row = (code = "601668", date = "2026-06-30", values: Record<string, unknown> = {}): Record<string, unknown> => ({ SECURITY_CODE: code, REPORT_DATE: `${date} 00:00:00`, NOTICE_DATE: `${date.slice(0, 4)}-${date.endsWith("03-31") ? "04-29" : "08-29"} 00:00:00`, REPORT_TYPE_CODE: "001", DATE_TYPE_CODE: date.endsWith("03-31") ? "003" : "002", ...values })
function fixture(code = "601668") {
  return {
    income: [row(code, "2026-06-30", { TOTAL_OPERATE_INCOME: 110, PARENT_NETPROFIT: 22 }), row(code, "2025-06-30", { TOTAL_OPERATE_INCOME: 100, PARENT_NETPROFIT: 20 })],
    balance: [row(code, "2026-06-30", { ACCOUNTS_RECE: 5, TOTAL_ASSETS: 1000, TOTAL_LIABILITIES: 600, TOTAL_EQUITY: 400 }), row(code, "2025-06-30", { ACCOUNTS_RECE: 10, TOTAL_ASSETS: 900, TOTAL_LIABILITIES: 500, TOTAL_EQUITY: 400 })],
    cashflow: [row(code, "2026-06-30", { NETCASH_OPERATE: -10 }), row(code, "2025-06-30", { NETCASH_OPERATE: -20 })],
  }
}
const fetchFixture = (tables = fixture()): typeof fetch => (async input => {
  const name = new URL(String(input)).searchParams.get("reportName")
  const kind = name?.endsWith("INCOME") ? "income" : name?.endsWith("BALANCE") ? "balance" : "cashflow"
  return new Response(JSON.stringify({ success: true, result: { data: tables[kind] } }))
}) as typeof fetch

test("financials align all three statements and compare the exact prior-year cumulative period", () => {
  const result = assembleCnFundamentals("sh601668", fixture(), now)
  assert.equal(result.status, "ok")
  assert.equal(result.reportDate, "2026-06-30")
  assert.equal(result.comparisonDate, "2025-06-30")
  assert.equal(result.periodLabel, "2026年1—6月")
  assert.equal(result.publicationDates.income, "2026-08-29")
  const revenue = result.metrics.find(m => m.id === "revenue")!
  assert.equal(revenue.current, 110)
  assert.equal(revenue.previous, 100)
  assert.ok(Math.abs(revenue.yoyPercent! - 10) < 1e-10)
  assert.equal(revenue.basis, "year-to-date")
  assert.equal(result.metrics.find(m => m.id === "receivables")!.basis, "period-end")
})

test("negative or zero prior-year bases show an amount change, not a misleading growth rate", () => {
  const result = assembleCnFundamentals("sh601668", fixture(), now)
  const cash = result.metrics.find(m => m.id === "operatingCashFlow")!
  assert.equal(cash.change, 10)
  assert.equal(cash.yoyPercent, null)
  assert.match(cash.note, /基数非正/)
  const tables = fixture()
  tables.income[1].TOTAL_OPERATE_INCOME = 0
  assert.equal(assembleCnFundamentals("sh601668", tables, now).metrics[0].yoyPercent, null)
})

test("asynchronous statement releases fall back to a disclosed common period, never mix periods", () => {
  const tables = fixture()
  for (const kind of ["income", "balance", "cashflow"] as const) {
    const old = tables[kind].map(r => row("601668", String(r.REPORT_DATE).slice(0, 4) + "-03-31", { ...r, REPORT_DATE: String(r.REPORT_DATE).slice(0, 4) + "-03-31 00:00:00", DATE_TYPE_CODE: "003" }))
    tables[kind] = kind === "income" ? [...tables[kind], ...old] : old
  }
  const result = assembleCnFundamentals("sh601668", tables, now)
  assert.equal(result.reportDate, "2026-03-31")
  assert.equal(result.comparisonDate, "2025-03-31")
  assert.equal(result.status, "partial")
  assert.match(result.warnings.join(" "), /共同报告期/)
})

test("missing prior-year values stay null rather than substituting a previous quarter", () => {
  const tables = fixture()
  tables.income[1] = row("601668", "2026-03-31", { TOTAL_OPERATE_INCOME: 80, PARENT_NETPROFIT: 5 })
  const result = assembleCnFundamentals("sh601668", tables, now)
  assert.equal(result.metrics[0].previous, null)
  assert.equal(result.metrics[0].yoyPercent, null)
  assert.equal(result.status, "partial")
})

test("bank cash flow is explicitly specialized and industrial receivables are not applicable", () => {
  const result = assembleCnFundamentals("sh600036", fixture("600036"), now)
  assert.equal(result.bank, true)
  assert.equal(result.metrics.find(m => m.id === "operatingCashFlow")!.applicability, "bank-specific")
  assert.equal(result.metrics.find(m => m.id === "receivables")!.current, null)
  assert.equal(result.metrics.find(m => m.id === "receivables")!.applicability, "not-applicable")
  assert.match(result.warnings.join(" "), /净息差/)
})

test("unknown publication dates remain unknown and future disclosures are excluded", () => {
  const tables = fixture()
  tables.income[0].NOTICE_DATE = ""
  const result = assembleCnFundamentals("sh601668", tables, now)
  assert.equal(result.publicationDates.income, null)
  assert.equal(result.status, "partial")
  tables.income[0].NOTICE_DATE = "2026-11-01 00:00:00"
  assert.equal(assembleCnFundamentals("sh601668", tables, now).reportDate, "2025-06-30")
})

test("missing financial values and malformed numeric values never become zero", () => {
  const tables = fixture()
  tables.income[0].TOTAL_OPERATE_INCOME = ""
  tables.balance[0].ACCOUNTS_RECE = null
  const result = assembleCnFundamentals("sh601668", tables, now)
  assert.equal(result.metrics[0].current, null)
  assert.equal(result.metrics.find(m => m.id === "receivables")!.current, null)
  assert.equal(result.status, "partial")
})

test("wrong security, quarter type and impossible dates fail closed", () => {
  assert.throws(() => assembleCnFundamentals("sh601668", fixture("600036"), now), /证券代码/)
  const tables = fixture()
  tables.income[0].REPORT_TYPE_CODE = "002"
  assert.throws(() => assembleCnFundamentals("sh601668", tables, now), /报表类型/)
  tables.income[0].REPORT_TYPE_CODE = "001"
  tables.income[0].REPORT_DATE = "2026-02-30"
  assert.throws(() => assembleCnFundamentals("sh601668", tables, now), /报告期/)
})

test("conflicting same-date revisions are rejected; a newer public revision is used", () => {
  const tables = fixture()
  tables.income.push({ ...tables.income[0], TOTAL_OPERATE_INCOME: 120 })
  assert.throws(() => assembleCnFundamentals("sh601668", tables, now), /冲突财报/)
  tables.income.at(-1)!.NOTICE_DATE = "2026-09-01"
  assert.equal(assembleCnFundamentals("sh601668", tables, now).metrics[0].current, 120)
})

test("fundamentals requests are bounded, whitelist-only and use cumulative report tables", async () => {
  let calls = 0
  const fetcher: typeof fetch = async (input, init) => {
    calls++
    const u = new URL(String(input))
    assert.equal(u.hostname, "datacenter-web.eastmoney.com")
    assert.equal(u.searchParams.get("pageSize"), "12")
    assert.equal(u.searchParams.get("pageNumber"), "1")
    assert.match(u.searchParams.get("filter")!, /601668/)
    assert.equal(init?.redirect, "error")
    assert.ok(init?.signal)
    return fetchFixture()(input, init)
  }
  assert.equal((await getCnFundamentals("sh601668", fetcher, now)).status, "ok")
  assert.equal(calls, 3)
  assert.equal(isCnFundamentalsId("sh510300"), false)
  await assert.rejects(() => getCnFundamentals("sh510300", fetcher, now), /Unsupported/)
  await assert.rejects(() => getCnFundamentals('601668")', fetcher, now), /Unsupported/)
  assert.equal(calls, 3)
})

test("network errors or oversized responses return honest unavailability without fabricated values", async () => {
  for (const fetcher of [async () => { throw new Error("offline") }, async () => new Response("{}", { headers: { "content-length": "1000001" } })] as (typeof fetch)[]) {
    const result = await getCnFundamentals("sh601668", fetcher, now)
    assert.equal(result.status, "unavailable")
    assert.equal(result.reportDate, null)
    assert.ok(result.metrics.every(m => m.current === null && m.previous === null))
  }
})

test("a missing statement never yields cross-statement conclusions", () => {
  const tables: Record<StatementKind, unknown> = { ...fixture(), cashflow: [] }
  const result = assembleCnFundamentals("sh601668", tables, now)
  assert.equal(result.status, "unavailable")
  assert.equal(result.reportDate, null)
  assert.ok(result.metrics.every(m => m.current === null))
})
