import { NextResponse } from "next/server"

import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import { fetchBlockchainInfoSeries } from "@/lib/data-sources/blockchain-info-charts"
import { fetchOkxDailyCloses } from "@/lib/okx-history"
import { getRangeDays, getTimeRange, isTimeRangeId } from "@/lib/time-range"

export const revalidate = 300

export type BuyWindowSignalZone = "extreme_buy" | "buy" | "watch" | "neutral" | "sell"

function puellZone(v: number): BuyWindowSignalZone {
  if (v < 0.3) return "extreme_buy"
  if (v < 0.5) return "buy"
  if (v < 0.7) return "watch"
  if (v < 2.0) return "neutral"
  return "sell"
}

function mayerZone(v: number): BuyWindowSignalZone {
  if (v < 0.6) return "extreme_buy"
  if (v < 0.8) return "buy"
  if (v < 1.0) return "watch"
  if (v < 2.0) return "neutral"
  return "sell"
}

function fearGreedZone(v: number): BuyWindowSignalZone {
  if (v <= 10) return "extreme_buy"
  if (v <= 20) return "buy"
  if (v <= 35) return "watch"
  if (v <= 65) return "neutral"
  return "sell"
}

function zoneScore(z: BuyWindowSignalZone): number {
  switch (z) {
    case "extreme_buy": return 100
    case "buy": return 80
    case "watch": return 50
    case "neutral": return 25
    case "sell": return 5
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedRange = url.searchParams.get("range")
  const rangeCandidate = requestedRange ?? ""
  const rangeId = isTimeRangeId(rangeCandidate) ? rangeCandidate : "1y"
  const range = getTimeRange(rangeId)
  const daysWanted = Math.max(365, getRangeDays(rangeId))

  const [closes, minerRevRaw, fgr] = await Promise.all([
    fetchOkxDailyCloses({ instId: "BTC-USDT-SWAP", daysWanted, revalidateSeconds: revalidate }),
    fetchBlockchainInfoSeries("miners-revenue", getRangeDays(rangeId) > 365 * 2 ? getRangeDays(rangeId) > 365 * 5 ? "all" : "5years" : "2years", revalidate),
    fetchFearGreedHistory(range, revalidate),
  ])

  // ── Mayer Multiple ─────────────────────────────────────────
  let mayerValue: number | null = null
  let mayerZ: BuyWindowSignalZone = "neutral"
  if (closes.length >= 60) {
    const smaLen = Math.min(closes.length, 200)
    const sma200 = closes.slice(-smaLen).reduce((s, v) => s + v, 0) / smaLen
    const latest = closes[closes.length - 1]
    if (latest !== undefined && sma200 > 0) {
      mayerValue = latest / sma200
      mayerZ = mayerZone(mayerValue)
    }
  }

  // ── Puell Multiple ─────────────────────────────────────────
  let puellValue: number | null = null
  let puellZ: BuyWindowSignalZone = "neutral"
  const minerRevSeries = minerRevRaw.map((p) => p.value)
  if (minerRevSeries.length >= 30) {
    const current = minerRevSeries[minerRevSeries.length - 1]
    const maLen = Math.min(minerRevSeries.length, 365)
    const ma365 = minerRevSeries.slice(-maLen).reduce((s, v) => s + v, 0) / maLen
    if (current !== undefined && ma365 > 0) {
      puellValue = current / ma365
      puellZ = puellZone(puellValue)
    }
  }

  // ── Fear & Greed ────────────────────────────────────────────
  const fgValue = fgr?.currentValue ?? null
  const fgZ: BuyWindowSignalZone = fgValue !== null ? fearGreedZone(fgValue) : "neutral"

  // ── Composite ───────────────────────────────────────────────
  const signalWeights = [
    { zone: mayerZ, w: 0.40 },
    { zone: puellZ, w: 0.35 },
    { zone: fgZ, w: 0.25 },
  ]
  const compositeScore = Math.round(signalWeights.reduce((s, sig) => s + zoneScore(sig.zone) * sig.w, 0))
  const buySignals = signalWeights.filter((s) => s.zone === "extreme_buy" || s.zone === "buy").length
  const extremeSignals = signalWeights.filter((s) => s.zone === "extreme_buy").length

  let windowBand: "extreme" | "active" | "watch" | "none"
  if (extremeSignals >= 2) windowBand = "extreme"
  else if (buySignals >= 2) windowBand = "active"
  else if (buySignals >= 1) windowBand = "watch"
  else windowBand = "none"

  return NextResponse.json({
    updatedAt: Date.now(),
    range: rangeId,
    compositeScore,
    windowBand,
    signals: {
      mayerMultiple: {
        value: mayerValue !== null ? Math.round(mayerValue * 1000) / 1000 : null,
        zone: mayerZ,
        thresholds: { extreme_buy: 0.6, buy: 0.8 },
        unit: "ratio",
        descZh: "BTC 现价 / 200日均线，< 0.8 历史上偏便宜（但2018/2022曾在此下方继续下跌30–50%）",
        descEn: "BTC price / 200d SMA — <0.8 historically cheap (but fell another 30–50% below it in 2018/2022)",
      },
      puellMultiple: {
        value: puellValue !== null ? Math.round(puellValue * 1000) / 1000 : null,
        zone: puellZ,
        thresholds: { extreme_buy: 0.3, buy: 0.5 },
        unit: "ratio",
        descZh: "日矿工收入 / 365日均值，< 0.5 为矿工压力/积累区（2022低点后12个月约+155%）",
        descEn: "Miner revenue / 365d avg — <0.5 miner-stress/accumulation zone (~+155% in 12m after the 2022 low)",
      },
      fearGreed: {
        value: fgValue,
        zone: fgZ,
        thresholds: { extreme_buy: 10, buy: 20 },
        unit: "index",
        descZh: "alternative.me 加密恐慌指数，< 20 远期收益偏高，但中途回撤风险大（2022曾再跌约22%）",
        descEn: "alternative.me Crypto F&G — <20 above-average forward returns, large interim drawdown risk (BTC fell ~22% more in 2022)",
      },
    },
    upstream: {
      mayer: closes.length > 0 ? `OKX BTC-USDT-SWAP daily · ${closes.length} bars` : "OKX unavailable",
      puell: minerRevSeries.length > 0 ? `blockchain.info miners-revenue · ${minerRevSeries.length} bars` : "unavailable",
      fearGreed: fgr ? "alternative.me Fear & Greed" : "alternative.me unavailable",
    },
  })
}
