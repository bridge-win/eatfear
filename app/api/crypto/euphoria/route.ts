import { NextResponse } from "next/server"

import {
  computeEuphoriaOpportunity,
  type EuphoriaCandle,
  type EuphoriaMetrics,
} from "@/lib/euphoria-detector"
import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import { fetchBlockchainInfoSeries } from "@/lib/data-sources/blockchain-info-charts"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { fetchOkxDailyCandles, fetchOkxOpenInterestUsd } from "@/lib/okx-history"
import { getRangeDays, getTimeRange, isTimeRangeId } from "@/lib/time-range"

export const revalidate = 60

const OKX = "https://www.okx.com"

interface OkxResp<T> {
  code: string
  data?: T[]
}

interface OkxFundingPoint {
  fundingRate?: string
  fundingTime?: string
  realizedRate?: string
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

function sanitizeCcy(value: string | null): string {
  const upper = (value ?? "BTC").trim().toUpperCase()
  return /^[A-Z0-9]{2,12}$/.test(upper) ? upper : "BTC"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const requestedRange = url.searchParams.get("range")
  const rangeCandidate = requestedRange ?? ""
  const rangeId = isTimeRangeId(rangeCandidate) ? rangeCandidate : "1y"
  const instId = `${ccy}-USDT-SWAP`
  const range = getTimeRange(rangeId)
  const daysWanted = Math.max(365, getRangeDays(rangeId))

  const [
    dailyCandles,
    fundingHistoryRows,
    fundingCurrent,
    oiRows,
    fgr,
    vix,
    minerRevRaw,
  ] = await Promise.all([
    fetchOkxDailyCandles({ instId, daysWanted, revalidateSeconds: revalidate }),
    okxPublic<OkxFundingPoint>(`/api/v5/public/funding-rate-history?instId=${instId}&limit=200`),
    okxPublic<{ fundingRate?: string }>(`/api/v5/public/funding-rate?instId=${instId}`),
    fetchOkxOpenInterestUsd({ instId, daysWanted, revalidateSeconds: revalidate }),
    fetchFearGreedHistory(range, 1800),
    fetchYahooSeries("^VIX", range, "1d", 600),
    fetchBlockchainInfoSeries("miners-revenue", daysWanted > 365 * 5 ? "all" : daysWanted > 365 * 2 ? "5years" : "2years", 1800),
  ])

  const candles: EuphoriaCandle[] = dailyCandles.map((candle) => ({
    time: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.quoteVolume || candle.volume,
  }))
  const fundingHistory = fundingHistoryRows
    .map((row) => Number(row.realizedRate ?? row.fundingRate ?? NaN) * 100)
    .filter((value) => Number.isFinite(value))
    .reverse()
  const fundingRatePct =
    fundingCurrent[0]?.fundingRate !== undefined
      ? Number(fundingCurrent[0].fundingRate) * 100
      : fundingHistory.length > 0
        ? fundingHistory[fundingHistory.length - 1]
        : null
  const fearGreedRecent = (fgr?.history ?? []).map((point) => point.value).slice(-30)
  const fearGreedValue = fgr?.currentValue ?? null
  const vixHistoryAll = (vix?.history ?? []).map((point) => point.value)
  const vixRecent = vixHistoryAll.slice(-20)
  const vixValue = vix?.currentValue ?? (vixRecent.length > 0 ? vixRecent[vixRecent.length - 1] : null)
  const minerRevenueSeries = minerRevRaw.map((point) => point.value)

  const metrics: EuphoriaMetrics = {
    candles,
    fearGreedValue: Number.isFinite(fearGreedValue ?? NaN) ? (fearGreedValue as number) : null,
    fearGreedRecent,
    fundingRatePct,
    fundingRecentPct: fundingHistory,
    oiUsdSeries: oiRows.map((row) => row.value).filter((value) => Number.isFinite(value)),
    vixValue: Number.isFinite(vixValue ?? NaN) ? (vixValue as number) : null,
    vixRecent,
    minerRevenueSeries: minerRevenueSeries.length > 0 ? minerRevenueSeries : undefined,
  }

  const scored = computeEuphoriaOpportunity(metrics)

  return NextResponse.json({
    ccy,
    updatedAt: Date.now(),
    range: rangeId,
    refreshSuggestionSec: 60,
    summary: {
      euphoriaScore: Math.round(scored.euphoriaScore * 10) / 10,
      band: scored.signalBand,
      signalZh: scored.signalLabelZh,
      signalEn: scored.signalLabelEn,
      direction: scored.euphoriaScore >= 68 ? "short_or_take_profit" : "watch",
    },
    factors: scored.factors.map((factor) => ({
      id: factor.id,
      labelZh: factor.labelZh,
      labelEn: factor.labelEn,
      score: Math.round(factor.score * 10) / 10,
      weight: factor.weight,
      weighted: Math.round(factor.weighted * 100) / 100,
      lines: factor.lines,
    })),
    activeSignals: scored.activeSignals,
    recentWicks: scored.recentWicks,
    upstream: {
      candles: candles.length > 0 ? `OKX ${ccy} daily candles · ${candles.length} bars` : "OKX candles unavailable",
      fearGreed: fgr ? "alternative.me Fear & Greed" : "alternative.me unavailable",
      funding: fundingHistory.length > 0 ? "OKX funding-rate-history" : "OKX funding unavailable",
      openInterest: oiRows.length > 0 ? `OKX ${ccy} Rubik OI-USD · ${oiRows.length} daily bars` : "OKX OI unavailable",
      vix: vix ? "Yahoo Finance ^VIX (daily)" : "VIX unavailable",
      minerRevenue: minerRevenueSeries.length > 0 ? `blockchain.info miners-revenue · ${minerRevenueSeries.length} bars` : "miner revenue unavailable",
    },
    weights: {
      upperWickExhaustion: "18%",
      greedExtreme: "17%",
      leverageCrowding: "16%",
      rallyExtension: "14%",
      meanReversionOverheat: "11%",
      macroComplacency: "8%",
      volumeClimax: "6%",
      mayerMultiple: "6%",
      puellMultiple: "4%",
    },
  })
}
