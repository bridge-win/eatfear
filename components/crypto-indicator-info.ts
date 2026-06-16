import type { CryptoHistoryPayload, CryptoHistorySeries } from "@/components/crypto-history-compare"
import { getCryptoSeriesBaseLabel } from "@/components/crypto-series-label"

type Translate = (key: string, vars?: Record<string, string | number>) => string

export const CUSTOM_CRYPTO_SIGNAL_KEYS = new Set([
  "signalBuyScore",
  "signalSellScore",
  "signalRiskScore",
  "signalDirection",
])

function formatValue(value: number, unit: CryptoHistorySeries["unit"]): string {
  if (!Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  switch (unit) {
    case "usd":
    case "cny": {
      const prefix = unit === "cny" ? "¥" : "$"
      if (abs >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`
      if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(2)}K`
      return `${prefix}${value.toFixed(2)}`
    }
    case "pct":
      return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`
    case "ratio":
      return value.toFixed(3)
    case "count":
      if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`
      return value.toFixed(0)
    default:
      if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`
      return value.toFixed(2)
  }
}

function getSeries(payload: CryptoHistoryPayload, key: string): CryptoHistorySeries | undefined {
  return payload.series.find((series) => series.key === key)
}

function getLatest(payload: CryptoHistoryPayload, key: string): number | null {
  const series = getSeries(payload, key)
  if (!series) return null
  for (let index = series.data.length - 1; index >= 0; index -= 1) {
    const value = series.data[index]?.value
    if (value !== null && value !== undefined && Number.isFinite(value)) return value
  }
  return null
}

function getOiChangePct(payload: CryptoHistoryPayload): number | null {
  const oi = getSeries(payload, "oi")
  if (!oi) return null
  const values = oi.data
    .filter((point) => point.value !== null && Number.isFinite(point.value))
    .map((point) => point.value as number)
  const last = values.at(-1)
  const previous = values.at(-2)
  if (last === undefined || previous === undefined || previous === 0) return null
  return (last / previous - 1) * 100
}

export function getCryptoIndicatorDescription({
  payload,
  series,
  t,
}: {
  payload: CryptoHistoryPayload
  series: CryptoHistorySeries
  t: Translate
}): string {
  const fallback = t(series.infoI18nKey, series.labelVars)
  const baseDescription =
    fallback === series.infoI18nKey
      ? t("compare.info.default", { label: getCryptoSeriesBaseLabel(t, series) })
      : fallback
  if (!CUSTOM_CRYPTO_SIGNAL_KEYS.has(series.key)) return baseDescription

  const retZ = getLatest(payload, "btcReturnZ")
  const volZ = getLatest(payload, "btcVolumeZ")
  const upperWick = getLatest(payload, "upperWick")
  const lowerWick = getLatest(payload, "lowerWick")
  const oiChangePct = getOiChangePct(payload)
  const funding = getLatest(payload, "funding")
  const ls = getLatest(payload, "ls")
  const buy = getLatest(payload, "signalBuyScore")
  const sell = getLatest(payload, "signalSellScore")
  const risk = getLatest(payload, "signalRiskScore")
  const direction = getLatest(payload, "signalDirection")

  const buyCalc = [
    retZ !== null && retZ < -2.5 ? 24 : 0,
    lowerWick !== null && lowerWick > 55 ? 20 : 0,
    volZ !== null && volZ > 2.5 ? 18 : 0,
    oiChangePct !== null && oiChangePct < -2 ? 20 : 0,
    funding !== null && funding < 0 ? 8 : 0,
    ls !== null && ls < 0.85 ? 10 : 0,
  ]
  const sellCalc = [
    retZ !== null && retZ > 2.5 ? 24 : 0,
    upperWick !== null && upperWick > 55 ? 20 : 0,
    volZ !== null && volZ > 2.5 ? 18 : 0,
    oiChangePct !== null && oiChangePct < -2 ? 16 : 0,
    funding !== null && funding > 0.05 ? 10 : 0,
    ls !== null && ls > 1.25 ? 12 : 0,
  ]

  return [
    baseDescription,
    "",
    "Data sources and latest values:",
    `- OKX 1D candles: ${payload.ccy} return Z=${retZ === null ? "—" : retZ.toFixed(2)}, volume Z=${volZ === null ? "—" : volZ.toFixed(2)}, upper wick=${upperWick === null ? "—" : formatValue(upperWick, "pct")}, lower wick=${lowerWick === null ? "—" : formatValue(lowerWick, "pct")}.`,
    `- OKX Open Interest: daily change=${oiChangePct === null ? "—" : formatValue(oiChangePct, "pct")}.`,
    `- OKX Funding: ${funding === null ? "—" : formatValue(funding, "pct")}.`,
    `- OKX Long/Short Account Ratio: ${ls === null ? "—" : formatValue(ls, "ratio")}.`,
    "",
    "Calculation:",
    "Buy = min(100, returnZ<-2.5?24 + lowerWick>55?20 + volumeZ>2.5?18 + oiChange<-2%?20 + funding<0?8 + longShort<0.85?10).",
    `Current Buy parts = ${buyCalc.join(" + ")} = ${buy === null ? "—" : buy.toFixed(2)}.`,
    "Sell = min(100, returnZ>2.5?24 + upperWick>55?20 + volumeZ>2.5?18 + oiChange<-2%?16 + funding>0.05%?10 + longShort>1.25?12).",
    `Current Sell parts = ${sellCalc.join(" + ")} = ${sell === null ? "—" : sell.toFixed(2)}.`,
    "Risk = min(100, abs(returnZ)*10 + max(volumeZ,0)*5 + abs(oiChange%)*3 + abs(funding%)*100 + abs(longShort-1)*20).",
    `Current Risk=${risk === null ? "—" : risk.toFixed(2)}; Direction=${direction === null ? "—" : direction.toFixed(0)} (1=bullish reversal, -1=overheated sell pressure, 2=risk-first, 0=neutral).`,
    "",
    "Reference method: high Buy means rebound conditions are richer, not an automatic long entry; high Sell means overheat/pullback risk; high Risk should be treated first by reducing leverage or waiting for confirmation. Use it together with price, OI, Funding, candle wicks, and volume rather than as a standalone trade trigger.",
  ].join("\n")
}
