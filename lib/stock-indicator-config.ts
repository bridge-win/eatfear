import { STOCK_CATEGORIES } from "@/lib/stock-service"

export type StockIndicatorKind = "macro" | "stock"
export type StockIndicatorGroup = "macro" | "us" | "hk" | "vietnam"

export interface StockIndicatorConfig {
  key: string
  symbol: string
  kind: StockIndicatorKind
  group: StockIndicatorGroup
  enabled: boolean
  order: number
  refreshMs: number
  label?: string
  description?: string
  source?: string
}

export const DEFAULT_STOCK_REFRESH_MS = 60_000
export const DEFAULT_STOCK_MACRO_REFRESH_MS = 300_000

const STOCK_MACRO_SYMBOLS = [
  "ES=F",
  "NQ=F",
  "^GSPC",
  "^NDX",
  "^IXIC",
  "^RUT",
  "^SOX",
  "SMH",
  "XLK",
  "XLF",
  "KRE",
  "XLE",
  "^VIX",
  "^VXN",
  "^VVIX",
  "^SKEW",
  "FRED:DGS10",
  "FRED:DGS2",
  "FRED:T10Y2Y",
  "FRED:DFII10",
  "FRED:BAMLH0A0HYM2",
  "FRED:NFCI",
  "DX-Y.NYB",
  "HYG",
  "LQD",
  "TLT",
  "^DJI",
  "^HSI",
  "^N225",
  "GC=F",
  "CL=F",
  "HG=F",
] as const

const stockConfigs = [
  ...STOCK_CATEGORIES.us.stocks.map((stock, index) => ({
    key: `stock:${stock.symbol}`,
    symbol: stock.symbol,
    kind: "stock" as const,
    group: "us" as const,
    enabled: true,
    order: 1_000 + index * 10,
    refreshMs: DEFAULT_STOCK_REFRESH_MS,
    label: stock.name,
    source: "Yahoo Finance",
  })),
  ...STOCK_CATEGORIES.hk.stocks.map((stock, index) => ({
    key: `stock:${stock.symbol}`,
    symbol: stock.symbol,
    kind: "stock" as const,
    group: "hk" as const,
    enabled: true,
    order: 2_000 + index * 10,
    refreshMs: DEFAULT_STOCK_REFRESH_MS,
    label: stock.name,
    source: "Yahoo Finance",
  })),
  ...STOCK_CATEGORIES.vietnam.stocks.map((stock, index) => ({
    key: `stock:${stock.symbol}`,
    symbol: stock.symbol,
    kind: "stock" as const,
    group: "vietnam" as const,
    enabled: true,
    order: 3_000 + index * 10,
    refreshMs: DEFAULT_STOCK_REFRESH_MS,
    label: stock.name,
    source: "Yahoo Finance",
  })),
]

// Edit this file to control Stock page indicator visibility, order, refresh
// cadence, and visible copy. Both realtime cards and history charts use it.
export const STOCK_INDICATOR_CONFIG: readonly StockIndicatorConfig[] = [
  ...STOCK_MACRO_SYMBOLS.map((symbol, index) => ({
    key: `macro:${symbol}`,
    symbol,
    kind: "macro" as const,
    group: "macro" as const,
    enabled: true,
    order: 10 + index * 10,
    refreshMs: symbol.startsWith("FRED:") ? DEFAULT_STOCK_MACRO_REFRESH_MS : DEFAULT_STOCK_REFRESH_MS,
  })),
  ...stockConfigs,
]

export function getEnabledStockIndicators(): StockIndicatorConfig[] {
  return STOCK_INDICATOR_CONFIG.filter((entry) => entry.enabled).sort((a, b) => {
    const orderDelta = a.order - b.order
    if (orderDelta !== 0) return orderDelta
    return a.key.localeCompare(b.key)
  })
}

export function getEnabledStockSymbols(group: Exclude<StockIndicatorGroup, "macro">): string[] {
  return getEnabledStockIndicators()
    .filter((entry) => entry.kind === "stock" && entry.group === group)
    .map((entry) => entry.symbol)
}
