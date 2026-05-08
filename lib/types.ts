export interface CryptoAsset {
  symbol: string
  name: string
  price: number
  change24h: number
  changePercent24h: number
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
