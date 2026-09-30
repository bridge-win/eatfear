import type { CryptoHistorySeries } from "../components/crypto-history-compare.tsx"
import {
  getEnabledCryptoIndicators,
  type CryptoIndicatorConfig,
} from "./crypto-indicator-config.ts"

export type CryptoSeriesScope = "instrument" | "bitcoin" | "global"
export type CryptoComparisonMode = "indexed" | "raw" | "zscore"

export interface CryptoWorkspaceSelection {
  asset: string
  key: string
  scope: CryptoSeriesScope
}

const GLOBAL_KEYS = new Set([
  "stablecoinMcap",
  "defiTvl",
  "fng",
  "dvol",
  "dxy",
  "us10y",
  "us2y",
  "vix",
  "sp500",
  "nasdaq",
  "russell",
  "gold",
  "silver",
  "copper",
  "oil",
  "natgas",
  "nikkei",
  "hangseng",
])

const BITCOIN_KEYS = new Set([
  "hashRate",
  "difficulty",
  "nTxs",
  "activeAddrs",
  "mempool",
  "txFeesUsd",
  "avgBlockSize",
  "miningElectricityCost",
  "miningComprehensiveCost",
  "mayerMultiple",
  "puellMultiple",
  "ahr999",
  "etfNetFlow",
])

const LEGACY_CROSS_SECTION_PRICE_KEYS = new Set([
  "ethPrice",
  "solPrice",
  "xrpPrice",
  "bnbPrice",
  "dogePrice",
])

const SUPPLY_SUPPORTED_ASSETS = new Set([
  "BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "TRX", "TON", "LINK",
  "AVAX", "DOT", "BCH", "LTC", "NEAR", "APT", "SUI", "ICP", "ETC", "UNI",
  "MATIC", "ATOM", "OP", "ARB", "FIL", "AAVE", "INJ", "ORDI", "PEPE", "WIF",
])

export function getCryptoSeriesScope(key: string): CryptoSeriesScope {
  if (GLOBAL_KEYS.has(key)) return "global"
  if (BITCOIN_KEYS.has(key)) return "bitcoin"
  return "instrument"
}

export function getCryptoWorkspaceIndicators(asset: string): CryptoIndicatorConfig[] {
  const normalizedAsset = asset.toUpperCase()
  return getEnabledCryptoIndicators().filter((indicator) => {
    if (LEGACY_CROSS_SECTION_PRICE_KEYS.has(indicator.key)) return false
    if (indicator.key === "circulatingSupply" && !SUPPLY_SUPPORTED_ASSETS.has(normalizedAsset)) return false
    const scope = getCryptoSeriesScope(indicator.key)
    if (normalizedAsset === "GLOBAL") return scope === "global"
    if (scope === "global") return false
    if (scope === "bitcoin") return normalizedAsset === "BTC"
    return true
  })
}

export function getCryptoWorkspaceSelectionId(selection: CryptoWorkspaceSelection): string {
  return `${selection.scope}:${selection.asset.toUpperCase()}:${selection.key}`
}

export function normalizeCryptoHistorySeries(
  series: CryptoHistorySeries,
  mode: CryptoComparisonMode,
): CryptoHistorySeries {
  if (mode === "raw") return series
  const finiteValues = series.data
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  if (finiteValues.length === 0) return { ...series, unit: "raw" }

  if (mode === "indexed") {
    const first = finiteValues.find((value) => value !== 0)
    if (first === undefined) return { ...series, unit: "raw" }
    return {
      ...series,
      unit: "raw",
      data: series.data.map((point) => ({
        ...point,
        value: point.value === null ? null : (point.value / first) * 100,
      })),
    }
  }

  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
  const variance = finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finiteValues.length
  const deviation = Math.sqrt(variance)
  return {
    ...series,
    unit: "raw",
    data: series.data.map((point) => ({
      ...point,
      value: point.value === null || deviation === 0 ? null : (point.value - mean) / deviation,
    })),
  }
}
