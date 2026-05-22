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
  /** 0-100 relevance score from factor literature plus practical market coverage. */
  relevanceScore?: number
}

export const DEFAULT_STOCK_REFRESH_MS = 60_000
export const DEFAULT_STOCK_MACRO_REFRESH_MS = 300_000

interface StockMacroSymbolConfig {
  symbol: string
  relevanceScore: number
}

const STOCK_MACRO_SYMBOLS: readonly StockMacroSymbolConfig[] = [
  { symbol: "ES=F", relevanceScore: 100 },
  { symbol: "NQ=F", relevanceScore: 98 },
  { symbol: "^GSPC", relevanceScore: 97 },
  { symbol: "^NDX", relevanceScore: 96 },
  { symbol: "^IXIC", relevanceScore: 94 },
  { symbol: "^RUT", relevanceScore: 92 },
  { symbol: "^SOX", relevanceScore: 88 },
  { symbol: "SMH", relevanceScore: 86 },
  { symbol: "XLK", relevanceScore: 84 },
  { symbol: "XLF", relevanceScore: 80 },
  { symbol: "KRE", relevanceScore: 76 },
  { symbol: "XLE", relevanceScore: 74 },
  { symbol: "^VIX", relevanceScore: 91 },
  { symbol: "^VXN", relevanceScore: 83 },
  { symbol: "^VVIX", relevanceScore: 78 },
  { symbol: "^SKEW", relevanceScore: 72 },
  { symbol: "FRED:DGS10", relevanceScore: 90 },
  { symbol: "FRED:DGS2", relevanceScore: 86 },
  { symbol: "FRED:T10Y2Y", relevanceScore: 82 },
  { symbol: "FRED:DFII10", relevanceScore: 84 },
  { symbol: "FRED:BAMLH0A0HYM2", relevanceScore: 81 },
  { symbol: "FRED:NFCI", relevanceScore: 79 },
  { symbol: "DX-Y.NYB", relevanceScore: 85 },
  { symbol: "HYG", relevanceScore: 80 },
  { symbol: "LQD", relevanceScore: 74 },
  { symbol: "TLT", relevanceScore: 78 },
  { symbol: "^DJI", relevanceScore: 73 },
  { symbol: "^HSI", relevanceScore: 70 },
  { symbol: "^N225", relevanceScore: 68 },
  { symbol: "GC=F", relevanceScore: 66 },
  { symbol: "CL=F", relevanceScore: 64 },
  { symbol: "HG=F", relevanceScore: 63 },
] as const

const QUANT_FACTOR_ETFS: readonly Omit<StockIndicatorConfig, "key" | "kind" | "group" | "enabled" | "refreshMs">[] = [
  {
    symbol: "MTUM",
    order: 65,
    label: "Momentum Factor ETF",
    source: "Yahoo Finance",
    relevanceScore: 96,
    description:
      "Meaning: tradeable U.S. equity momentum proxy. Evidence base: Jegadeesh-Titman cross-sectional momentum and Carhart-style momentum factor usage.\nImpact: outperformance usually means trend/risk leadership is concentrated in recent winners.",
  },
  {
    symbol: "VLUE",
    order: 75,
    label: "Value Factor ETF",
    source: "Yahoo Finance",
    relevanceScore: 91,
    description:
      "Meaning: tradeable U.S. equity value proxy. Evidence base: Fama-French value factor and later multi-factor models.\nImpact: value strength usually means discount-rate sensitivity is easing or cyclicals/financials are leading.",
  },
  {
    symbol: "QUAL",
    order: 85,
    label: "Quality Factor ETF",
    source: "Yahoo Finance",
    relevanceScore: 89,
    description:
      "Meaning: profitability/quality proxy. Evidence base: Novy-Marx gross profitability and Fama-French profitability factor.\nImpact: quality leadership means investors prefer resilient balance sheets and durable margins.",
  },
  {
    symbol: "USMV",
    order: 95,
    label: "Minimum Volatility ETF",
    source: "Yahoo Finance",
    relevanceScore: 86,
    description:
      "Meaning: low-volatility / defensive factor proxy. Evidence base: low-beta and betting-against-beta literature.\nImpact: USMV leadership usually signals defensive positioning or tighter risk budgets.",
  },
  {
    symbol: "IWM",
    order: 105,
    label: "Small Cap Proxy",
    source: "Yahoo Finance",
    relevanceScore: 85,
    description:
      "Meaning: liquid small-cap beta proxy for size and financing sensitivity.\nImpact: small-cap leadership indicates broader risk appetite; underperformance warns about credit/growth stress.",
  },
  {
    symbol: "RSP",
    order: 115,
    label: "Equal Weight Breadth Proxy",
    source: "Yahoo Finance",
    relevanceScore: 82,
    description:
      "Meaning: equal-weight S&P 500 proxy used to compare breadth against cap-weighted SPY.\nImpact: RSP strength means participation is broad; weakness means index gains are concentrated in mega caps.",
  },
  {
    symbol: "SPHB",
    order: 125,
    label: "High Beta Factor ETF",
    source: "Yahoo Finance",
    relevanceScore: 78,
    description:
      "Meaning: high-beta risk appetite proxy.\nImpact: high-beta leadership confirms risk-on regimes; sharp underperformance warns that leverage and cyclicals are being cut.",
  },
  {
    symbol: "SPLV",
    order: 135,
    label: "Low Volatility Factor ETF",
    source: "Yahoo Finance",
    relevanceScore: 77,
    description:
      "Meaning: alternate low-volatility proxy for defensive equity factor exposure.\nImpact: SPLV leadership usually indicates defensive rotation.",
  },
]

function getStockAssetRelevanceScore(symbol: string, group: StockIndicatorGroup, index: number): number {
  if (group === "us") {
    if (symbol === "SPY") return 97
    if (symbol === "QQQ") return 96
    if (symbol === "DIA") return 73
    return Math.max(55, 76 - Math.floor(index / 4))
  }
  if (group === "hk") return Math.max(50, 70 - Math.floor(index / 3))
  return Math.max(48, 66 - Math.floor(index / 3))
}

const stockConfigs = [
  ...QUANT_FACTOR_ETFS.map((config) => ({
    key: `stock:${config.symbol}`,
    symbol: config.symbol,
    kind: "stock" as const,
    group: "us" as const,
    enabled: true,
    order: config.order,
    refreshMs: DEFAULT_STOCK_REFRESH_MS,
    label: config.label,
    description: config.description,
    source: config.source,
    relevanceScore: config.relevanceScore,
  })),
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
    relevanceScore: getStockAssetRelevanceScore(stock.symbol, "us", index),
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
    relevanceScore: getStockAssetRelevanceScore(stock.symbol, "hk", index),
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
    relevanceScore: getStockAssetRelevanceScore(stock.symbol, "vietnam", index),
  })),
]

// Edit this file to control Stock page indicator visibility, order, refresh
// cadence, and visible copy. Both realtime cards and history charts use it.
export const STOCK_INDICATOR_CONFIG: readonly StockIndicatorConfig[] = [
  ...STOCK_MACRO_SYMBOLS.map((config, index) => ({
    key: `macro:${config.symbol}`,
    symbol: config.symbol,
    kind: "macro" as const,
    group: "macro" as const,
    enabled: true,
    order: 10 + index * 10,
    refreshMs: config.symbol.startsWith("FRED:") ? DEFAULT_STOCK_MACRO_REFRESH_MS : DEFAULT_STOCK_REFRESH_MS,
    relevanceScore: config.relevanceScore,
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
