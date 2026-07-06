import { NextResponse } from "next/server"

import {
  computeBlackSwanOpportunity,
  type BlackSwanCandle,
  type BlackSwanMetrics,
} from "@/lib/black-swan-detector"
import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import { fetchBlockchainInfoSeries } from "@/lib/data-sources/blockchain-info-charts"
import { fetchBtcHashrateSeries } from "@/lib/data-sources/mempool-hashrate"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { fetchOkxDailyCandles, fetchOkxOpenInterestUsd } from "@/lib/okx-history"
import { getRangeDays, getTimeRange, isTimeRangeId } from "@/lib/time-range"

export const revalidate = 60

const OKX = "https://www.okx.com"

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

interface OkxFundingPoint {
  fundingRate?: string
  fundingTime?: string
  realizedRate?: string
}

function sanitizeCcy(value: string | null): string {
  const upper = (value ?? "BTC").trim().toUpperCase()
  return /^[A-Z0-9]{2,12}$/.test(upper) ? upper : "BTC"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const instId = `${ccy}-USDT-SWAP`
  const requestedRange = url.searchParams.get("range")
  const rangeCandidate = requestedRange ?? ""
  const rangeId = isTimeRangeId(rangeCandidate) ? rangeCandidate : "1y"
  const range = getTimeRange(rangeId)
  const daysWanted = Math.max(365, getRangeDays(rangeId))
  // Fetch all upstream in parallel; each falls back gracefully on error.
  const [
    dailyCandles,
    fundingHistoryRows,
    fundingCurrent,
    oiRows,
    fgr,
    vix,
    hashrateSeries,
    minerRevRaw,
  ] = await Promise.all([
    fetchOkxDailyCandles({ instId, daysWanted, revalidateSeconds: revalidate }),
    okxPublic<OkxFundingPoint>(`/api/v5/public/funding-rate-history?instId=${instId}&limit=200`),
    okxPublic<{ fundingRate?: string }>(`/api/v5/public/funding-rate?instId=${instId}`),
    fetchOkxOpenInterestUsd({ instId, daysWanted, revalidateSeconds: revalidate }),
    fetchFearGreedHistory(range, 1800),
    fetchYahooSeries("^VIX", range, "1d", 600),
    fetchBtcHashrateSeries(Math.max(600, daysWanted)),
    fetchBlockchainInfoSeries("miners-revenue", daysWanted > 365 * 5 ? "all" : daysWanted > 365 * 2 ? "5years" : "2years", 1800),
  ])

  const candles: BlackSwanCandle[] = dailyCandles.map((candle) => ({
    time: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.quoteVolume || candle.volume,
  }))

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

  const oiUsdSeries = oiRows.map((row) => row.value).filter((v) => Number.isFinite(v))

  const fearGreedRecent = (fgr?.history ?? []).map((p) => p.value).slice(-30)
  const fearGreedValue = fgr?.currentValue ?? null

  const vixHistoryAll = (vix?.history ?? []).map((p) => p.value)
  const vixRecent = vixHistoryAll.slice(-20)
  const vixValue = vix?.currentValue ?? (vixRecent.length > 0 ? vixRecent[vixRecent.length - 1] : null)

  const minerRevenueSeries = minerRevRaw.map((p) => p.value)

  const metrics: BlackSwanMetrics = {
    candles,
    fearGreedValue: Number.isFinite(fearGreedValue ?? NaN) ? (fearGreedValue as number) : null,
    fearGreedRecent,
    fundingRatePct,
    fundingRecentPct: fundingHistory,
    oiUsdSeries,
    vixValue: Number.isFinite(vixValue ?? NaN) ? (vixValue as number) : null,
    vixRecent,
    hashrateSeries: hashrateSeries ?? undefined,
    minerRevenueSeries: minerRevenueSeries.length > 0 ? minerRevenueSeries : undefined,
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
    ccy,
    updatedAt: Date.now(),
    range: rangeId,
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
      candles: candles.length > 0 ? `OKX ${ccy} daily candles · ${candles.length} bars` : "OKX candles unavailable",
      fearGreed: fgr ? "alternative.me Fear & Greed" : "alternative.me unavailable",
      funding: fundingHistory.length > 0 ? "OKX funding-rate-history" : "OKX funding unavailable",
      openInterest: oiUsdSeries.length > 0 ? `OKX ${ccy} Rubik OI-USD · ${oiUsdSeries.length} daily bars` : "OKX OI unavailable",
      vix: vix ? "Yahoo Finance ^VIX (daily)" : "VIX unavailable",
      hashrate: hashrateSeries ? `mempool.space hashrate · ${hashrateSeries.length} daily bars` : "mempool hashrate unavailable",
      minerRevenue: minerRevenueSeries.length > 0 ? `blockchain.info miners-revenue · ${minerRevenueSeries.length} bars` : "miner revenue unavailable",
    },
    weights: {
      wickCapitulation: "20%",
      fearExtreme: "18%",
      leverageFlush: "13%",
      drawdownMagnitude: "12%",
      meanReversion: "8%",
      macroRiskOff: "10%",
      volumeClimax: "5%",
      hashRibbon: "7%",
      mayerMultiple: "4%",
      puellMultiple: "3%",
    },
  })
}
