import { NextResponse } from "next/server"

import {
  computeBlackSwanOpportunity,
  type BlackSwanCandle,
  type BlackSwanMetrics,
} from "@/lib/black-swan-detector"
import { computeEuphoriaRisk } from "@/lib/euphoria-detector"
import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import { fetchBlockchainInfoSeries } from "@/lib/data-sources/blockchain-info-charts"
import { fetchBtcHashrateSeries } from "@/lib/data-sources/mempool-hashrate"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { getTimeRange } from "@/lib/time-range"

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

function sanitizeCcy(value: string | null): string {
  const upper = (value ?? "BTC").trim().toUpperCase()
  return /^[A-Z0-9]{2,12}$/.test(upper) ? upper : "BTC"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const instId = `${ccy}-USDT-SWAP`
  const range = getTimeRange("1y")
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
    okxPublic<string[]>(`/api/v5/market/candles?instId=${instId}&bar=1D&limit=300`),
    okxPublic<OkxFundingPoint>(`/api/v5/public/funding-rate-history?instId=${instId}&limit=200`),
    okxPublic<{ fundingRate?: string }>(`/api/v5/public/funding-rate?instId=${instId}`),
    okxPublic<string[]>(`/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=1H&limit=200`),
    fetchFearGreedHistory(range, 1800),
    fetchYahooSeries("^VIX", range, "1d", 600),
    fetchBtcHashrateSeries(600),
    fetchBlockchainInfoSeries("miners-revenue", "2years", 1800),
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
  const euphoria = computeEuphoriaRisk(metrics)

  const factorPayload = scored.factors.map((f) => ({
    id: f.id,
    labelZh: f.labelZh,
    labelEn: f.labelEn,
    score: Math.round(f.score * 10) / 10,
    weight: f.weight,
    weighted: Math.round(f.weighted * 100) / 100,
    lines: f.lines,
  }))

  const euphoriaFactorPayload = euphoria.factors.map((f) => ({
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
    euphoria: {
      euphoriaScore: Math.round(euphoria.euphoriaScore * 10) / 10,
      band: euphoria.signalBand,
      direction: euphoria.direction,
      signalZh: euphoria.signalLabelZh,
      signalEn: euphoria.signalLabelEn,
      factors: euphoriaFactorPayload,
      activeSignals: euphoria.activeSignals,
      recentBlowoffs: euphoria.recentBlowoffs,
    },
    upstream: {
      candles: candles.length > 0 ? `OKX ${ccy} daily candles · ${candles.length} bars` : "OKX candles unavailable",
      fearGreed: fgr ? "alternative.me Fear & Greed" : "alternative.me unavailable",
      funding: fundingHistory.length > 0 ? "OKX funding-rate-history" : "OKX funding unavailable",
      openInterest: oiUsdSeries.length > 0 ? `OKX ${ccy} Rubik OI-USD (1H)` : "OKX OI unavailable",
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
    euphoriaWeights: {
      wickBlowoff: "20%",
      greedExtreme: "18%",
      leverageFroth: "15%",
      runupMagnitude: "12%",
      macroComplacency: "10%",
      meanReversionHigh: "8%",
      mayerMultiple: "7%",
      volumeClimax: "5%",
      puellMultiple: "5%",
    },
  })
}
