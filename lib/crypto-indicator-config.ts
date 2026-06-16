export type CryptoIndicatorUnit = "usd" | "cny" | "pct" | "ratio" | "raw" | "count"

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
}

export const DEFAULT_CRYPTO_HISTORY_REFRESH_MS = 300_000

const CRYPTO_RELEVANCE_SCORES: Record<string, number> = {
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
  basis: 81,
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
  // Cross-asset context is useful, but crypto papers rank market-native factors first.
  { key: "nasdaq", enabled: true, order: 360, refreshMs: 300_000, i18nKey: "compare.s.nasdaq", infoI18nKey: "compare.info.nasdaq", source: "Yahoo Finance", color: "rgb(168 85 247)", unit: "raw" },
  { key: "sp500", enabled: true, order: 370, refreshMs: 300_000, i18nKey: "compare.s.sp500", infoI18nKey: "compare.info.sp500", source: "Yahoo Finance", color: "rgb(99 102 241)", unit: "raw" },
  { key: "dxy", enabled: true, order: 380, refreshMs: 300_000, i18nKey: "compare.s.dxy", infoI18nKey: "compare.info.dxy", source: "Yahoo Finance", color: "rgb(99 102 241)", unit: "raw" },
  { key: "vix", enabled: true, order: 390, refreshMs: 300_000, i18nKey: "compare.s.vix", infoI18nKey: "compare.info.vix", source: "Yahoo Finance", color: "rgb(220 38 38)", unit: "raw" },
  { key: "us10y", enabled: true, order: 400, refreshMs: 300_000, i18nKey: "compare.s.us10y", infoI18nKey: "compare.info.us10y", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "pct" },
  { key: "us2y", enabled: true, order: 410, refreshMs: 300_000, i18nKey: "compare.s.us2y", infoI18nKey: "compare.info.us2y", source: "Yahoo Finance", color: "rgb(236 72 153)", unit: "pct" },
  { key: "upperWick", enabled: true, order: 420, refreshMs: 300_000, i18nKey: "compare.s.upperWick", infoI18nKey: "compare.info.upperWick", source: "OKX / computed", color: "rgb(220 38 38)", unit: "pct" },
  { key: "lowerWick", enabled: true, order: 430, refreshMs: 300_000, i18nKey: "compare.s.lowerWick", infoI18nKey: "compare.info.lowerWick", source: "OKX / computed", color: "rgb(22 163 74)", unit: "pct" },
  { key: "signalBuyScore", enabled: true, order: 440, refreshMs: 300_000, i18nKey: "compare.s.signalBuy", infoI18nKey: "compare.info.signalBuyScore", source: "OKX / computed custom signal", color: "rgb(22 163 74)", unit: "raw" },
  { key: "signalSellScore", enabled: true, order: 450, refreshMs: 300_000, i18nKey: "compare.s.signalSell", infoI18nKey: "compare.info.signalSellScore", source: "OKX / computed custom signal", color: "rgb(220 38 38)", unit: "raw" },
  { key: "signalRiskScore", enabled: true, order: 460, refreshMs: 300_000, i18nKey: "compare.s.signalRisk", infoI18nKey: "compare.info.signalRiskScore", source: "OKX / computed custom signal", color: "rgb(245 158 11)", unit: "raw" },
  { key: "signalDirection", enabled: true, order: 470, refreshMs: 300_000, i18nKey: "compare.s.signalDirection", infoI18nKey: "compare.info.signalDirection", source: "OKX / computed custom signal", color: "rgb(99 102 241)", unit: "raw" },
  { key: "russell", enabled: true, order: 480, refreshMs: 300_000, i18nKey: "compare.s.russell", infoI18nKey: "compare.info.russell", source: "Yahoo Finance", color: "rgb(20 184 166)", unit: "raw" },
  { key: "gold", enabled: true, order: 490, refreshMs: 300_000, i18nKey: "compare.s.gold", infoI18nKey: "compare.info.gold", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "usd" },
  { key: "bnbPrice", enabled: true, order: 500, refreshMs: 300_000, i18nKey: "compare.s.bnbPrice", infoI18nKey: "compare.info.bnbPrice", source: "OKX", color: "rgb(234 179 8)", unit: "usd" },
  { key: "xrpPrice", enabled: true, order: 510, refreshMs: 300_000, i18nKey: "compare.s.xrpPrice", infoI18nKey: "compare.info.xrpPrice", source: "OKX", color: "rgb(59 130 246)", unit: "usd" },
  { key: "dogePrice", enabled: true, order: 520, refreshMs: 300_000, i18nKey: "compare.s.dogePrice", infoI18nKey: "compare.info.dogePrice", source: "OKX", color: "rgb(202 138 4)", unit: "usd" },
  { key: "mempool", enabled: true, order: 530, refreshMs: 300_000, i18nKey: "compare.s.mempool", infoI18nKey: "compare.info.mempool", source: "blockchain.info", color: "rgb(245 158 11)", unit: "raw" },
  { key: "avgBlockSize", enabled: true, order: 540, refreshMs: 300_000, i18nKey: "compare.s.avgBlockSize", infoI18nKey: "compare.info.avgBlockSize", source: "blockchain.info", color: "rgb(34 197 94)", unit: "raw" },
  { key: "hangseng", enabled: true, order: 550, refreshMs: 300_000, i18nKey: "compare.s.hangseng", infoI18nKey: "compare.info.hangseng", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "raw" },
  { key: "nikkei", enabled: true, order: 560, refreshMs: 300_000, i18nKey: "compare.s.nikkei", infoI18nKey: "compare.info.nikkei", source: "Yahoo Finance", color: "rgb(220 38 38)", unit: "raw" },
  { key: "silver", enabled: true, order: 570, refreshMs: 300_000, i18nKey: "compare.s.silver", infoI18nKey: "compare.info.silver", source: "Yahoo Finance", color: "rgb(148 163 184)", unit: "usd" },
  { key: "oil", enabled: true, order: 580, refreshMs: 300_000, i18nKey: "compare.s.oil", infoI18nKey: "compare.info.oil", source: "Yahoo Finance", color: "rgb(34 197 94)", unit: "usd" },
  { key: "copper", enabled: true, order: 590, refreshMs: 300_000, i18nKey: "compare.s.copper", infoI18nKey: "compare.info.copper", source: "Yahoo Finance", color: "rgb(217 119 6)", unit: "usd" },
  { key: "natgas", enabled: true, order: 600, refreshMs: 300_000, i18nKey: "compare.s.natgas", infoI18nKey: "compare.info.natgas", source: "Yahoo Finance", color: "rgb(59 130 246)", unit: "usd" },
]

export function getEnabledCryptoIndicators(): CryptoIndicatorConfig[] {
  return CRYPTO_INDICATOR_CONFIG.filter((entry) => entry.enabled).map((entry) => ({
    ...entry,
    relevanceScore: entry.relevanceScore ?? CRYPTO_RELEVANCE_SCORES[entry.key],
  })).sort((a, b) => {
    const orderDelta = a.order - b.order
    if (orderDelta !== 0) return orderDelta
    return a.key.localeCompare(b.key)
  })
}
