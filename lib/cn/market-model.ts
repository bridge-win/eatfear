import type { Coverage, MarketRow, MarketSnapshot, ProfitState } from "./market-types.ts"

export const MARKET_SCHEMA = 1
export const SNAPSHOT_ID = /^cn-\d{8}-[a-f0-9]{12}$/
export const dateOnly = (raw: unknown): string | null => {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|[ T])/.test(raw)) return null
  const s = raw.slice(0, 10), t = Date.parse(`${s}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s ? s : null
}
export function finite(raw: unknown): number | null {
  if (typeof raw !== "number" && (typeof raw !== "string" || !/^-?\d+(?:\.\d+)?$/.test(raw))) return null
  const n = Number(raw); return Number.isFinite(n) ? n : null
}
export function yoy(current: number | null, previous: number | null) { return current !== null && previous !== null && previous > 0 ? (current / previous - 1) * 100 : null }
export function profitState(current: number | null, previous: number | null): ProfitState {
  if (current === null) return "unknown"
  if (current > 0) return previous !== null && previous <= 0 ? "turnaround" : "profit"
  if (previous !== null && previous < 0 && current <= 0) return current > previous ? "loss-narrowing" : "loss-widening"
  return "loss"
}
/** Compare complete reporting seasons; do not mix an early reporter with the previous season. */
export function reportingPeriods(now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10)
  const year = Number(today.slice(0, 4)), md = today.slice(5)
  const reportDate = md >= "11-01" ? `${year}-09-30` : md >= "09-01" ? `${year}-06-30` : md >= "05-01" ? `${year}-03-31` : `${year - 1}-09-30`
  return { reportDate, comparisonDate: `${Number(reportDate.slice(0, 4)) - 1}${reportDate.slice(4)}`, annualReportDate: `${md >= "05-01" ? year - 1 : year - 2}-12-31` }
}
export const isFinancialIndustry = (name: string | null) => !!name && /银行|证券|保险|多元金融/.test(name)
export function addPeerValuations(rows: MarketRow[]) {
  const groups = new Map<string, number[]>()
  for (const r of rows) if (r.identityVerified && r.industryCode && r.quoteDate && r.peTtm !== null && r.peTtm > 0 && !r.st && r.listingStatus !== "delisted") {
    const key = `${r.quoteDate}:${r.industryCode}`; const list = groups.get(key) ?? []; list.push(r.peTtm); groups.set(key, list)
  }
  for (const r of rows) {
    const peers = groups.get(`${r.quoteDate}:${r.industryCode}`) ?? []
    r.pePeers = peers.length
    r.pePercentile = peers.length >= 10 && r.identityVerified && r.peTtm !== null && r.peTtm > 0 && !r.st && r.listingStatus !== "delisted" ? 100 * (peers.filter(p => p < r.peTtm!).length + peers.filter(p => p === r.peTtm).length / 2) / peers.length : null
  }
  return rows
}
export function coverageOf(rows: MarketRow[]): Coverage {
  return { universe: rows.length, identityVerified: rows.filter(r => r.identityVerified).length, listingVerified: rows.filter(r => r.listingVerified).length, valuation: rows.filter(r => r.price !== null).length, financials: rows.filter(r => r.reportDate !== null && r.netIncome !== null && r.revenue !== null).length, screenable: rows.filter(r => r.identityVerified && r.listingStatus !== "delisted" && r.price !== null && r.reportDate !== null && r.netIncome !== null && r.revenue !== null).length, exchanges: { SSE: rows.filter(r => r.exchange === "SSE").length, SZSE: rows.filter(r => r.exchange === "SZSE").length, BSE: rows.filter(r => r.exchange === "BSE").length } }
}
/** Fail closed before a snapshot reaches the public filter engine. */
export function validateSnapshot(input: unknown): asserts input is MarketSnapshot {
  const s = input as MarketSnapshot
  if (!s || s.schemaVersion !== 1 || !SNAPSHOT_ID.test(s.snapshotId) || !dateOnly(s.tradeDate) || !dateOnly(s.reportDate) || !dateOnly(s.comparisonDate) || !dateOnly(s.annualReportDate) || !Number.isFinite(Date.parse(s.fetchedAt)) || !Array.isArray(s.rows) || s.rows.length < 1 || s.rows.length > 15000 || !Array.isArray(s.sources) || !s.macro || typeof s.macro !== "object" || !Array.isArray(s.warnings)) throw new Error("快照格式无效")
  const ids = new Set<string>(), today = new Date(Date.parse(s.fetchedAt) + 8 * 3600000).toISOString().slice(0, 10)
  if (s.tradeDate > today || s.reportDate > today || s.annualReportDate > today) throw new Error("快照包含未来日期")
  const numeric = ["price", "peTtm", "pb", "marketCap", "annualRoe", "revenue", "previousRevenue", "revenueGrowth", "netIncome", "previousNetIncome", "profitGrowth", "operatingCashFlow", "previousOperatingCashFlow", "totalAssets", "totalLiabilities", "debtRatio", "pePercentile"] as const
  for (const r of s.rows) {
    const prefix = r.exchange === "SSE" ? "sh" : r.exchange === "SZSE" ? "sz" : r.exchange === "BSE" ? "bj" : null
    const suffix = r.exchange === "SSE" ? "SH" : r.exchange === "SZSE" ? "SZ" : "BJ"
    if (!prefix || !/^\d{6}$/.test(r.code) || r.id !== prefix + r.code || r.secucode !== `${r.code}.${suffix}` || ids.has(r.id) || typeof r.name !== "string" || !r.name || r.name.length > 100 || !Array.isArray(r.flags) || r.flags.some(f => typeof f !== "string") || [r.identityVerified, r.listingVerified, r.st, r.financial].some(b => typeof b !== "boolean") || !["listed", "delisted", "unconfirmed"].includes(r.listingStatus) || numeric.some(k => r[k] !== null && !Number.isFinite(r[k]))) throw new Error("证券记录结构或身份冲突")
    if (r.quoteDate !== null && r.quoteDate !== s.tradeDate || r.reportDate !== null && r.reportDate !== s.reportDate || r.annualReportDate !== s.annualReportDate || r.publishedAt && (!dateOnly(r.publishedAt) || r.publishedAt > today || r.publishedAt < s.reportDate) || r.annualPublishedAt && (!dateOnly(r.annualPublishedAt) || r.annualPublishedAt > today || r.annualPublishedAt < s.annualReportDate)) throw new Error("证券记录时间错配")
    if (r.price !== null && r.price <= 0 || r.pePercentile !== null && (r.pePercentile < 0 || r.pePercentile > 100)) throw new Error("证券记录数值无效")
    if (!/^https:\/\/(www\.cninfo\.com\.cn|www\.sse\.com\.cn|www\.szse\.cn)\//.test(r.officialUrl)) throw new Error("证券官方链接无效")
    ids.add(r.id)
  }
  if (JSON.stringify(coverageOf(s.rows)) !== JSON.stringify(s.coverage)) throw new Error("快照覆盖计数不一致")
}
