import type { SeriesData } from "./catalog.ts"

export type Exchange = "SSE" | "SZSE" | "BSE"
export type Theme = "all" | "debt" | "consumption" | "industry" | "rates" | "broad"
export type Preset = "value" | "improving" | "financial" | "custom"
export type ProfitState = "profit" | "loss" | "turnaround" | "loss-narrowing" | "loss-widening" | "unknown"
export type SourceHealth = { id: string; name: string; url: string; status: "ok" | "partial" | "unavailable"; count: number; note: string }
export type MarketRow = {
  id: string; code: string; secucode: string; exchange: Exchange; name: string
  industryCode: string | null; industry: string | null; financial: boolean
  identityVerified: boolean; listingVerified: boolean; listingStatus: "listed" | "delisted" | "unconfirmed"
  officialUrl: string; orgId: string | null; st: boolean
  quoteDate: string | null; price: number | null; peTtm: number | null; pb: number | null; marketCap: number | null
  reportDate: string | null; publishedAt: string | null; annualReportDate: string; annualPublishedAt: string | null
  annualRoe: number | null; revenue: number | null; previousRevenue: number | null; revenueGrowth: number | null
  netIncome: number | null; previousNetIncome: number | null; profitGrowth: number | null; profitState: ProfitState
  operatingCashFlow: number | null; previousOperatingCashFlow: number | null
  totalAssets: number | null; totalLiabilities: number | null; debtRatio: number | null
  pePercentile: number | null; pePeers: number; flags: string[]
}
export type Coverage = { universe: number; identityVerified: number; listingVerified: number; valuation: number; financials: number; screenable: number; exchanges: Record<Exchange, number> }
export type MarketSnapshot = {
  schemaVersion: 1; snapshotId: string; fetchedAt: string; tradeDate: string; reportDate: string; comparisonDate: string; annualReportDate: string
  coverage: Coverage; sources: SourceHealth[]; rows: MarketRow[]; macro: Record<string, SeriesData>; warnings: string[]
}
export type SnapshotEntry = { snapshotId: string; file: string; sha256: string; compressedBytes: number; uncompressedBytes: number; tradeDate: string; fetchedAt: string }
export type SnapshotManifest = { schemaVersion: 1; current: string; snapshots: SnapshotEntry[] }
export type CollectionHealth = { lastAttemptAt: string; lastSuccessAt: string | null; status: "ok" | "failed" | "unknown"; errors: string[]; runUrl: string | null }
export type SnapshotContext = { snapshot: MarketSnapshot; mode: "remote" | "archive"; health: CollectionHealth; warning: string | null }
export type ScreenFilters = {
  preset: Preset; theme: Theme; exchange: Exchange | "all"; industry: string; search: string
  peMin: number | null; peMax: number | null; pbMin: number | null; pbMax: number | null; pePercentileMax: number | null
  roeMin: number | null; revenueGrowthMin: number | null; profitGrowthMin: number | null; debtRatioMax: number | null
  cashFlow: "any" | "positive" | "improving"; sector: "all" | "nonfinancial" | "financial"
  profit: "any" | "positive" | "loss" | "turnaround"; excludeSt: boolean
  sort: "pePercentile" | "profitGrowth" | "pb" | "peTtm" | "annualRoe" | "marketCap"; direction: "asc" | "desc"
  page: number; pageSize: number
}
export type EvidenceConclusion = { kind: "business" | "valuation" | "match" | "risk" | "missing"; text: string; fields: string[]; period: string | null; sourceUrl: string; references?: { label: string; period: string; url: string }[] }
export type ScreenItem = { row: MarketRow; conclusions: EvidenceConclusion[]; themeReason: string | null }
export type ScreenResult = {
  snapshotId: string; tradeDate: string; reportDate: string; annualReportDate: string; fetchedAt: string
  mode: SnapshotContext["mode"]; health: CollectionHealth; warning: string | null; coverage: Coverage; sources: SourceHealth[]
  filters: ScreenFilters; total: number; page: number; pageSize: number; pages: number
  items: ScreenItem[]; excluded: { reason: string; count: number }[]; industries: { code: string; name: string }[]
}
