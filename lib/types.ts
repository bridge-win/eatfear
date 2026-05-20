export interface CryptoAsset {
  symbol: string
  name: string
  price: number
  change24h: number
  changePercent24h: number
  volume24h?: number
  lastUpdate: number
}

export interface StockAsset {
  symbol: string
  name: string
  price: number
  changeToday: number
  changePercentToday: number
  volume: number
  lastUpdate: number
  /** Optional closing-price series for sparkline display (default 1y daily). */
  sparkline?: number[]
}

export type AssetType = "crypto" | "stock" | "hk_stock" | "vietnam_stock"

export interface CrashAlert {
  symbol: string
  name: string
  assetType: AssetType
  dropPercentage: number
  timeframe: string
  currentPrice: number
}

export interface FearGreedIndex {
  value: number
  classification: "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: number
}

export interface MarketStats {
  totalMarketCap: number
  marketCapChange24h: number
  volume24h: number
  btcDominance: number
  activeCryptos: number
}

export interface Subscription {
  id: string
  user_id: string
  asset_symbol: string
  asset_type: AssetType
  threshold_percentage: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MacroSeriesPoint {
  timestamp: number
  date: string
  value: number
}

export type MacroGroup =
  | "Rates"
  | "Inflation"
  | "Employment"
  | "Liquidity"
  | "Credit"
  | "Equity"
  | "Volatility"
  | "FX"
  | "Commodity"
  | "Growth"
  | "RealEstate"
  | "Sentiment"
  | "CrossAsset"

export type MacroUnit = "index" | "percent" | "usd" | "cny" | "ratio" | "count"

export type MacroDataSource =
  | "Yahoo Finance"
  | "FRED"

export interface MacroIndicator {
  symbol: string
  name: string
  group: MacroGroup
  unit: MacroUnit
  source: MacroDataSource
  value: number
  change: number
  changePercent: number
  lastUpdate: number
  history: MacroSeriesPoint[]
  description?: string
  audience?: string[]
  /** Lower number = more important. Used for sorting on the Macro dashboard. */
  priority?: number
  /** Lower number = visible display order after dashboard config is applied. */
  displayOrder?: number
  /** Polling interval requested by the dashboard config. */
  refreshMs?: number
  /** Optional dashboard color override. */
  color?: string
  /** Plain-language investor rank bucket, if this indicator maps to the macro priority playbook. */
  macroRank?: number
  /** Plain-language investor category, e.g. "1 利率 / 央行政策". */
  macroCategory?: string
  /** What the indicator is meant to explain for investors. */
  meaning?: string
  /** Typical asset-market direction when the indicator rises/falls. */
  impact?: string
  /** Extra source coverage note, such as lagged annual data or proxy coverage. */
  sourceNote?: string
  /** Refresh frequency hint shown to users */
  frequency?: string
}

export interface CryptoInstrument {
  instId: string
  base: string
  quote: string
  label: string
}

export interface MarketNewsArticle {
  title: string
  url: string
  domain: string
  sourceCountry: string
  language: string
  publishedAt: string
  imageUrl?: string
  tone?: number
}
