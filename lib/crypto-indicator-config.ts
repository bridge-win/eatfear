export type CryptoIndicatorUnit = "usd" | "cny" | "pct" | "ratio" | "raw" | "count"

export interface CryptoIndicatorConfig {
  /** Stable series key; this must match the key generated in the history API. */
  key: string
  /** Set to false to hide this indicator from both realtime cards and history charts. */
  enabled: boolean
  /**
   * Lower numbers display first.
   * Tiers reflect BTC return prediction power validated in academic literature:
   *   S (1–119)   — highest validated drivers (momentum, derivatives, macro anchors, liquidity)
   *   A (140–199) — important contextual signals (rates, positioning, sentiment, risk diffusion)
   *   B (250–299) — supporting signals (on-chain activity, miners, ecosystem)
   *   C (360–449) — low direct BTC-return alpha (regional equity, commodities, altcoin beta)
   *   Custom (500+) — effectiveness depends on backtest
   */
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
}

export const DEFAULT_CRYPTO_HISTORY_REFRESH_MS = 300_000

export const CRYPTO_INDICATOR_CONFIG: readonly CryptoIndicatorConfig[] = [
  // ─── S-tier: highest research-validated BTC prediction power ────────────────────────────────

  // S — price / return momentum (Liu-Tsyvinski 2021: momentum is the strongest single predictor of BTC returns)
  { key: "btcPrice",    enabled: true, order: 10, refreshMs: 300_000, i18nKey: "compare.s.price",    infoI18nKey: "compare.info.btcPrice",    source: "blockchain.info / OKX",       color: "rgb(99 102 241)",  unit: "usd" },
  { key: "btcReturnZ", enabled: true, order: 20, refreshMs: 300_000, i18nKey: "compare.s.returnZ",  infoI18nKey: "compare.info.btcReturnZ",  source: "OKX / computed",              color: "rgb(244 63 94)",   unit: "raw" },

  // S — derivatives: funding / OI / basis (Cong-Xiao 2023: funding & OI are the leading short-term crowding and leverage signals)
  { key: "funding",    enabled: true, order: 30, refreshMs: 300_000, i18nKey: "compare.s.funding",  infoI18nKey: "compare.info.funding",     source: "OKX",                         color: "rgb(236 72 153)",  unit: "pct" },
  { key: "oi",         enabled: true, order: 40, refreshMs: 300_000, i18nKey: "compare.s.oi",       infoI18nKey: "compare.info.oi",          source: "OKX",                         color: "rgb(59 130 246)",  unit: "usd" },
  { key: "oiReturnZ",  enabled: true, order: 50, refreshMs: 300_000, i18nKey: "compare.s.oiZ",      infoI18nKey: "compare.info.oiReturnZ",   source: "OKX / computed",              color: "rgb(14 165 233)",  unit: "raw" },
  { key: "basis",      enabled: true, order: 55, refreshMs: 300_000, i18nKey: "compare.s.basis",    infoI18nKey: "compare.info.basis",       source: "OKX / computed",              color: "rgb(14 165 233)",  unit: "pct" },

  // S — volume (validates momentum; volume Z-score confirmed as short-term signal across crypto papers)
  { key: "btcVolumeUsd", enabled: true, order: 60, refreshMs: 300_000, i18nKey: "compare.s.volumeUsd", infoI18nKey: "compare.info.btcVolumeUsd", source: "OKX",             color: "rgb(37 99 235)",  unit: "usd" },
  { key: "btcVolumeZ",   enabled: true, order: 65, refreshMs: 300_000, i18nKey: "compare.s.volumeZ",   infoI18nKey: "compare.info.btcVolumeZ",   source: "OKX / computed",  color: "rgb(245 158 11)", unit: "raw" },

  // S — options implied volatility (Alexander-Baig 2020: DVOL is a validated leading vol signal; elevated from A-tier)
  { key: "dvol", enabled: true, order: 70, refreshMs: 300_000, i18nKey: "compare.s.dvol", infoI18nKey: "compare.info.dvol", source: "Deribit", color: "rgb(244 114 182)", unit: "raw" },

  // S — macro risk anchors (Bianchi-Tamoni 2022: DXY and risk-off proxies are validated cross-asset BTC factors)
  { key: "dxy",    enabled: true, order: 80, refreshMs: 300_000, i18nKey: "compare.s.dxy",    infoI18nKey: "compare.info.dxy",    source: "Yahoo Finance", color: "rgb(99 102 241)",  unit: "raw" },
  { key: "vix",    enabled: true, order: 85, refreshMs: 300_000, i18nKey: "compare.s.vix",    infoI18nKey: "compare.info.vix",    source: "Yahoo Finance", color: "rgb(220 38 38)",   unit: "raw" },
  { key: "nasdaq", enabled: true, order: 90, refreshMs: 300_000, i18nKey: "compare.s.nasdaq", infoI18nKey: "compare.info.nasdaq", source: "Yahoo Finance", color: "rgb(168 85 247)",  unit: "raw" },
  { key: "sp500",  enabled: true, order: 95, refreshMs: 300_000, i18nKey: "compare.s.sp500",  infoI18nKey: "compare.info.sp500",  source: "Yahoo Finance", color: "rgb(99 102 241)",  unit: "raw" },

  // S — on-venue liquidity (Cong-Xiao 2023: stablecoin supply is a validated leading liquidity proxy for BTC)
  { key: "stablecoinMcap", enabled: true, order: 100, refreshMs: 300_000, i18nKey: "compare.s.stablecoin", infoI18nKey: "compare.info.stablecoinMcap", source: "DefiLlama", color: "rgb(20 184 166)", unit: "usd" },

  // S — price structure (candlestick rejection signals)
  { key: "upperWick", enabled: true, order: 110, refreshMs: 300_000, i18nKey: "compare.s.upperWick", infoI18nKey: "compare.info.upperWick", source: "OKX / computed", color: "rgb(220 38 38)", unit: "pct" },
  { key: "lowerWick", enabled: true, order: 115, refreshMs: 300_000, i18nKey: "compare.s.lowerWick", infoI18nKey: "compare.info.lowerWick", source: "OKX / computed", color: "rgb(22 163 74)", unit: "pct" },

  // ─── A-tier: important contextual signals ───────────────────────────────────────────────────

  // A — rates / real-yield opportunity cost (Bianchi-Tamoni 2022: real rates price crypto cross-sectionally)
  { key: "us10y", enabled: true, order: 140, refreshMs: 300_000, i18nKey: "compare.s.us10y", infoI18nKey: "compare.info.us10y", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "pct" },
  { key: "us2y",  enabled: true, order: 145, refreshMs: 300_000, i18nKey: "compare.s.us2y",  infoI18nKey: "compare.info.us2y",  source: "Yahoo Finance", color: "rgb(236 72 153)", unit: "pct" },

  // A — derivatives positioning (elevated from 180-210: L/S positioning validated as informative for short-term reversals)
  { key: "contractLs",       enabled: true, order: 150, refreshMs: 300_000, i18nKey: "compare.s.contractLs",       infoI18nKey: "compare.info.contractLs",       source: "OKX", color: "rgb(99 102 241)",  unit: "ratio" },
  { key: "ls",               enabled: true, order: 155, refreshMs: 300_000, i18nKey: "compare.s.ls",               infoI18nKey: "compare.info.ls",               source: "OKX", color: "rgb(168 85 247)",  unit: "ratio" },
  { key: "topTraderPosition", enabled: true, order: 160, refreshMs: 300_000, i18nKey: "compare.s.topTraderPosition", infoI18nKey: "compare.info.topTraderPosition", source: "OKX", color: "rgb(217 70 239)", unit: "ratio" },
  { key: "topTraderAccount",  enabled: true, order: 165, refreshMs: 300_000, i18nKey: "compare.s.topTraderAccount",  infoI18nKey: "compare.info.topTraderAccount",  source: "OKX", color: "rgb(192 132 252)", unit: "ratio" },

  // A — sentiment / safe-haven / risk diffusion
  { key: "fng",     enabled: true, order: 170, refreshMs: 300_000, i18nKey: "compare.s.fng",     infoI18nKey: "compare.info.fng",     source: "alternative.me",  color: "rgb(245 158 11)", unit: "raw" },
  { key: "gold",    enabled: true, order: 175, refreshMs: 300_000, i18nKey: "compare.s.gold",    infoI18nKey: "compare.info.gold",    source: "Yahoo Finance",   color: "rgb(245 158 11)", unit: "usd" },
  { key: "russell", enabled: true, order: 180, refreshMs: 300_000, i18nKey: "compare.s.russell", infoI18nKey: "compare.info.russell", source: "Yahoo Finance",   color: "rgb(20 184 166)", unit: "raw" },
  { key: "defiTvl", enabled: true, order: 185, refreshMs: 300_000, i18nKey: "compare.s.defiTvl", infoI18nKey: "compare.info.defiTvl", source: "DefiLlama",       color: "rgb(34 197 94)",  unit: "usd" },
  { key: "ethPrice", enabled: true, order: 190, refreshMs: 300_000, i18nKey: "compare.s.ethPrice", infoI18nKey: "compare.info.ethPrice", source: "OKX",          color: "rgb(168 85 247)", unit: "usd" },

  // ─── B-tier: supporting signals ─────────────────────────────────────────────────────────────

  // B — on-chain activity (blockchain.info; useful for medium-term adoption trends, weak daily-return signal)
  { key: "activeAddrs", enabled: true, order: 250, refreshMs: 300_000, i18nKey: "compare.s.activeAddrs", infoI18nKey: "compare.info.activeAddrs", source: "blockchain.info", color: "rgb(99 102 241)", unit: "count" },
  { key: "nTxs",        enabled: true, order: 255, refreshMs: 300_000, i18nKey: "compare.s.nTxs",        infoI18nKey: "compare.info.nTxs",        source: "blockchain.info", color: "rgb(59 130 246)", unit: "count" },
  { key: "txFeesUsd",   enabled: true, order: 260, refreshMs: 300_000, i18nKey: "compare.s.txFeesUsd",   infoI18nKey: "compare.info.txFeesUsd",   source: "blockchain.info", color: "rgb(220 38 38)",  unit: "usd"   },
  { key: "mempool",     enabled: true, order: 265, refreshMs: 300_000, i18nKey: "compare.s.mempool",     infoI18nKey: "compare.info.mempool",     source: "blockchain.info", color: "rgb(245 158 11)", unit: "raw"   },

  // B — miners / network security (long-horizon cost floors; weak short-term return signal)
  { key: "hashRate",              enabled: true, order: 270, refreshMs: 300_000, i18nKey: "compare.s.hashRate",              infoI18nKey: "compare.info.hashRate",              source: "blockchain.info",          color: "rgb(20 184 166)",  unit: "raw" },
  { key: "difficulty",            enabled: true, order: 275, refreshMs: 300_000, i18nKey: "compare.s.difficulty",            infoI18nKey: "compare.info.difficulty",            source: "blockchain.info",          color: "rgb(168 85 247)",  unit: "raw" },
  { key: "miningComprehensiveCost", enabled: true, order: 280, refreshMs: 300_000, i18nKey: "compare.s.miningComprehensiveCost", infoI18nKey: "compare.info.miningComprehensiveCost", source: "mempool.space / blockchain.info", color: "rgb(217 119 6)", unit: "usd" },
  { key: "miningElectricityCost", enabled: true, order: 285, refreshMs: 300_000, i18nKey: "compare.s.miningElectricityCost", infoI18nKey: "compare.info.miningElectricityCost", source: "mempool.space / blockchain.info", color: "rgb(245 158 11)", unit: "usd" },

  // B — exchange-ecosystem beta (BNB as CEX activity proxy)
  { key: "bnbPrice", enabled: true, order: 295, refreshMs: 300_000, i18nKey: "compare.s.bnbPrice", infoI18nKey: "compare.info.bnbPrice", source: "OKX", color: "rgb(234 179 8)", unit: "usd" },

  // ─── C-tier: low direct BTC-return alpha ────────────────────────────────────────────────────

  // C — regional equity (low BTC-return correlation; geopolitical context only)
  { key: "hangseng", enabled: true, order: 360, refreshMs: 300_000, i18nKey: "compare.s.hangseng", infoI18nKey: "compare.info.hangseng", source: "Yahoo Finance", color: "rgb(245 158 11)", unit: "raw" },
  { key: "nikkei",   enabled: true, order: 365, refreshMs: 300_000, i18nKey: "compare.s.nikkei",   infoI18nKey: "compare.info.nikkei",   source: "Yahoo Finance", color: "rgb(220 38 38)",  unit: "raw" },

  // C — commodities (low BTC-return alpha; macro narrative context)
  { key: "silver", enabled: true, order: 370, refreshMs: 300_000, i18nKey: "compare.s.silver", infoI18nKey: "compare.info.silver", source: "Yahoo Finance", color: "rgb(148 163 184)", unit: "usd" },
  { key: "oil",    enabled: true, order: 375, refreshMs: 300_000, i18nKey: "compare.s.oil",    infoI18nKey: "compare.info.oil",    source: "Yahoo Finance", color: "rgb(34 197 94)",   unit: "usd" },
  { key: "copper", enabled: true, order: 380, refreshMs: 300_000, i18nKey: "compare.s.copper", infoI18nKey: "compare.info.copper", source: "Yahoo Finance", color: "rgb(217 119 6)",   unit: "usd" },
  { key: "natgas", enabled: true, order: 385, refreshMs: 300_000, i18nKey: "compare.s.natgas", infoI18nKey: "compare.info.natgas", source: "Yahoo Finance", color: "rgb(59 130 246)",  unit: "usd" },

  // C — altcoins (Bianchi-Tamoni 2022: major alts are primarily BTC-driven beta with minimal standalone alpha for BTC prediction; SOL/XRP/DOGE demoted from A-tier)
  { key: "solPrice",  enabled: true, order: 390, refreshMs: 300_000, i18nKey: "compare.s.solPrice",  infoI18nKey: "compare.info.solPrice",  source: "OKX", color: "rgb(20 184 166)",  unit: "usd" },
  { key: "xrpPrice",  enabled: true, order: 395, refreshMs: 300_000, i18nKey: "compare.s.xrpPrice",  infoI18nKey: "compare.info.xrpPrice",  source: "OKX", color: "rgb(59 130 246)",  unit: "usd" },
  { key: "dogePrice", enabled: true, order: 400, refreshMs: 300_000, i18nKey: "compare.s.dogePrice", infoI18nKey: "compare.info.dogePrice", source: "OKX", color: "rgb(202 138 4)",   unit: "usd" },

  // C — block utilization
  { key: "avgBlockSize", enabled: true, order: 410, refreshMs: 300_000, i18nKey: "compare.s.avgBlockSize", infoI18nKey: "compare.info.avgBlockSize", source: "blockchain.info", color: "rgb(34 197 94)", unit: "raw" },

  // ─── Custom: effectiveness depends on backtest, not tier label ──────────────────────────────
  { key: "signalBuyScore",  enabled: true, order: 500, refreshMs: 300_000, i18nKey: "compare.s.signalBuy",       infoI18nKey: "compare.info.signalBuyScore",  source: "OKX / computed custom signal", color: "rgb(22 163 74)",  unit: "raw" },
  { key: "signalSellScore", enabled: true, order: 510, refreshMs: 300_000, i18nKey: "compare.s.signalSell",      infoI18nKey: "compare.info.signalSellScore", source: "OKX / computed custom signal", color: "rgb(220 38 38)",  unit: "raw" },
  { key: "signalRiskScore", enabled: true, order: 520, refreshMs: 300_000, i18nKey: "compare.s.signalRisk",      infoI18nKey: "compare.info.signalRiskScore", source: "OKX / computed custom signal", color: "rgb(245 158 11)", unit: "raw" },
  { key: "signalDirection", enabled: true, order: 530, refreshMs: 300_000, i18nKey: "compare.s.signalDirection", infoI18nKey: "compare.info.signalDirection", source: "OKX / computed custom signal", color: "rgb(99 102 241)", unit: "raw" },
  { key: "smartBuy",  enabled: true, order: 540, refreshMs: 300_000, i18nKey: "compare.s.smartBuy",  infoI18nKey: "compare.info.smartBuy",  source: "OKX",          color: "rgb(22 163 74)",  unit: "raw" },
  { key: "smartSell", enabled: true, order: 550, refreshMs: 300_000, i18nKey: "compare.s.smartSell", infoI18nKey: "compare.info.smartSell", source: "OKX",          color: "rgb(220 38 38)",  unit: "raw" },
  { key: "smartNet",  enabled: true, order: 560, refreshMs: 300_000, i18nKey: "compare.s.smartNet",  infoI18nKey: "compare.info.smartNet",  source: "OKX / computed", color: "rgb(245 158 11)", unit: "raw" },
  { key: "smartCum",  enabled: true, order: 570, refreshMs: 300_000, i18nKey: "compare.s.smartCum",  infoI18nKey: "compare.info.smartCum",  source: "OKX / computed", color: "rgb(59 130 246)", unit: "raw" },
]

export function getEnabledCryptoIndicators(): CryptoIndicatorConfig[] {
  return CRYPTO_INDICATOR_CONFIG.filter((entry) => entry.enabled).sort((a, b) => {
    const orderDelta = a.order - b.order
    if (orderDelta !== 0) return orderDelta
    return a.key.localeCompare(b.key)
  })
}
