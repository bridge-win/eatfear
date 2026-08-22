export type CryptoIndicatorUnit = "usd" | "cny" | "pct" | "ratio" | "raw" | "count"
export type CryptoIndicatorGroup =
  | "strategySignals"
  | "priceAnchors"
  | "priceDeviation"
  | "trendStructure"
  | "trendStrength"
  | "volatilityPrice"
  | "volatilityNormalized"
  | "volumeActivity"
  | "orderFlow"
  | "fundingRates"
  | "fundingExtremes"
  | "openInterestLevel"
  | "openInterestChange"
  | "openInterestCrowding"
  | "traderPositioning"
  | "liquidationFlow"
  | "liquidationStress"
  | "marketLiquidity"
  | "executionStress"
  | "eventLifecycle"
  | "sentiment"
  | "smartMoney"
  | "onchainActivity"
  | "networkSecurity"
  | "minerEconomics"
  | "cryptoCrossSection"
  | "macroEquities"
  | "macroRates"
  | "commodities"
  | "manipulation"
  | "customSignals"
  | "strategyCore"
  | "wickConfirmation"
  | "crowdingContext"
  | "signals"
  | "price"
  | "volume"
  | "derivatives"
  | "liquidations"
  | "orderbook"
  | "regime"
  | "secondary"

export interface CryptoIndicatorConfig {
  /** Stable series key; this must match the key generated in the history API. */
  key: string
  /** Set to false to hide this indicator from both realtime cards and history charts. */
  enabled: boolean
  /** Lower numbers display first. Grouped by BTC analysis effectiveness: S → A → B → C → custom signals. */
  order: number
  /** Client polling interval for this indicator. The dashboard uses the fastest enabled interval. */
  refreshMs: number
  /** Locale key for the visible label. */
  i18nKey: string
  /** Locale key for the info popover body. */
  infoI18nKey: string
  /** User-facing source shown in info popovers. */
  source: string
  /** Chart/card color. */
  color: string
  /** Unit used by card, tooltip, and chart formatting. */
  unit: CryptoIndicatorUnit
  /** 0-100 relevance score from academic evidence plus practical trading coverage. */
  relevanceScore?: number
  /** Market-mechanism grouping used by the history view. */
  group?: CryptoIndicatorGroup
  /** Core metrics load first; secondary context stays below the strategy layer. */
  tier?: "core" | "secondary"
}

export const DEFAULT_CRYPTO_HISTORY_REFRESH_MS = 300_000

const CRYPTO_RELEVANCE_SCORES: Record<string, number> = {
  dev: 100,
  atr60: 100,
  vel5: 100,
  ema60: 99,
  liquidationPercentile: 99,
  oiChange5m: 99,
  volumeBurst: 98,
  sigma1m: 97,
  atrTf: 97,
  atr1h: 97,
  basisZScore: 94,
  longShortZScore: 92,
  vel1: 92,
  vel3: 92,
  crowdingScore: 100,
  extensionScore: 99,
  trendScore: 98,
  cascadeScore: 100,
  exhaustionScore: 99,
  cascadeInProgress: 97,
  vwap: 96,
  vwapDistancePct: 95,
  vwapZScore: 97,
  indexPrice: 97,
  perpIndexPremium: 97,
  ret24hNorm: 95,
  ret72hNorm: 95,
  ret7dNorm: 95,
  donchianUpper20: 93,
  donchianLower20: 93,
  oiVolumeRatio: 93,
  liqOverOi: 96,
  takerImbalancePct: 94,
  rsi14: 91,
  atr14: 95,
  atrPct: 96,
  ema20: 94,
  ema50: 93,
  ema200: 92,
  ema20Slope: 92,
  ema50Slope: 90,
  adx14: 92,
  plusDi: 89,
  minusDi: 89,
  realizedVol: 96,
  rvPercentile30d: 95,
  rvPercentile90d: 95,
  fundingPct30d: 95,
  fundingPct90d: 96,
  fundingZScore: 95,
  oiChange1h: 94,
  oiChange4h: 95,
  oiPct30d: 94,
  oiPct90d: 95,
  oiZScore: 94,
  liquidationZScore: 96,
  liquidationImbalance: 95,
  liquidationNotional: 97,
  liquidationCount: 92,
  liqOiPercentile: 97,
  liqDecaying: 96,
  oiChange5mPercentile: 96,
  normalizedTrendScore: 99,
  trendAgree: 96,
  donchianBreak: 95,
  retZRobust: 98,
  xvenueDeviation: 99,
  spreadPercentile: 95,
  eventActive: 98,
  eventDirection: 96,
  eventVwap: 96,
  eventExtreme: 96,
  reclaimFraction: 99,
  eventVerdict: 99,
  eatFearScore: 91,
  eatGreedScore: 91,
  buyVolume: 94,
  sellVolume: 94,
  volumeDelta: 95,
  cvd: 96,
  spread: 94,
  bidDepth05: 94,
  askDepth05: 94,
  orderbookImbalance: 94,
  trendRegime: 96,
  volRegime: 95,
  btcPrice: 100,
  btcMomentum30d: 98,
  btcMomentum90d: 96,
  btcMomentum7d: 94,
  btcReturnZ: 93,
  btcRealizedVol30d: 92,
  btcDrawdown: 90,
  btcVolumeUsd: 89,
  btcVolumeZ: 88,
  stablecoinMcap: 86,
  oi: 85,
  oiChangePct: 84,
  oiReturnZ: 83,
  funding: 82,
  basis: 95,
  dvol: 79,
  fng: 78,
  ethPrice: 75,
  solPrice: 73,
  defiTvl: 72,
  activeAddrs: 70,
  nTxs: 69,
  txFeesUsd: 68,
  hashRate: 66,
  difficulty: 65,
  miningComprehensiveCost: 64,
  miningElectricityCost: 63,
  topTraderPosition: 62,
  contractLs: 61,
  ls: 60,
  topTraderAccount: 59,
  liqLong: 83,
  liqShort: 82,
  smartNet: 58,
  smartCum: 57,
  smartBuy: 56,
  smartSell: 55,
  manipLeveragePressure: 87,
  manipPriceOiDivergence: 86,
  manipFundingSqueezeZ: 85,
  manipBasisDislocationZ: 84,
  manipTakerImbalancePct: 94,
  manipCvdPriceDivergence: 82,
  manipLiquidationImbalancePct: 81,
  manipLiquidationIntensityZ: 80,
  manipWickAsymmetryPct: 79,
  manipVolumeImpactZ: 78,
  nasdaq: 54,
  sp500: 53,
  dxy: 52,
  vix: 51,
  us10y: 50,
  us2y: 49,
  upperWick: 48,
  lowerWick: 48,
  signalBuyScore: 47,
  signalSellScore: 47,
  signalRiskScore: 47,
  signalDirection: 47,
  russell: 46,
  gold: 45,
  bnbPrice: 44,
  xrpPrice: 43,
  dogePrice: 42,
  mempool: 41,
  avgBlockSize: 40,
  hangseng: 39,
  nikkei: 38,
  silver: 37,
  oil: 36,
  copper: 35,
  natgas: 34,
}

const CRYPTO_QUANT_CORE_CONFIG: readonly CryptoIndicatorConfig[] = [
  { key: "dev", enabled: true, order: 1, refreshMs: 300_000, i18nKey: "compare.s.dev", infoI18nKey: "compare.info.dev", source: "OKX / computed btc-qt primitive", color: "rgb(249 115 22)", unit: "raw", group: "strategyCore", tier: "core" },
  { key: "atr60", enabled: true, order: 2, refreshMs: 300_000, i18nKey: "compare.s.atr60", infoI18nKey: "compare.info.atr60", source: "OKX / computed btc-qt primitive", color: "rgb(234 179 8)", unit: "usd", group: "strategyCore", tier: "core" },
  { key: "vel5", enabled: true, order: 4, refreshMs: 300_000, i18nKey: "compare.s.vel5", infoI18nKey: "compare.info.vel5", source: "OKX / computed btc-qt primitive", color: "rgb(244 63 94)", unit: "raw", group: "strategyCore", tier: "core" },
  { key: "ema60", enabled: true, order: 7, refreshMs: 300_000, i18nKey: "compare.s.ema60", infoI18nKey: "compare.info.ema60", source: "OKX / computed btc-qt primitive", color: "rgb(14 165 233)", unit: "usd", group: "wickConfirmation", tier: "core" },
  { key: "liquidationPercentile", enabled: true, order: 8, refreshMs: 300_000, i18nKey: "compare.s.liquidationPercentile", infoI18nKey: "compare.info.liquidationPercentile", source: "OKX liquidation history / computed", color: "rgb(239 68 68)", unit: "pct", group: "wickConfirmation", tier: "core" },
  { key: "oiChange5m", enabled: true, order: 9, refreshMs: 300_000, i18nKey: "compare.s.oiChange5m", infoI18nKey: "compare.info.oiChange5m", source: "OKX / computed", color: "rgb(2 132 199)", unit: "pct", group: "wickConfirmation", tier: "core" },
  { key: "volumeBurst", enabled: true, order: 10, refreshMs: 300_000, i18nKey: "compare.s.volumeBurst", infoI18nKey: "compare.info.volumeBurst", source: "OKX / computed", color: "rgb(34 197 94)", unit: "ratio", group: "wickConfirmation", tier: "core" },
  { key: "sigma1m", enabled: true, order: 12, refreshMs: 300_000, i18nKey: "compare.s.sigma1m", infoI18nKey: "compare.info.sigma1m", source: "OKX / computed EWMA", color: "rgb(168 85 247)", unit: "pct", group: "wickConfirmation", tier: "core" },
  { key: "atrTf", enabled: true, order: 13, refreshMs: 300_000, i18nKey: "compare.s.atrTf", infoI18nKey: "compare.info.atrTf", source: "OKX 4h candles / computed", color: "rgb(217 119 6)", unit: "usd", group: "wickConfirmation", tier: "core" },
  { key: "basisZScore", enabled: true, order: 17, refreshMs: 300_000, i18nKey: "compare.s.basisZScore", infoI18nKey: "compare.info.basisZScore", source: "OKX spot + perpetual / computed", color: "rgb(147 51 234)", unit: "raw", group: "crowdingContext", tier: "core" },
  { key: "longShortZScore", enabled: true, order: 18, refreshMs: 300_000, i18nKey: "compare.s.longShortZScore", infoI18nKey: "compare.info.longShortZScore", source: "OKX / computed", color: "rgb(192 132 252)", unit: "raw", group: "crowdingContext", tier: "core" },
  { key: "vel1", enabled: true, order: 19, refreshMs: 300_000, i18nKey: "compare.s.vel1", infoI18nKey: "compare.info.vel1", source: "OKX / computed btc-qt primitive", color: "rgb(251 113 133)", unit: "raw", group: "crowdingContext", tier: "core" },
  { key: "vel3", enabled: true, order: 20, refreshMs: 300_000, i18nKey: "compare.s.vel3", infoI18nKey: "compare.info.vel3", source: "OKX / computed btc-qt primitive", color: "rgb(232 121 249)", unit: "raw", group: "crowdingContext", tier: "core" },
  { key: "crowdingScore", enabled: true, order: 10, refreshMs: 300_000, i18nKey: "compare.s.crowdingScore", infoI18nKey: "compare.info.crowdingScore", source: "OKX / computed quant signal", color: "rgb(217 70 239)", unit: "raw", group: "signals", tier: "core" },
  { key: "extensionScore", enabled: true, order: 20, refreshMs: 300_000, i18nKey: "compare.s.extensionScore", infoI18nKey: "compare.info.extensionScore", source: "OKX / computed quant signal", color: "rgb(244 63 94)", unit: "raw", group: "signals", tier: "core" },
  { key: "trendScore", enabled: true, order: 30, refreshMs: 300_000, i18nKey: "compare.s.trendScore", infoI18nKey: "compare.info.trendScore", source: "OKX / computed quant signal", color: "rgb(37 99 235)", unit: "raw", group: "signals", tier: "core" },
  { key: "cascadeScore", enabled: true, order: 40, refreshMs: 300_000, i18nKey: "compare.s.cascadeScore", infoI18nKey: "compare.info.cascadeScore", source: "OKX / computed quant signal", color: "rgb(220 38 38)", unit: "raw", group: "signals", tier: "core" },
  { key: "exhaustionScore", enabled: true, order: 50, refreshMs: 300_000, i18nKey: "compare.s.exhaustionScore", infoI18nKey: "compare.info.exhaustionScore", source: "OKX / computed quant signal", color: "rgb(22 163 74)", unit: "raw", group: "signals", tier: "core" },
  { key: "btcPrice", enabled: true, order: 60, refreshMs: 300_000, i18nKey: "compare.s.price", infoI18nKey: "compare.info.btcPrice", source: "blockchain.info / OKX", color: "rgb(99 102 241)", unit: "usd", group: "price", tier: "core" },
  { key: "indexPrice", enabled: true, order: 62, refreshMs: 300_000, i18nKey: "compare.s.indexPrice", infoI18nKey: "compare.info.indexPrice", source: "OKX multi-venue index", color: "rgb(100 116 139)", unit: "usd", group: "price", tier: "core" },
  { key: "vwap", enabled: true, order: 70, refreshMs: 300_000, i18nKey: "compare.s.vwap", infoI18nKey: "compare.info.vwap", source: "OKX / computed", color: "rgb(20 184 166)", unit: "usd", group: "price", tier: "core" },
  { key: "vwapZScore", enabled: true, order: 80, refreshMs: 300_000, i18nKey: "compare.s.vwapZScore", infoI18nKey: "compare.info.vwapZScore", source: "OKX / computed", color: "rgb(14 165 233)", unit: "raw", group: "price", tier: "core" },
  { key: "vwapDistancePct", enabled: true, order: 90, refreshMs: 300_000, i18nKey: "compare.s.vwapDistancePct", infoI18nKey: "compare.info.vwapDistancePct", source: "OKX / computed", color: "rgb(6 182 212)", unit: "pct", group: "price", tier: "core" },
  { key: "rsi14", enabled: true, order: 100, refreshMs: 300_000, i18nKey: "compare.s.rsi14", infoI18nKey: "compare.info.rsi14", source: "OKX / computed", color: "rgb(168 85 247)", unit: "raw", group: "price", tier: "core" },
  { key: "atrPct", enabled: true, order: 110, refreshMs: 300_000, i18nKey: "compare.s.atrPct", infoI18nKey: "compare.info.atrPct", source: "OKX / computed", color: "rgb(245 158 11)", unit: "pct", group: "price", tier: "core" },
  { key: "atr14", enabled: true, order: 120, refreshMs: 300_000, i18nKey: "compare.s.atr14", infoI18nKey: "compare.info.atr14", source: "OKX / computed", color: "rgb(217 119 6)", unit: "usd", group: "price", tier: "core" },
  { key: "btcReturnZ", enabled: true, order: 130, refreshMs: 300_000, i18nKey: "compare.s.returnZ", infoI18nKey: "compare.info.btcReturnZ", source: "OKX / computed", color: "rgb(244 63 94)", unit: "raw", group: "price", tier: "core" },
  { key: "ret24hNorm", enabled: true, order: 132, refreshMs: 300_000, i18nKey: "compare.s.ret24hNorm", infoI18nKey: "compare.info.ret24hNorm", source: "OKX / computed", color: "rgb(251 113 133)", unit: "raw", group: "price", tier: "core" },
  { key: "ret72hNorm", enabled: true, order: 134, refreshMs: 300_000, i18nKey: "compare.s.ret72hNorm", infoI18nKey: "compare.info.ret72hNorm", source: "OKX / computed", color: "rgb(232 121 249)", unit: "raw", group: "price", tier: "core" },
  { key: "ret7dNorm", enabled: true, order: 136, refreshMs: 300_000, i18nKey: "compare.s.ret7dNorm", infoI18nKey: "compare.info.ret7dNorm", source: "OKX / computed", color: "rgb(129 140 248)", unit: "raw", group: "price", tier: "core" },
  { key: "btcDrawdown", enabled: true, order: 140, refreshMs: 300_000, i18nKey: "compare.s.btcDrawdown", infoI18nKey: "compare.info.btcDrawdown", source: "OKX / computed", color: "rgb(190 18 60)", unit: "pct", group: "price", tier: "core" },
  { key: "btcVolumeUsd", enabled: true, order: 150, refreshMs: 300_000, i18nKey: "compare.s.volumeUsd", infoI18nKey: "compare.info.btcVolumeUsd", source: "OKX", color: "rgb(37 99 235)", unit: "usd", group: "volume", tier: "core" },
  { key: "btcVolumeZ", enabled: true, order: 160, refreshMs: 300_000, i18nKey: "compare.s.volumeZ", infoI18nKey: "compare.info.btcVolumeZ", source: "OKX / computed", color: "rgb(245 158 11)", unit: "raw", group: "volume", tier: "core" },
  { key: "buyVolume", enabled: true, order: 170, refreshMs: 300_000, i18nKey: "compare.s.buyVolume", infoI18nKey: "compare.info.buyVolume", source: "OKX", color: "rgb(22 163 74)", unit: "raw", group: "volume", tier: "core" },
  { key: "sellVolume", enabled: true, order: 180, refreshMs: 300_000, i18nKey: "compare.s.sellVolume", infoI18nKey: "compare.info.sellVolume", source: "OKX", color: "rgb(220 38 38)", unit: "raw", group: "volume", tier: "core" },
  { key: "volumeDelta", enabled: true, order: 190, refreshMs: 300_000, i18nKey: "compare.s.volumeDelta", infoI18nKey: "compare.info.volumeDelta", source: "OKX / computed", color: "rgb(8 145 178)", unit: "raw", group: "volume", tier: "core" },
  { key: "cvd", enabled: true, order: 200, refreshMs: 300_000, i18nKey: "compare.s.cvd", infoI18nKey: "compare.info.cvd", source: "OKX / computed", color: "rgb(59 130 246)", unit: "raw", group: "volume", tier: "core" },
  { key: "takerImbalancePct", enabled: true, order: 205, refreshMs: 300_000, i18nKey: "compare.s.takerImbalancePct", infoI18nKey: "compare.info.takerImbalancePct", source: "OKX / computed", color: "rgb(8 145 178)", unit: "pct", group: "volume", tier: "core" },
  { key: "funding", enabled: true, order: 210, refreshMs: 300_000, i18nKey: "compare.s.funding", infoI18nKey: "compare.info.funding", source: "OKX", color: "rgb(236 72 153)", unit: "pct", group: "derivatives", tier: "core" },
  { key: "fundingPct90d", enabled: true, order: 220, refreshMs: 300_000, i18nKey: "compare.s.fundingPct90d", infoI18nKey: "compare.info.fundingPct90d", source: "OKX / computed", color: "rgb(219 39 119)", unit: "pct", group: "derivatives", tier: "core" },
  { key: "perpIndexPremium", enabled: true, order: 222, refreshMs: 300_000, i18nKey: "compare.s.perpIndexPremium", infoI18nKey: "compare.info.perpIndexPremium", source: "OKX / computed", color: "rgb(249 115 22)", unit: "pct", group: "derivatives", tier: "core" },
  { key: "basis", enabled: true, order: 224, refreshMs: 300_000, i18nKey: "compare.s.basis", infoI18nKey: "compare.info.basis", source: "OKX / computed", color: "rgb(14 165 233)", unit: "pct", group: "derivatives", tier: "core" },
  { key: "fundingZScore", enabled: true, order: 230, refreshMs: 300_000, i18nKey: "compare.s.fundingZScore", infoI18nKey: "compare.info.fundingZScore", source: "OKX / computed", color: "rgb(190 24 93)", unit: "raw", group: "derivatives", tier: "core" },
  { key: "oi", enabled: true, order: 240, refreshMs: 300_000, i18nKey: "compare.s.oi", infoI18nKey: "compare.info.oi", source: "OKX", color: "rgb(59 130 246)", unit: "usd", group: "derivatives", tier: "core" },
  { key: "oiChange4h", enabled: true, order: 250, refreshMs: 300_000, i18nKey: "compare.s.oiChange4h", infoI18nKey: "compare.info.oiChange4h", source: "OKX / computed", color: "rgb(2 132 199)", unit: "pct", group: "derivatives", tier: "core" },
  { key: "oiPct90d", enabled: true, order: 260, refreshMs: 300_000, i18nKey: "compare.s.oiPct90d", infoI18nKey: "compare.info.oiPct90d", source: "OKX / computed", color: "rgb(14 165 233)", unit: "pct", group: "derivatives", tier: "core" },
  { key: "oiZScore", enabled: true, order: 270, refreshMs: 300_000, i18nKey: "compare.s.oiZScore", infoI18nKey: "compare.info.oiZScore", source: "OKX / computed", color: "rgb(56 189 248)", unit: "raw", group: "derivatives", tier: "core" },
  { key: "oiVolumeRatio", enabled: true, order: 272, refreshMs: 300_000, i18nKey: "compare.s.oiVolumeRatio", infoI18nKey: "compare.info.oiVolumeRatio", source: "OKX / computed", color: "rgb(2 132 199)", unit: "ratio", group: "derivatives", tier: "core" },
  { key: "liqLong", enabled: true, order: 280, refreshMs: 300_000, i18nKey: "compare.s.liqLong", infoI18nKey: "compare.info.liqLong", source: "OKX", color: "rgb(239 68 68)", unit: "usd", group: "liquidations", tier: "core" },
  { key: "liqShort", enabled: true, order: 290, refreshMs: 300_000, i18nKey: "compare.s.liqShort", infoI18nKey: "compare.info.liqShort", source: "OKX", color: "rgb(34 197 94)", unit: "usd", group: "liquidations", tier: "core" },
  { key: "liquidationZScore", enabled: true, order: 300, refreshMs: 300_000, i18nKey: "compare.s.liquidationZScore", infoI18nKey: "compare.info.liquidationZScore", source: "OKX / computed", color: "rgb(248 113 113)", unit: "raw", group: "liquidations", tier: "core" },
  { key: "liqOverOi", enabled: true, order: 305, refreshMs: 300_000, i18nKey: "compare.s.liqOverOi", infoI18nKey: "compare.info.liqOverOi", source: "OKX / computed", color: "rgb(234 88 12)", unit: "pct", group: "liquidations", tier: "core" },
  { key: "liquidationImbalance", enabled: true, order: 310, refreshMs: 300_000, i18nKey: "compare.s.liquidationImbalance", infoI18nKey: "compare.info.liquidationImbalance", source: "OKX / computed", color: "rgb(251 113 133)", unit: "pct", group: "liquidations", tier: "core" },
  { key: "spread", enabled: true, order: 320, refreshMs: 300_000, i18nKey: "compare.s.spread", infoI18nKey: "compare.info.spread", source: "OKX / collected snapshots", color: "rgb(148 163 184)", unit: "pct", group: "orderbook", tier: "core" },
  { key: "bidDepth05", enabled: true, order: 330, refreshMs: 300_000, i18nKey: "compare.s.bidDepth05", infoI18nKey: "compare.info.bidDepth05", source: "OKX / collected snapshots", color: "rgb(34 197 94)", unit: "usd", group: "orderbook", tier: "core" },
  { key: "askDepth05", enabled: true, order: 340, refreshMs: 300_000, i18nKey: "compare.s.askDepth05", infoI18nKey: "compare.info.askDepth05", source: "OKX / collected snapshots", color: "rgb(239 68 68)", unit: "usd", group: "orderbook", tier: "core" },
  { key: "orderbookImbalance", enabled: true, order: 350, refreshMs: 300_000, i18nKey: "compare.s.orderbookImbalance", infoI18nKey: "compare.info.orderbookImbalance", source: "OKX / collected snapshots", color: "rgb(20 184 166)", unit: "pct", group: "orderbook", tier: "core" },
  { key: "donchianUpper20", enabled: true, order: 352, refreshMs: 300_000, i18nKey: "compare.s.donchianUpper20", infoI18nKey: "compare.info.donchianUpper20", source: "OKX / computed", color: "rgb(16 185 129)", unit: "usd", group: "regime", tier: "core" },
  { key: "donchianLower20", enabled: true, order: 354, refreshMs: 300_000, i18nKey: "compare.s.donchianLower20", infoI18nKey: "compare.info.donchianLower20", source: "OKX / computed", color: "rgb(239 68 68)", unit: "usd", group: "regime", tier: "core" },
  { key: "ema20", enabled: true, order: 360, refreshMs: 300_000, i18nKey: "compare.s.ema20", infoI18nKey: "compare.info.ema20", source: "OKX / computed", color: "rgb(59 130 246)", unit: "usd", group: "regime", tier: "core" },
  { key: "ema50", enabled: true, order: 370, refreshMs: 300_000, i18nKey: "compare.s.ema50", infoI18nKey: "compare.info.ema50", source: "OKX / computed", color: "rgb(37 99 235)", unit: "usd", group: "regime", tier: "core" },
  { key: "ema200", enabled: true, order: 380, refreshMs: 300_000, i18nKey: "compare.s.ema200", infoI18nKey: "compare.info.ema200", source: "OKX / computed", color: "rgb(30 64 175)", unit: "usd", group: "regime", tier: "core" },
  { key: "adx14", enabled: true, order: 390, refreshMs: 300_000, i18nKey: "compare.s.adx14", infoI18nKey: "compare.info.adx14", source: "OKX / computed", color: "rgb(124 58 237)", unit: "raw", group: "regime", tier: "core" },
  { key: "realizedVol", enabled: true, order: 400, refreshMs: 300_000, i18nKey: "compare.s.realizedVol", infoI18nKey: "compare.info.realizedVol", source: "OKX / computed", color: "rgb(220 38 38)", unit: "pct", group: "regime", tier: "core" },
  { key: "rvPercentile90d", enabled: true, order: 410, refreshMs: 300_000, i18nKey: "compare.s.rvPercentile90d", infoI18nKey: "compare.info.rvPercentile90d", source: "OKX / computed", color: "rgb(248 113 113)", unit: "pct", group: "regime", tier: "core" },
  { key: "trendRegime", enabled: true, order: 420, refreshMs: 300_000, i18nKey: "compare.s.trendRegime", infoI18nKey: "compare.info.trendRegime", source: "OKX / computed", color: "rgb(37 99 235)", unit: "raw", group: "regime", tier: "core" },
  { key: "volRegime", enabled: true, order: 430, refreshMs: 300_000, i18nKey: "compare.s.volRegime", infoI18nKey: "compare.info.volRegime", source: "OKX / computed", color: "rgb(244 63 94)", unit: "raw", group: "regime", tier: "core" },
  { key: "cascadeInProgress", enabled: true, order: 440, refreshMs: 300_000, i18nKey: "compare.s.cascadeInProgress", infoI18nKey: "compare.info.cascadeInProgress", source: "OKX / computed quant signal", color: "rgb(185 28 28)", unit: "raw", group: "regime", tier: "core" },
  { key: "normalizedTrendScore", enabled: true, order: 450, refreshMs: 300_000, i18nKey: "compare.s.normalizedTrendScore", infoI18nKey: "compare.info.normalizedTrendScore", source: "OKX / computed btc-qt v2.1", color: "rgb(79 70 229)", unit: "raw", tier: "core" },
  { key: "trendAgree", enabled: true, order: 460, refreshMs: 300_000, i18nKey: "compare.s.trendAgree", infoI18nKey: "compare.info.trendAgree", source: "OKX / computed btc-qt v2.1", color: "rgb(67 56 202)", unit: "count", tier: "core" },
  { key: "donchianBreak", enabled: true, order: 470, refreshMs: 300_000, i18nKey: "compare.s.donchianBreak", infoI18nKey: "compare.info.donchianBreak", source: "OKX / computed btc-qt v2.1", color: "rgb(5 150 105)", unit: "raw", tier: "core" },
  { key: "retZRobust", enabled: true, order: 480, refreshMs: 300_000, i18nKey: "compare.s.retZRobust", infoI18nKey: "compare.info.retZRobust", source: "OKX / computed median-MAD", color: "rgb(225 29 72)", unit: "raw", tier: "core" },
  { key: "ema20Slope", enabled: true, order: 490, refreshMs: 300_000, i18nKey: "compare.s.ema20Slope", infoI18nKey: "compare.info.ema20Slope", source: "OKX / computed", color: "rgb(56 189 248)", unit: "pct", tier: "core" },
  { key: "ema50Slope", enabled: true, order: 500, refreshMs: 300_000, i18nKey: "compare.s.ema50Slope", infoI18nKey: "compare.info.ema50Slope", source: "OKX / computed", color: "rgb(2 132 199)", unit: "pct", tier: "core" },
  { key: "plusDi", enabled: true, order: 510, refreshMs: 300_000, i18nKey: "compare.s.plusDi", infoI18nKey: "compare.info.plusDi", source: "OKX / computed", color: "rgb(22 163 74)", unit: "raw", tier: "core" },
  { key: "minusDi", enabled: true, order: 520, refreshMs: 300_000, i18nKey: "compare.s.minusDi", infoI18nKey: "compare.info.minusDi", source: "OKX / computed", color: "rgb(220 38 38)", unit: "raw", tier: "core" },
  { key: "rvPercentile30d", enabled: true, order: 530, refreshMs: 300_000, i18nKey: "compare.s.rvPercentile30d", infoI18nKey: "compare.info.rvPercentile30d", source: "OKX / computed", color: "rgb(251 113 133)", unit: "pct", tier: "core" },
  { key: "fundingPct30d", enabled: true, order: 540, refreshMs: 300_000, i18nKey: "compare.s.fundingPct30d", infoI18nKey: "compare.info.fundingPct30d", source: "OKX / computed", color: "rgb(244 114 182)", unit: "pct", tier: "core" },
  { key: "oiChange1h", enabled: true, order: 550, refreshMs: 300_000, i18nKey: "compare.s.oiChange1h", infoI18nKey: "compare.info.oiChange1h", source: "OKX / computed", color: "rgb(3 105 161)", unit: "pct", tier: "core" },
  { key: "oiPct30d", enabled: true, order: 560, refreshMs: 300_000, i18nKey: "compare.s.oiPct30d", infoI18nKey: "compare.info.oiPct30d", source: "OKX / computed", color: "rgb(14 116 144)", unit: "pct", tier: "core" },
  { key: "liquidationNotional", enabled: true, order: 570, refreshMs: 300_000, i18nKey: "compare.s.liquidationNotional", infoI18nKey: "compare.info.liquidationNotional", source: "OKX liquidation history", color: "rgb(185 28 28)", unit: "usd", tier: "core" },
  { key: "liqOiPercentile", enabled: true, order: 580, refreshMs: 300_000, i18nKey: "compare.s.liqOiPercentile", infoI18nKey: "compare.info.liqOiPercentile", source: "OKX / computed btc-qt v2.1", color: "rgb(194 65 12)", unit: "pct", tier: "core" },
  { key: "liqDecaying", enabled: true, order: 590, refreshMs: 300_000, i18nKey: "compare.s.liqDecaying", infoI18nKey: "compare.info.liqDecaying", source: "OKX / computed btc-qt v2.1", color: "rgb(21 128 61)", unit: "raw", tier: "core" },
  { key: "oiChange5mPercentile", enabled: true, order: 600, refreshMs: 300_000, i18nKey: "compare.s.oiChange5mPercentile", infoI18nKey: "compare.info.oiChange5mPercentile", source: "OKX / computed btc-qt v2.1", color: "rgb(7 89 133)", unit: "pct", tier: "core" },
  { key: "xvenueDeviation", enabled: true, order: 610, refreshMs: 300_000, i18nKey: "compare.s.xvenueDeviation", infoI18nKey: "compare.info.xvenueDeviation", source: "OKX multi-venue index / computed", color: "rgb(124 58 237)", unit: "raw", tier: "core" },
  { key: "spreadPercentile", enabled: true, order: 620, refreshMs: 300_000, i18nKey: "compare.s.spreadPercentile", infoI18nKey: "compare.info.spreadPercentile", source: "OKX collected snapshots / computed", color: "rgb(100 116 139)", unit: "pct", tier: "core" },
  { key: "eventActive", enabled: true, order: 630, refreshMs: 300_000, i18nKey: "compare.s.eventActive", infoI18nKey: "compare.info.eventActive", source: "OKX / computed btc-qt event state", color: "rgb(234 88 12)", unit: "raw", tier: "core" },
  { key: "eventDirection", enabled: true, order: 640, refreshMs: 300_000, i18nKey: "compare.s.eventDirection", infoI18nKey: "compare.info.eventDirection", source: "OKX / computed btc-qt event state", color: "rgb(239 68 68)", unit: "raw", tier: "core" },
  { key: "eventVwap", enabled: true, order: 650, refreshMs: 300_000, i18nKey: "compare.s.eventVwap", infoI18nKey: "compare.info.eventVwap", source: "OKX / computed btc-qt event state", color: "rgb(13 148 136)", unit: "usd", tier: "core" },
  { key: "eventExtreme", enabled: true, order: 655, refreshMs: 300_000, i18nKey: "compare.s.eventExtreme", infoI18nKey: "compare.info.eventExtreme", source: "OKX / computed btc-qt event state", color: "rgb(234 88 12)", unit: "usd", tier: "core" },
  { key: "reclaimFraction", enabled: true, order: 660, refreshMs: 300_000, i18nKey: "compare.s.reclaimFraction", infoI18nKey: "compare.info.reclaimFraction", source: "OKX / computed btc-qt event state", color: "rgb(22 163 74)", unit: "pct", tier: "core" },
  { key: "eventVerdict", enabled: true, order: 670, refreshMs: 300_000, i18nKey: "compare.s.eventVerdict", infoI18nKey: "compare.info.eventVerdict", source: "OKX / computed btc-qt event state", color: "rgb(79 70 229)", unit: "raw", tier: "core" },
  { key: "eatFearScore", enabled: true, order: 680, refreshMs: 300_000, i18nKey: "compare.s.eatFearScore", infoI18nKey: "compare.info.eatFearScore", source: "alternative.me + OKX / computed btc-qt", color: "rgb(220 38 38)", unit: "raw", tier: "core" },
  { key: "eatGreedScore", enabled: true, order: 690, refreshMs: 300_000, i18nKey: "compare.s.eatGreedScore", infoI18nKey: "compare.info.eatGreedScore", source: "alternative.me + OKX / computed btc-qt", color: "rgb(22 163 74)", unit: "raw", tier: "core" },
  { key: "atr1h", enabled: true, order: 700, refreshMs: 300_000, i18nKey: "compare.s.atr1h", infoI18nKey: "compare.info.atr1h", source: "OKX 1h candles / computed btc-qt v2.1", color: "rgb(180 83 9)", unit: "usd", tier: "core" },
  { key: "liquidationCount", enabled: true, order: 710, refreshMs: 300_000, i18nKey: "compare.s.liquidationCount", infoI18nKey: "compare.info.liquidationCount", source: "OKX liquidation history", color: "rgb(153 27 27)", unit: "count", tier: "core" },
]

const BTC_WICK_PRIORITY: Readonly<Record<string, number>> = {
  dev: 1,
  atr60: 2,
  trendRegime: 3,
  vel5: 4,
  fundingPct90d: 5,
  cascadeScore: 6,
  ema60: 7,
  liquidationPercentile: 8,
  oiChange5m: 9,
  volumeBurst: 10,
  trendScore: 11,
  adx14: 12,
  sigma1m: 13,
  atrTf: 14,
  rvPercentile90d: 15,
  oiPct90d: 16,
  crowdingScore: 17,
  basisZScore: 18,
  longShortZScore: 19,
  vel1: 20,
  vel3: 21,
  extensionScore: 22,
  exhaustionScore: 23,
  cascadeInProgress: 24,
  fng: 25,
}

export const CRYPTO_INDICATOR_CONFIG: readonly CryptoIndicatorConfig[] = [
  // Evidence-ranked core: market, momentum, volatility, volume, liquidity.
  { key: "btcPrice", enabled: true, order: 10, refreshMs: 300_000, i18nKey: "compare.s.price", infoI18nKey: "compare.info.btcPrice", source: "blockchain.info / OKX", color: "rgb(99 102 241)", unit: "usd" },
  { key: "btcMomentum30d", enabled: true, order: 20, refreshMs: 300_000, i18nKey: "compare.s.btcMomentum30d", infoI18nKey: "compare.info.btcMomentum30d", source: "OKX / computed", color: "rgb(37 99 235)", unit: "pct" },
  { key: "btcMomentum90d", enabled: true, order: 30, refreshMs: 300_000, i18nKey: "compare.s.btcMomentum90d", infoI18nKey: "compare.info.btcMomentum90d", source: "OKX / computed", color: "rgb(14 165 233)", unit: "pct" },
  { key: "btcMomentum7d", enabled: true, order: 40, refreshMs: 300_000, i18nKey: "compare.s.btcMomentum7d", infoI18nKey: "compare.info.btcMomentum7d", source: "OKX / computed", color: "rgb(6 182 212)", unit: "pct" },
  { key: "btcReturnZ", enabled: true, order: 50, refreshMs: 300_000, i18nKey: "compare.s.returnZ", infoI18nKey: "compare.info.btcReturnZ", source: "OKX / computed", color: "rgb(244 63 94)", unit: "raw" },
  { key: "btcRealizedVol30d", enabled: true, order: 60, refreshMs: 300_000, i18nKey: "compare.s.btcRealizedVol30d", infoI18nKey: "compare.info.btcRealizedVol30d", source: "OKX / computed", color: "rgb(220 38 38)", unit: "pct" },
  { key: "btcDrawdown", enabled: true, order: 70, refreshMs: 300_000, i18nKey: "compare.s.btcDrawdown", infoI18nKey: "compare.info.btcDrawdown", source: "OKX / computed", color: "rgb(190 18 60)", unit: "pct" },
  { key: "btcVolumeUsd", enabled: true, order: 80, refreshMs: 300_000, i18nKey: "compare.s.volumeUsd", infoI18nKey: "compare.info.btcVolumeUsd", source: "OKX", color: "rgb(37 99 235)", unit: "usd" },
  { key: "btcVolumeZ", enabled: true, order: 90, refreshMs: 300_000, i18nKey: "compare.s.volumeZ", infoI18nKey: "compare.info.btcVolumeZ", source: "OKX / computed", color: "rgb(245 158 11)", unit: "raw" },
  { key: "stablecoinMcap", enabled: true, order: 100, refreshMs: 300_000, i18nKey: "compare.s.stablecoin", infoI18nKey: "compare.info.stablecoinMcap", source: "DefiLlama", color: "rgb(20 184 166)", unit: "usd" },
  // Derivatives leverage and positioning.
  { key: "oi", enabled: true, order: 110, refreshMs: 300_000, i18nKey: "compare.s.oi", infoI18nKey: "compare.info.oi", source: "OKX", color: "rgb(59 130 246)", unit: "usd" },
  { key: "oiChangePct", enabled: true, order: 120, refreshMs: 300_000, i18nKey: "compare.s.oiChangePct", infoI18nKey: "compare.info.oiChangePct", source: "OKX / computed", color: "rgb(2 132 199)", unit: "pct" },
  { key: "oiReturnZ", enabled: true, order: 130, refreshMs: 300_000, i18nKey: "compare.s.oiZ", infoI18nKey: "compare.info.oiReturnZ", source: "OKX / computed", color: "rgb(14 165 233)", unit: "raw" },
  { key: "funding", enabled: true, order: 140, refreshMs: 300_000, i18nKey: "compare.s.funding", infoI18nKey: "compare.info.funding", source: "OKX", color: "rgb(236 72 153)", unit: "pct" },
  { key: "liqLong", enabled: true, order: 145, refreshMs: 300_000, i18nKey: "compare.s.liqLong", infoI18nKey: "compare.info.liqLong", source: "OKX", color: "rgb(239 68 68)", unit: "usd" },
  { key: "liqShort", enabled: true, order: 147, refreshMs: 300_000, i18nKey: "compare.s.liqShort", infoI18nKey: "compare.info.liqShort", source: "OKX", color: "rgb(34 197 94)", unit: "usd" },
  { key: "basis", enabled: true, order: 150, refreshMs: 300_000, i18nKey: "compare.s.basis", infoI18nKey: "compare.info.basis", source: "OKX / computed", color: "rgb(14 165 233)", unit: "pct" },
  { key: "dvol", enabled: true, order: 160, refreshMs: 300_000, i18nKey: "compare.s.dvol", infoI18nKey: "compare.info.dvol", source: "Deribit", color: "rgb(244 114 182)", unit: "raw" },
  { key: "fng", enabled: true, order: 170, refreshMs: 300_000, i18nKey: "compare.s.fng", infoI18nKey: "compare.info.fng", source: "alternative.me", color: "rgb(245 158 11)", unit: "raw" },
  // Crypto cross-section, network activity, and miner economics.
  { key: "ethPrice", enabled: true, order: 180, refreshMs: 300_000, i18nKey: "compare.s.ethPrice", infoI18nKey: "compare.info.ethPrice", source: "OKX", color: "rgb(168 85 247)", unit: "usd" },
  { key: "solPrice", enabled: true, order: 190, refreshMs: 300_000, i18nKey: "compare.s.solPrice", infoI18nKey: "compare.info.solPrice", source: "OKX", color: "rgb(20 184 166)", unit: "usd" },
  { key: "defiTvl", enabled: true, order: 200, refreshMs: 300_000, i18nKey: "compare.s.defiTvl", infoI18nKey: "compare.info.defiTvl", source: "DefiLlama", color: "rgb(34 197 94)", unit: "usd" },
  { key: "activeAddrs", enabled: true, order: 210, refreshMs: 300_000, i18nKey: "compare.s.activeAddrs", infoI18nKey: "compare.info.activeAddrs", source: "blockchain.info", color: "rgb(99 102 241)", unit: "count" },
  { key: "nTxs", enabled: true, order: 220, refreshMs: 300_000, i18nKey: "compare.s.nTxs", infoI18nKey: "compare.info.nTxs", source: "blockchain.info", color: "rgb(59 130 246)", unit: "count" },
  { key: "txFeesUsd", enabled: true, order: 230, refreshMs: 300_000, i18nKey: "compare.s.txFeesUsd", infoI18nKey: "compare.info.txFeesUsd", source: "blockchain.info", color: "rgb(220 38 38)", unit: "usd" },
  { key: "hashRate", enabled: true, order: 240, refreshMs: 300_000, i18nKey: "compare.s.hashRate", infoI18nKey: "compare.info.hashRate", source: "blockchain.info", color: "rgb(20 184 166)", unit: "raw" },
  { key: "difficulty", enabled: true, order: 250, refreshMs: 300_000, i18nKey: "compare.s.difficulty", infoI18nKey: "compare.info.difficulty", source: "blockchain.info", color: "rgb(168 85 247)", unit: "raw" },
  { key: "miningComprehensiveCost", enabled: true, order: 260, refreshMs: 300_000, i18nKey: "compare.s.miningComprehensiveCost", infoI18nKey: "compare.info.miningComprehensiveCost", source: "mempool.space / blockchain.info", color: "rgb(217 119 6)", unit: "usd" },
  { key: "miningElectricityCost", enabled: true, order: 270, refreshMs: 300_000, i18nKey: "compare.s.miningElectricityCost", infoI18nKey: "compare.info.miningElectricityCost", source: "mempool.space / blockchain.info", color: "rgb(245 158 11)", unit: "usd" },
  { key: "topTraderPosition", enabled: true, order: 280, refreshMs: 300_000, i18nKey: "compare.s.topTraderPosition", infoI18nKey: "compare.info.topTraderPosition", source: "OKX", color: "rgb(217 70 239)", unit: "ratio" },
  { key: "contractLs", enabled: true, order: 290, refreshMs: 300_000, i18nKey: "compare.s.contractLs", infoI18nKey: "compare.info.contractLs", source: "OKX", color: "rgb(99 102 241)", unit: "ratio" },
  { key: "ls", enabled: true, order: 300, refreshMs: 300_000, i18nKey: "compare.s.ls", infoI18nKey: "compare.info.ls", source: "OKX", color: "rgb(168 85 247)", unit: "ratio" },
  { key: "topTraderAccount", enabled: true, order: 310, refreshMs: 300_000, i18nKey: "compare.s.topTraderAccount", infoI18nKey: "compare.info.topTraderAccount", source: "OKX", color: "rgb(192 132 252)", unit: "ratio" },
  { key: "smartNet", enabled: true, order: 320, refreshMs: 300_000, i18nKey: "compare.s.smartNet", infoI18nKey: "compare.info.smartNet", source: "OKX / computed", color: "rgb(245 158 11)", unit: "raw" },
  { key: "smartCum", enabled: true, order: 330, refreshMs: 300_000, i18nKey: "compare.s.smartCum", infoI18nKey: "compare.info.smartCum", source: "OKX / computed", color: "rgb(59 130 246)", unit: "raw" },
  { key: "smartBuy", enabled: true, order: 340, refreshMs: 300_000, i18nKey: "compare.s.smartBuy", infoI18nKey: "compare.info.smartBuy", source: "OKX", color: "rgb(22 163 74)", unit: "raw" },
  { key: "smartSell", enabled: true, order: 350, refreshMs: 300_000, i18nKey: "compare.s.smartSell", infoI18nKey: "compare.info.smartSell", source: "OKX", color: "rgb(220 38 38)", unit: "raw" },
  // Manipulation observables: public-data anomalies that require cross-signal confirmation.
  { key: "manipLeveragePressure", enabled: true, order: 360, refreshMs: 300_000, i18nKey: "compare.s.manipLeveragePressure", infoI18nKey: "compare.info.manipLeveragePressure", source: "OKX / computed observable", color: "rgb(225 29 72)", unit: "raw" },
  { key: "manipPriceOiDivergence", enabled: true, order: 370, refreshMs: 300_000, i18nKey: "compare.s.manipPriceOiDivergence", infoI18nKey: "compare.info.manipPriceOiDivergence", source: "OKX / computed observable", color: "rgb(234 88 12)", unit: "raw" },
  { key: "manipFundingSqueezeZ", enabled: true, order: 380, refreshMs: 300_000, i18nKey: "compare.s.manipFundingSqueezeZ", infoI18nKey: "compare.info.manipFundingSqueezeZ", source: "OKX / computed observable", color: "rgb(219 39 119)", unit: "raw" },
  { key: "manipBasisDislocationZ", enabled: true, order: 390, refreshMs: 300_000, i18nKey: "compare.s.manipBasisDislocationZ", infoI18nKey: "compare.info.manipBasisDislocationZ", source: "OKX / computed observable", color: "rgb(147 51 234)", unit: "raw" },
  { key: "manipTakerImbalancePct", enabled: true, order: 400, refreshMs: 300_000, i18nKey: "compare.s.manipTakerImbalancePct", infoI18nKey: "compare.info.manipTakerImbalancePct", source: "OKX / computed observable", color: "rgb(8 145 178)", unit: "pct" },
  { key: "manipCvdPriceDivergence", enabled: true, order: 410, refreshMs: 300_000, i18nKey: "compare.s.manipCvdPriceDivergence", infoI18nKey: "compare.info.manipCvdPriceDivergence", source: "OKX / computed observable", color: "rgb(37 99 235)", unit: "raw" },
  { key: "manipLiquidationImbalancePct", enabled: true, order: 420, refreshMs: 300_000, i18nKey: "compare.s.manipLiquidationImbalancePct", infoI18nKey: "compare.info.manipLiquidationImbalancePct", source: "OKX / computed observable", color: "rgb(220 38 38)", unit: "pct" },
  { key: "manipLiquidationIntensityZ", enabled: true, order: 430, refreshMs: 300_000, i18nKey: "compare.s.manipLiquidationIntensityZ", infoI18nKey: "compare.info.manipLiquidationIntensityZ", source: "OKX / computed observable", color: "rgb(239 68 68)", unit: "raw" },
  { key: "manipWickAsymmetryPct", enabled: true, order: 440, refreshMs: 300_000, i18nKey: "compare.s.manipWickAsymmetryPct", infoI18nKey: "compare.info.manipWickAsymmetryPct", source: "OKX / computed observable", color: "rgb(217 119 6)", unit: "pct" },
  { key: "manipVolumeImpactZ", enabled: true, order: 450, refreshMs: 300_000, i18nKey: "compare.s.manipVolumeImpactZ", infoI18nKey: "compare.info.manipVolumeImpactZ", source: "OKX / computed observable", color: "rgb(124 58 237)", unit: "raw" },
  // Cross-asset context is useful, but crypto papers rank market-native factors first.
  { key: "nasdaq", enabled: true, order: 460, refreshMs: 300_000, i18nKey: "compare.s.nasdaq", infoI18nKey: "compare.info.nasdaq", source: "Yahoo Finance", color: "rgb(168 85 247)", unit: "raw" },
  { key: "sp500", enabled: true, order: 470, refreshMs: 300_000, i18nKey: "compare.s.sp500", infoI18nKey: "compare.info.sp500", source: "Yahoo Finance", color: "rgb(99 102 241)", unit: "raw" },
  { key: "dxy", enabled: true, order: 480, refreshMs: 300_000, i18nKey: "compare.s.dxy", infoI18nKey: "compare.info.dxy", source: "Yahoo Finance", color: "rgb(99 102 241)", unit: "raw" },
  { key: "vix", enabled: true, order: 490, refreshMs: 300_000, i18nKey: "compare.s.vix", infoI18nKey: "compare.info.vix", source: "Yahoo Finance", color: "rgb(220 38 38)", unit: "raw" },
  { key: "us10y", enabled: true, order: 500, refreshMs: 300_000, i18nKey: "compare.s.us10y", infoI18nKey: "compare.info.us10y", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "pct" },
  { key: "us2y", enabled: true, order: 510, refreshMs: 300_000, i18nKey: "compare.s.us2y", infoI18nKey: "compare.info.us2y", source: "Yahoo Finance", color: "rgb(236 72 153)", unit: "pct" },
  { key: "upperWick", enabled: true, order: 520, refreshMs: 300_000, i18nKey: "compare.s.upperWick", infoI18nKey: "compare.info.upperWick", source: "OKX / computed", color: "rgb(220 38 38)", unit: "pct" },
  { key: "lowerWick", enabled: true, order: 530, refreshMs: 300_000, i18nKey: "compare.s.lowerWick", infoI18nKey: "compare.info.lowerWick", source: "OKX / computed", color: "rgb(22 163 74)", unit: "pct" },
  { key: "signalBuyScore", enabled: true, order: 540, refreshMs: 300_000, i18nKey: "compare.s.signalBuy", infoI18nKey: "compare.info.signalBuyScore", source: "OKX / computed custom signal", color: "rgb(22 163 74)", unit: "raw" },
  { key: "signalSellScore", enabled: true, order: 550, refreshMs: 300_000, i18nKey: "compare.s.signalSell", infoI18nKey: "compare.info.signalSellScore", source: "OKX / computed custom signal", color: "rgb(220 38 38)", unit: "raw" },
  { key: "signalRiskScore", enabled: true, order: 560, refreshMs: 300_000, i18nKey: "compare.s.signalRisk", infoI18nKey: "compare.info.signalRiskScore", source: "OKX / computed custom signal", color: "rgb(245 158 11)", unit: "raw" },
  { key: "signalDirection", enabled: true, order: 570, refreshMs: 300_000, i18nKey: "compare.s.signalDirection", infoI18nKey: "compare.info.signalDirection", source: "OKX / computed custom signal", color: "rgb(99 102 241)", unit: "raw" },
  { key: "russell", enabled: true, order: 580, refreshMs: 300_000, i18nKey: "compare.s.russell", infoI18nKey: "compare.info.russell", source: "Yahoo Finance", color: "rgb(20 184 166)", unit: "raw" },
  { key: "gold", enabled: true, order: 590, refreshMs: 300_000, i18nKey: "compare.s.gold", infoI18nKey: "compare.info.gold", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "usd" },
  { key: "bnbPrice", enabled: true, order: 600, refreshMs: 300_000, i18nKey: "compare.s.bnbPrice", infoI18nKey: "compare.info.bnbPrice", source: "OKX", color: "rgb(234 179 8)", unit: "usd" },
  { key: "xrpPrice", enabled: true, order: 610, refreshMs: 300_000, i18nKey: "compare.s.xrpPrice", infoI18nKey: "compare.info.xrpPrice", source: "OKX", color: "rgb(59 130 246)", unit: "usd" },
  { key: "dogePrice", enabled: true, order: 620, refreshMs: 300_000, i18nKey: "compare.s.dogePrice", infoI18nKey: "compare.info.dogePrice", source: "OKX", color: "rgb(202 138 4)", unit: "usd" },
  { key: "mempool", enabled: true, order: 630, refreshMs: 300_000, i18nKey: "compare.s.mempool", infoI18nKey: "compare.info.mempool", source: "blockchain.info", color: "rgb(245 158 11)", unit: "raw" },
  { key: "avgBlockSize", enabled: true, order: 640, refreshMs: 300_000, i18nKey: "compare.s.avgBlockSize", infoI18nKey: "compare.info.avgBlockSize", source: "blockchain.info", color: "rgb(34 197 94)", unit: "raw" },
  { key: "hangseng", enabled: true, order: 650, refreshMs: 300_000, i18nKey: "compare.s.hangseng", infoI18nKey: "compare.info.hangseng", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "raw" },
  { key: "nikkei", enabled: true, order: 660, refreshMs: 300_000, i18nKey: "compare.s.nikkei", infoI18nKey: "compare.info.nikkei", source: "Yahoo Finance", color: "rgb(220 38 38)", unit: "raw" },
  { key: "silver", enabled: true, order: 670, refreshMs: 300_000, i18nKey: "compare.s.silver", infoI18nKey: "compare.info.silver", source: "Yahoo Finance", color: "rgb(148 163 184)", unit: "usd" },
  { key: "oil", enabled: true, order: 680, refreshMs: 300_000, i18nKey: "compare.s.oil", infoI18nKey: "compare.info.oil", source: "Yahoo Finance", color: "rgb(34 197 94)", unit: "usd" },
  { key: "copper", enabled: true, order: 690, refreshMs: 300_000, i18nKey: "compare.s.copper", infoI18nKey: "compare.info.copper", source: "Yahoo Finance", color: "rgb(217 119 6)", unit: "usd" },
  { key: "natgas", enabled: true, order: 700, refreshMs: 300_000, i18nKey: "compare.s.natgas", infoI18nKey: "compare.info.natgas", source: "Yahoo Finance", color: "rgb(59 130 246)", unit: "usd" },
]

const SCIENTIFIC_GROUP_KEYS: readonly [CryptoIndicatorGroup, readonly string[]][] = [
  ["strategySignals", ["crowdingScore", "extensionScore", "trendScore", "cascadeScore", "exhaustionScore", "cascadeInProgress"]],
  ["priceAnchors", ["btcPrice", "indexPrice", "vwap"]],
  ["priceDeviation", ["dev", "vel1", "vel3", "vel5", "vwapDistancePct", "vwapZScore", "rsi14", "btcReturnZ", "retZRobust", "btcMomentum7d", "btcMomentum30d", "btcMomentum90d", "btcDrawdown", "upperWick", "lowerWick"]],
  ["trendStructure", ["ema20", "ema50", "ema60", "ema200", "donchianUpper20", "donchianLower20"]],
  ["trendStrength", ["normalizedTrendScore", "trendAgree", "ret24hNorm", "ret72hNorm", "ret7dNorm", "ema20Slope", "ema50Slope", "adx14", "plusDi", "minusDi", "donchianBreak", "trendRegime"]],
  ["volatilityPrice", ["atr14", "atr60", "atr1h", "atrTf"]],
  ["volatilityNormalized", ["sigma1m", "atrPct", "realizedVol", "btcRealizedVol30d", "rvPercentile30d", "rvPercentile90d", "volRegime", "dvol"]],
  ["volumeActivity", ["btcVolumeUsd", "btcVolumeZ", "volumeBurst"]],
  ["orderFlow", ["buyVolume", "sellVolume", "volumeDelta", "cvd", "takerImbalancePct"]],
  ["fundingRates", ["funding", "perpIndexPremium", "basis"]],
  ["fundingExtremes", ["fundingPct30d", "fundingPct90d", "fundingZScore", "basisZScore"]],
  ["openInterestLevel", ["oi"]],
  ["openInterestChange", ["oiChangePct", "oiChange5m", "oiChange1h", "oiChange4h", "oiChange5mPercentile"]],
  ["openInterestCrowding", ["oiPct30d", "oiPct90d", "oiZScore", "oiReturnZ", "oiVolumeRatio"]],
  ["traderPositioning", ["ls", "contractLs", "longShortZScore", "topTraderAccount", "topTraderPosition"]],
  ["liquidationFlow", ["liqLong", "liqShort", "liquidationNotional", "liquidationCount"]],
  ["liquidationStress", ["liquidationZScore", "liquidationPercentile", "liqOverOi", "liqOiPercentile", "liquidationImbalance", "liqDecaying"]],
  ["marketLiquidity", ["bidDepth01", "askDepth01", "bidDepth05", "askDepth05", "bidDepth1", "askDepth1"]],
  ["executionStress", ["spread", "spreadPercentile", "orderbookImbalance"]],
  ["eventLifecycle", ["eventActive", "eventDirection", "eventVwap", "eventExtreme", "reclaimFraction", "eventVerdict"]],
  ["sentiment", ["fng", "eatFearScore", "eatGreedScore"]],
  ["smartMoney", ["smartBuy", "smartSell", "smartNet", "smartCum"]],
  ["onchainActivity", ["activeAddrs", "nTxs", "txFeesUsd", "mempool", "avgBlockSize", "stablecoinMcap", "defiTvl"]],
  ["networkSecurity", ["hashRate", "difficulty"]],
  ["minerEconomics", ["miningComprehensiveCost", "miningElectricityCost"]],
  ["cryptoCrossSection", ["ethPrice", "solPrice", "bnbPrice", "xrpPrice", "dogePrice"]],
  ["macroEquities", ["nasdaq", "sp500", "russell", "vix", "nikkei", "hangseng"]],
  ["macroRates", ["dxy", "us10y", "us2y"]],
  ["commodities", ["gold", "silver", "oil", "copper", "natgas"]],
  ["manipulation", ["manipLeveragePressure", "manipPriceOiDivergence", "manipFundingSqueezeZ", "manipBasisDislocationZ", "manipTakerImbalancePct", "manipCvdPriceDivergence", "manipLiquidationImbalancePct", "manipLiquidationIntensityZ", "manipWickAsymmetryPct", "manipVolumeImpactZ"]],
  ["customSignals", ["signalBuyScore", "signalSellScore", "signalRiskScore", "signalDirection"]],
]

const SCIENTIFIC_GROUP_BY_KEY = new Map<string, CryptoIndicatorGroup>(
  SCIENTIFIC_GROUP_KEYS.flatMap(([group, keys]) => keys.map((key) => [key, group] as const)),
)

function getScientificGroup(key: string): CryptoIndicatorGroup {
  return SCIENTIFIC_GROUP_BY_KEY.get(key) ?? "secondary"
}

export function getEnabledCryptoIndicators(): CryptoIndicatorConfig[] {
  const coreKeys = new Set(CRYPTO_QUANT_CORE_CONFIG.map((entry) => entry.key))
  const secondary = CRYPTO_INDICATOR_CONFIG.filter((entry) => entry.enabled && !coreKeys.has(entry.key)).map((entry) => ({
    ...entry,
    order: entry.order + 1_000,
    relevanceScore: entry.relevanceScore ?? CRYPTO_RELEVANCE_SCORES[entry.key],
    group: getScientificGroup(entry.key),
    tier: entry.tier ?? "secondary",
  }))
  return [...CRYPTO_QUANT_CORE_CONFIG, ...secondary].filter((entry) => entry.enabled).map((entry) => {
    const priority = BTC_WICK_PRIORITY[entry.key]
    const tier = entry.tier ?? "core"
    return {
      ...entry,
      order: priority ? priority * 10 : (tier === "core" ? 10_000 : 20_000) + entry.order,
      relevanceScore: entry.relevanceScore ?? CRYPTO_RELEVANCE_SCORES[entry.key],
      group: getScientificGroup(entry.key),
      tier,
    }
  }).sort((a, b) => {
    const orderDelta = a.order - b.order
    if (orderDelta !== 0) return orderDelta
    return a.key.localeCompare(b.key)
  })
}
