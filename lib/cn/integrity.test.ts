import test from "node:test"
import assert from "node:assert/strict"
import { BY_ID, type Point, type SeriesData } from "./catalog.ts"
import { csv, evaluate, eventStudy } from "./metrics.ts"
import { mofCoverage, refreshMofHistory, type MofRecord } from "./mof.ts"
import { eastmoneyRows, getSeries } from "./providers.ts"

const record = (date: string, fields: Partial<MofRecord> = {}): MofRecord => ({ date, issuance: 100, refinance: 40, newDebt: 60, balance: 1000, rate: 2, sourceUrl: "https://zwgls.mof.gov.cn/tjsj/test.htm", publishedAt: null, fetchedAt: "2026-02-01T00:00:00Z", ...fields })
const wrap = (points: Point[]): SeriesData => ({ id: "equity", points, status: "ok", complete: true, fetchedAt: "2026-10-18T00:00:00Z", publishedAt: null, sourceUrl: "https://example.test", warning: null, firstDate: points[0]?.date ?? null, lastDate: points.at(-1)?.date ?? null })
const mockFetch = (fn: (url: string) => unknown): typeof fetch => (async (input: string | URL | Request) => new Response(JSON.stringify(fn(String(input))), { headers: { "content-type": "application/json" } })) as typeof fetch

test("MOF crawl success cannot conceal a missing start, interior month or field", () => {
  const records = [record("2026-01-31"), record("2026-02-28", { refinance: null }), record("2026-03-31")]
  assert.equal(mofCoverage(records, 2026).complete, true)
  assert.equal(mofCoverage(records, 2026, "refinance").complete, false)
  assert.match(mofCoverage(records, 2026, "refinance").warning!, /2026-02/)
  assert.equal(mofCoverage(records, 2025).complete, false)
  assert.equal(mofCoverage([records[0], records[2]], 2026).complete, false)
})

test("MOF failed live verification downgrades even an otherwise complete archive", async () => {
  const records = [record("2026-01-31")]
  const result = await refreshMofHistory({ records, startYear: 2026, errors: [] }, async () => { throw new Error("offline") })
  assert.equal(result.complete, false)
  assert.deepEqual(result.records, records)
  assert.match(result.warning!, /官网检查失败/)
})

test("MOF partial article refresh is explicitly incomplete", async () => {
  const result = await refreshMofHistory({ records: [record("2026-01-31")], startYear: 2026, errors: [] }, async url => url.endsWith("/tjsj/") ? '<li><a href="./test.htm">2026年1月地方政府债券发行情况</a></li>' : "unrecognized article")
  assert.equal(result.complete, false)
  assert.match(result.warning!, /未能解析/)
})

test("MOF verifies complete archived coverage after a valid refresh", async () => {
  const result = await refreshMofHistory({ records: [], startYear: 2026, errors: [] }, async url => url.endsWith("/tjsj/") ? '<li><a href="./test.htm">2026年1月地方政府债券发行情况</a></li>' : "全国发行新增债券60亿元。全国发行再融资债券40亿元。全国发行地方政府债券100亿元。")
  assert.equal(result.complete, true)
  assert.equal(result.records[0].issuance, 100)
  assert.equal(mofCoverage(result.records, 2026, "rate").complete, false)
})

test("an older MOF disclosure cannot overwrite a newer archived revision", async () => {
  const latest = record("2026-01-31", { issuance: 105, publishedAt: "2026-02-20" })
  const result = await refreshMofHistory({ records: [latest], startYear: 2026, errors: [] }, async url => url.endsWith("/tjsj/") ? '<li><a href="./test.htm">2026年1月地方政府债券发行情况</a></li>' : "全国发行地方政府债券100亿元。发布日期：2026年2月10日")
  assert.equal(result.records[0].issuance, 105)
  assert.equal(result.records[0].publishedAt, "2026-02-20")
})

test("Eastmoney rejects silent missing rows and moving pagination metadata", async () => {
  await assert.rejects(() => eastmoneyRows(BY_ID.pmi, mockFetch(() => ({ result: { pages: 1, count: 2, data: [{ REPORT_DATE: "2026-01-31", MAKE_INDEX: 50 }] } }))), /条数/)
  await assert.rejects(() => eastmoneyRows(BY_ID.pmi, mockFetch(url => {
    const page = Number(new URL(url).searchParams.get("pageNumber"))
    return { result: { pages: page === 1 ? 2 : 3, data: [{ REPORT_DATE: `2026-0${page}-01`, MAKE_INDEX: 50 }] } }
  })), /元数据变化/)
})

test("WDI rejects repeated history pages and a truncated count", async () => {
  const repeated = await getSeries("gdp", mockFetch(() => [{ pages: 2 }, [{ date: "2025", value: 5 }]]))
  assert.equal(repeated.status, "unavailable")
  assert.match(repeated.warning!, /同一页/)
  const truncated = await getSeries("gdp", mockFetch(() => [{ pages: 1, total: 2 }, [{ date: "2025", value: 5 }]]))
  assert.equal(truncated.status, "unavailable")
})

test("CSV never assigns the latest release date to earlier observations with unknown publication dates", () => {
  const data = { ...wrap([{ date: "2026-01-31", value: 1 }, { date: "2026-02-28", value: 2 }]), publishedAt: "2026-03-15" }
  const rows = csv(BY_ID.pmi, data).split("\n")
  assert.ok(rows[1].endsWith(',""'))
  assert.ok(rows[2].endsWith(',"2026-03-15"'))
})

test("252-observation drawdown requires its full stated window and rejects long gaps", () => {
  const points = Array.from({ length: 252 }, (_, i) => ({ date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), value: i === 0 ? 200 : 100 }))
  const now = new Date(points.at(-1)!.date)
  assert.equal(evaluate(BY_ID.equity, wrap(points), now).drawdown, -50)
  assert.equal(evaluate(BY_ID.equity, wrap(points.slice(1)), now).drawdown, null)
  const sparse = [{ ...points[0], date: "2024-01-01" }, ...points.slice(1)]
  assert.equal(evaluate(BY_ID.equity, wrap(sparse), now).drawdown, null)
})

test("annual period change does not compare two nonadjacent years", () => {
  const data = wrap([{ date: "2023-12-31", value: 5 }, { date: "2025-12-31", value: 6 }])
  assert.equal(evaluate(BY_ID.gdp, data, new Date("2026-01-01")).delta, null)
})

test("event windows reject calendar dates that JavaScript would silently normalize", () => {
  assert.equal(eventStudy([{ date: "2024-02-29", value: 100 }, { date: "2024-03-02", value: 110 }, { date: "2024-03-03", value: 120 }], "2024-02-31", 1), null)
})

test("equity series identifies the vendor actually used by a fallback", async () => {
  let pages = 0
  const result = await getSeries("equity", mockFetch(url => {
    if (url.includes("yahoo")) return { chart: { result: [] } }
    if (url.includes("push2his")) return ++pages === 1 ? { rc: 0, data: { klines: ["2026-10-16,100,110,115,95,100"] } } : { rc: 0, data: null }
    return {}
  }))
  assert.match(result.sourceUrl, /eastmoney\.com/)
  assert.ok(result.points.every(p => p.sourceUrl === result.sourceUrl))
  assert.equal(result.complete, false)
  assert.equal(result.status, "partial")
  assert.match(result.warning!, /不足1000条/)
})
