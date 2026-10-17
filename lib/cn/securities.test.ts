import test from "node:test"
import assert from "node:assert/strict"
import { CN_SECURITIES, getCnSecurities, parseTencentSecurityBatch, parseTencentSecurityQuote } from "./securities.ts"

const now = Date.parse("2026-10-18T10:00:00+08:00")
const bank = CN_SECURITIES.find(s => s.id === "sh600036")!
const etf = CN_SECURITIES.find(s => s.id === "sh510300")!
// Public quote field layout, with deliberately distinct static/dynamic/unknown PE.
function fixture(id = bank.id, edits: Record<number, string> = {}) {
  const security = CN_SECURITIES.find(s => s.id === id)!
  const fields = Array<string>(90).fill("")
  Object.assign(fields, {
    0: security.exchange === "SSE" ? "1" : "51", 1: "fixture-name", 2: security.code,
    3: "42.45", 4: "42.66", 30: "20261016161444", 32: "-0.49",
    35: "42.45/840913/3560858396", 36: "840913", 39: "7.06", 46: "0.93", 52: "7.00", 53: "7.13",
    61: security.kind === "stock" ? "GP-A" : "ETF", ...edits,
  })
  return fields.join("~")
}
function statement(id = bank.id, edits: Record<number, string> = {}) { return `v_${id}="${fixture(id, edits)}";` }

test("quote uses source timestamp, exact CNY turnover, lots converted to shares, and separately identified PB", () => {
  const quote = parseTencentSecurityQuote(fixture(), bank, now)
  assert.equal(quote.price, 42.45)
  assert.equal(quote.previousClose, 42.66)
  assert.equal(quote.changePercent, -0.49)
  assert.equal(quote.quotedAt, "2026-10-16T16:14:44+08:00")
  assert.equal(quote.volumeShares, 84091300)
  assert.equal(quote.turnoverCny, 3560858396)
  assert.equal(quote.pb, 0.93)
  assert.equal(quote.peTtm, null, "unverified PE basis must not be relabeled TTM")
  assert.equal(quote.freshness, "recent", "last Friday close remains recent on Sunday")
})

test("ETF vendor valuation fields are never presented as a fund's portfolio valuation", () => {
  const quote = parseTencentSecurityQuote(fixture(etf.id), etf, now)
  assert.equal(quote.pb, null)
  assert.equal(quote.peTtm, null)
})

test("bad identities, categories, prices and changed field layouts cannot become usable quotes", () => {
  const invalidFields: Record<number, string>[] = [{ 2: "600900" }, { 0: "51" }, { 61: "ETF" }, { 3: "0" }, { 3: "NaN" }, { 4: "" }, { 32: "12.2" }]
  for (const edits of invalidFields) {
    assert.throws(() => parseTencentSecurityQuote(fixture(bank.id, edits), bank, now))
  }
  assert.throws(() => parseTencentSecurityQuote(fixture(), { ...bank, id: "sh999999" }, now), /不支持/)
})

test("invalid calendar dates and future provider clocks are rejected; older quotes remain visibly stale", () => {
  assert.throws(() => parseTencentSecurityQuote(fixture(bank.id, { 30: "20260230150000" }), bank, now), /时间/)
  assert.throws(() => parseTencentSecurityQuote(fixture(bank.id, { 30: "20261019150000" }), bank, now), /时间/)
  assert.throws(() => parseTencentSecurityQuote(fixture(bank.id, { 30: "20261016250000" }), bank, now), /时间/)
  assert.equal(parseTencentSecurityQuote(fixture(bank.id, { 30: "20260930150000" }), bank, now).freshness, "stale")
})

test("missing or invalid optional data stays null rather than zero or an inferred valuation", () => {
  const quote = parseTencentSecurityQuote(fixture(bank.id, { 36: "--", 46: "-0.1" }), bank, now)
  assert.equal(quote.volumeShares, null)
  assert.equal(quote.turnoverCny, null)
  assert.equal(quote.pb, null)
  assert.equal(parseTencentSecurityQuote(fixture(bank.id, { 46: "0" }), bank, now).pb, null)
})

test("batch preserves catalog without fabricated quotes when source rows are missing or duplicated", () => {
  const items = parseTencentSecurityBatch(`${statement()}\n${statement(etf.id)}\n${statement(etf.id)}`, now)
  assert.equal(items.length, CN_SECURITIES.length)
  assert.equal(items.filter(item => item.quote).length, 1)
  assert.match(items.find(item => item.security.id === etf.id)!.error!, /重复/)
  assert.match(items.find(item => item.security.id === "sh600900")!.error!, /未返回/)
  assert.equal(parseTencentSecurityBatch("globalThis.untrustedScriptWasExecuted = true", now).filter(item => item.quote).length, 0)
})

test("fetch is a bounded whitelist batch and unavailable providers preserve official research links", async () => {
  let calls = 0
  const data = await getCnSecurities(async (input, init) => {
    calls++
    const url = new URL(String(input))
    assert.equal(url.hostname, "qt.gtimg.cn")
    assert.equal(url.pathname, "/q=" + CN_SECURITIES.map(s => s.id).join(","))
    assert.equal(init?.redirect, "error")
    assert.ok(init?.signal)
    return new Response("upstream failure", { status: 503 })
  }, now)
  assert.equal(calls, 1)
  assert.equal(data.status, "unavailable")
  assert.equal(data.items.length, 9)
  assert.ok(data.items.every(item => item.quote === null && item.security.officialUrl.startsWith("https://")))
  assert.equal(data.fetchedAt, new Date(now).toISOString())
})

test("partial, stale and fully available batches report distinct honest statuses", async () => {
  const partial = await getCnSecurities(async () => new Response(statement()), now)
  assert.equal(partial.status, "partial")
  assert.equal(partial.items.filter(item => item.quote).length, 1)
  const full = await getCnSecurities(async () => new Response(CN_SECURITIES.map(s => statement(s.id)).join("\n")), now)
  assert.equal(full.status, "ok")
  const stale = await getCnSecurities(async () => new Response(CN_SECURITIES.map(s => statement(s.id, { 30: "20260930150000" })).join("\n")), now)
  assert.equal(stale.status, "partial")
  assert.ok(stale.items.every(item => item.quote?.freshness === "stale"))
})

test("body limit is enforced even if the upstream omits content-length", async () => {
  const data = await getCnSecurities(async () => new Response("x".repeat(100001)), now)
  assert.equal(data.status, "unavailable")
  assert.ok(data.items.every(item => item.quote === null))
})
