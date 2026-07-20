export type SmartMoneyVenue =
  | "okx"
  | "binance"
  | "hyperliquid"
  | "polymarket"
  | "nansen"
  | "arkham"
  | "cielo"

export type DataFreshness = "live" | "fresh" | "delayed" | "stale" | "unavailable"
export type VerificationClass = "settled" | "reported" | "attributed" | "inferred"

export interface DataProvenance {
  sourceId: string
  sourceName: string
  sourceType: "first_party" | "licensed" | "derived"
  sourceUrl: string
  eventAt: number | null
  observedAt: number
  freshness: DataFreshness
  freshnessMs: number | null
  verification: VerificationClass
  confidence: number
  limitations: string[]
}

export type SmartMoneyQualityCategory = "elite" | "proven" | "watch" | "unranked"
export type SmartMoneyQualityConfidence = "high" | "medium" | "low"

export interface SmartMoneyQualityComponent {
  key: "pnl" | "roi" | "winRate" | "drawdown" | "activeDays" | "capital" | "completeness"
  score: number
  weight: number
}

export interface SmartMoneyQuality {
  version: "actor-quality-v1"
  score: number
  copyabilityScore: number
  category: SmartMoneyQualityCategory
  confidence: SmartMoneyQualityConfidence
  coverage: number
  components: SmartMoneyQualityComponent[]
  flags: string[]
}

export interface SmartMoneyActorMetrics {
  rank: number | null
  pnlUsd: number | null
  roiPct: number | null
  winRatePct: number | null
  maxDrawdownPct: number | null
  accountValueUsd: number | null
  volumeUsd: number | null
  followers: number | null
  maxFollowers: number | null
  capacityUsedPct: number | null
  activeDays: number | null
}

export interface SmartMoneyActor {
  id: string
  venue: SmartMoneyVenue
  name: string
  address: string | null
  avatarUrl: string | null
  profileUrl: string
  categories: string[]
  metrics: SmartMoneyActorMetrics
  quality: SmartMoneyQuality
  provenance: DataProvenance
}

export type SmartMoneyAction = "buy" | "sell" | "long" | "short" | "close" | "transfer" | "deposit" | "withdraw"

export interface SmartMoneyEvent {
  id: string
  actorId: string
  actorName: string
  address: string | null
  venue: SmartMoneyVenue
  action: SmartMoneyAction
  asset: string
  market: string
  amountUsd: number | null
  priceUsd: number | null
  pnlUsd: number | null
  transactionId: string | null
  verificationUrl: string
  qualification: "ranked" | "observed_large_trade"
  provenance: DataProvenance
}

export interface SmartMoneySourceHealth {
  sourceId: string
  name: string
  status: "operational" | "degraded" | "unavailable" | "not_configured"
  latencyMs: number | null
  lastSuccessAt: number | null
  message: string
  sourceUrl: string
}

export interface SmartMoneyConsensusAsset {
  asset: string
  buyers: number
  sellers: number
  netActors: number
  buyUsd: number
  sellUsd: number
}

export interface SmartMoneyConsensus {
  direction: "buying" | "selling" | "mixed" | "insufficient"
  buyers: number
  sellers: number
  buyUsd: number
  sellUsd: number
  venueCount: number
  actorCount: number
  coverage: number
  assets: SmartMoneyConsensusAsset[]
}

export interface ActorSourceResult {
  sourceId: string
  actors: SmartMoneyActor[]
  health: SmartMoneySourceHealth
}

export interface EventSourceResult {
  sourceId: string
  events: SmartMoneyEvent[]
  health: SmartMoneySourceHealth
}

export interface OkxActorInput {
  uniqueCode?: string
  nickName?: string
  portLink?: string
  pnl?: string | number
  pnlRatio?: string | number
  winRatio?: string | number
  aum?: string | number
  leadDays?: string | number
  copyTraderNum?: string | number
  maxCopyTraderNum?: string | number
  traderInsts?: string[]
}

export interface BinanceActorInput {
  leadPortfolioId?: string | number
  nickname?: string
  avatarUrl?: string
  roi?: string | number | null
  pnl?: string | number | null
  aum?: string | number | null
  aumAmount?: string | number | null
  mdd?: string | number | null
  winRate?: string | number | null
  currentCopyCount?: string | number | null
  maxCopyCount?: string | number | null
  startTime?: string | number | null
}

export interface PolymarketActorInput {
  rank?: string | number
  proxyWallet?: string
  userName?: string
  xUsername?: string
  verifiedBadge?: boolean
  vol?: string | number
  pnl?: string | number
  profileImage?: string
}

export interface HyperliquidPerformanceInput {
  pnl?: string | number
  roi?: string | number
  vlm?: string | number
}

export interface HyperliquidActorInput {
  ethAddress?: string
  accountValue?: string | number
  displayName?: string
  windowPerformances?: [string, HyperliquidPerformanceInput][]
}

export interface PolymarketTradeInput {
  proxyWallet?: string
  side?: string
  asset?: string
  conditionId?: string
  size?: string | number
  price?: string | number
  timestamp?: string | number
  title?: string
  slug?: string
  outcome?: string
  name?: string
  pseudonym?: string
  transactionHash?: string
}

export interface HyperliquidTradeInput {
  coin?: string
  side?: string
  px?: string | number
  sz?: string | number
  time?: string | number
  hash?: string
  tid?: string | number
  users?: [string, string]
}
