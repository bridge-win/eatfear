import { NextResponse } from "next/server"

import {
  computeBlackSwanOpportunity,
  type BlackSwanCandle,
  type BlackSwanMetrics,
} from "@/lib/black-swan-detector"
import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { getTimeRange } from "@/lib/time-range"

export const revalidate = 60

const OKX = "https://www.okx.com"
const BTC_INST = "BTC-USDT-SWAP"

interface OkxResp<T> {
  code: string
  msg?: string
  data?: T[]
}

async function okxPublic<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${OKX}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate },
    })
    if (!res.ok) return []
    const json = (await res.json()) as OkxResp<T>
    if (json.code !== "0") return []
    return json.data ?? []
  } catch {
    return []
  }
}

function normalizeDailyCandles(rows: string[][]): BlackSwanCandle[] {
  return rows
    .map((row) => ({
      time: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close),
    )
    .reverse()
}

interface OkxFundingPoint {
  fundingRate?: string
  fundingTime?: string
  realizedRate?: string
}

export async function GET() {
  const range = getTimeRange("1y")
  // Fetch all upstream in parallel; each falls back gracefully on error.
  const [
    dailyCandles,
    fundingHistoryRows,
    fundingCurrent,
    oiRows,
    fgr,
    vix,
  ] = await Promise.all([
    okxPublic<string[]>(`/api/v5/market/candles?instId=${BTC_INST}&bar=1D&limit=300`),
    okxPublic<OkxFundingPoint>(`/api/v5/public/funding-rate-history?instId=${BTC_INST}&limit=200`),
    okxPublic<{ fundingRate?: string }>(`/api/v5/public/funding-rate?instId=${BTC_INST}`),
    okxPublic<string[]>(`/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1H&limit=200`),
    fetchFearGreedHistory(range, 1800),
    fetchYahooSeries("^VIX", range, "1d", 600),
  ])

  const candles = normalizeDailyCandles(dailyCandles)

  const fundingHistory = fundingHistoryRows
    .map((row) => Number(row.realizedRate ?? row.fundingRate ?? NaN) * 100)
    .filter((v) => Number.isFinite(v))
    .reverse() // oldest → newest

  const fundingRatePct =
    fundingCurrent[0]?.fundingRate !== undefined
      ? Number(fundingCurrent[0].fundingRate) * 100
      : fundingHistory.length > 0
        ? fundingHistory[fundingHistory.length - 1]
        : null

  const oiUsdSeries = oiRows
    .map((row) => Number(row[1]))
    .filter((v) => Number.isFinite(v))
    .reverse()

  const fearGreedRecent = (fgr?.history ?? []).map((p) => p.value).slice(-30)
  const fearGreedValue = fgr?.currentValue ?? null

  const vixHistoryAll = (vix?.history ?? []).map((p) => p.value)
  const vixRecent = vixHistoryAll.slice(-20)
  const vixValue = vix?.currentValue ?? (vixRecent.length > 0 ? vixRecent[vixRecent.length - 1] : null)

  const metrics: BlackSwanMetrics = {
    candles,
    fearGreedValue: Number.isFinite(fearGreedValue ?? NaN) ? (fearGreedValue as number) : null,
    fearGreedRecent,
    fundingRatePct,
    fundingRecentPct: fundingHistory,
    oiUsdSeries,
    vixValue: Number.isFinite(vixValue ?? NaN) ? (vixValue as number) : null,
    vixRecent,
  }

  const scored = computeBlackSwanOpportunity(metrics)

  const factorPayload = scored.factors.map((f) => ({
    id: f.id,
    labelZh: f.labelZh,
    labelEn: f.labelEn,
    score: Math.round(f.score * 10) / 10,
    weight: f.weight,
    weighted: Math.round(f.weighted * 100) / 100,
    lines: f.lines,
  }))

  return NextResponse.json({
    updatedAt: Date.now(),
    refreshSuggestionSec: 60,
    summary: {
      opportunityScore: Math.round(scored.opportunityScore * 10) / 10,
      band: scored.signalBand,
      signalZh: scored.signalLabelZh,
      signalEn: scored.signalLabelEn,
    },
    factors: factorPayload,
    activeSignals: scored.activeSignals,
    recentWicks: scored.recentWicks,
    upstream: {
      candles: candles.length > 0 ? `OKX daily candles · ${candles.length} bars` : "OKX candles unavailable",
      fearGreed: fgr ? "alternative.me Fear & Greed" : "alternative.me unavailable",
      funding: fundingHistory.length > 0 ? "OKX funding-rate-history" : "OKX funding unavailable",
      openInterest: oiUsdSeries.length > 0 ? "OKX Rubik OI-USD (1H)" : "OKX OI unavailable",
      vix: vix ? "Yahoo Finance ^VIX (daily)" : "VIX unavailable",
    },
    weights: {
      wickCapitulation: "25%",
      fearExtreme: "20%",
      leverageFlush: "15%",
      drawdownMagnitude: "15%",
      meanReversion: "10%",
      macroRiskOff: "10%",
      volumeClimax: "5%",
    },
  })
}
