export type DiscoverStrategy = "cash_secured_put" | "covered_call"

export type DiscoverAssetType = "ETF" | "Stock"

export type DiscoverRiskBand = "low" | "moderate" | "elevated"

export type DiscoverConfidence = "high" | "medium" | "low"

export interface DiscoverUniverseEntry {
  symbol: string
  name: string
  assetType: DiscoverAssetType
  sector: string
  quality: "broad_index" | "sector_etf" | "cash_etf" | "mega_cap" | "dividend_quality"
}

export interface StableYieldAssetEntry {
  symbol: string
  name: string
  category: string
  issuer: string
  sourceUrl: string
  yieldOffsetPct: number
  liquidity: string
  principalRisk: string
  issuerObjective: string
  riskClass: "treasury_cash" | "floating_treasury" | "ultrashort_credit"
}

export interface DiscoverCandidate {
  symbol: string
  name: string
  assetType: DiscoverAssetType
  sector: string
  strategy: DiscoverStrategy
  strategyLabel: string
  price: number
  strike: number
  expirationDate: string
  daysToExpiration: number
  premiumEstimate: number
  annualizedYieldPct: number
  bufferPct: number
  breakeven: number
  realizedVolatilityPct: number
  maxDrawdownPct: number
  trendScore: number
  riskScore: number
  riskBand: DiscoverRiskBand
  confidence: DiscoverConfidence
  reasons: string[]
  cautions: string[]
  data: {
    priceSource: string
    premiumSource: "model_estimate" | "live_chain"
    premiumSourceLabel: string
    optionSymbol: string | null
    optionBid: number | null
    optionAsk: number | null
    optionVolume: number | null
    optionOpenInterest: number | null
    optionSpreadPct: number | null
    optionSourceUrl: string | null
    optionQuoteTime: number | null
    asOf: number
  }
}

export interface StableYieldIdea {
  id: string
  name: string
  category: string
  estimatedAnnualYieldPct: number
  riskBand: DiscoverRiskBand
  liquidity: string
  principalRisk: string
  access: string
  taxNotes: string
  whyItBelongs: string[]
  watchouts: string[]
  sourceUrl: string
}

export interface StableYieldAsset {
  symbol: string
  name: string
  category: string
  issuer: string
  price: number
  changePct: number
  estimatedAnnualYieldPct: number
  realizedVolatilityPct: number
  maxDrawdownPct: number
  riskScore: number
  riskBand: DiscoverRiskBand
  liquidity: string
  principalRisk: string
  reasons: string[]
  cautions: string[]
  sourceUrl: string
  data: {
    priceSource: string
    issuerSource: string
    asOf: number
  }
}

export interface DiscoverSourceStatus {
  id: string
  name: string
  status: "operational" | "degraded"
  url: string
  note: string
}

export interface DiscoverResponse {
  updatedAt: number
  nextUpdateAt: number
  minAnnualizedYieldPct: number
  riskPolicy: string
  treasuryBillProxyRatePct: number | null
  candidates: DiscoverCandidate[]
  stableYieldAssets: StableYieldAsset[]
  stableYieldIdeas: StableYieldIdea[]
  sources: DiscoverSourceStatus[]
  limitations: string[]
}
