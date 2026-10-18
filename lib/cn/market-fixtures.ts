import type { MarketRow, MarketSnapshot, SnapshotContext } from "./market-types.ts"
import { addPeerValuations, coverageOf } from "./market-model.ts"
export function marketRow(overrides: Partial<MarketRow> = {}): MarketRow {
  return { id: "sh600001", code: "600001", secucode: "600001.SH", exchange: "SSE", name: "测试公司", industryCode: "equipment", industry: "通用设备", financial: false, identityVerified: true, listingVerified: true, listingStatus: "listed", officialUrl: "https://www.cninfo.com.cn/", orgId: "org1", st: false, quoteDate: "2026-10-16", price: 10, peTtm: 10, pb: 1, marketCap: 1e10, reportDate: "2026-06-30", publishedAt: "2026-08-20", annualReportDate: "2025-12-31", annualPublishedAt: "2026-04-20", annualRoe: 12, revenue: 1.2e9, previousRevenue: 1e9, revenueGrowth: 20, netIncome: 1.2e8, previousNetIncome: 1e8, profitGrowth: 20, profitState: "profit", operatingCashFlow: 2e8, previousOperatingCashFlow: 1e8, totalAssets: 1e10, totalLiabilities: 4e9, debtRatio: 40, pePercentile: 20, pePeers: 20, flags: [], ...overrides }
}
export function marketSnapshot(rows = [marketRow()]): MarketSnapshot {
  return { schemaVersion: 1, snapshotId: "cn-20261016-0123456789ab", fetchedAt: "2026-10-18T01:00:00Z", tradeDate: "2026-10-16", reportDate: "2026-06-30", comparisonDate: "2025-06-30", annualReportDate: "2025-12-31", rows, coverage: coverageOf(rows), sources: [], macro: {}, warnings: [] }
}
export function context(snapshot = marketSnapshot()): SnapshotContext {
  return { snapshot, mode: "archive", warning: null, health: { status: "ok", lastAttemptAt: snapshot.fetchedAt, lastSuccessAt: snapshot.fetchedAt, errors: [], runUrl: null } }
}
export function peerRows(count: number) { return addPeerValuations(Array.from({ length: count }, (_, i) => marketRow({ id: `sh${600000 + i}`, code: String(600000 + i), secucode: `${600000 + i}.SH`, peTtm: i + 1 }))) }
