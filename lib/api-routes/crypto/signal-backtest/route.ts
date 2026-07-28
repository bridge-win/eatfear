import { NextResponse } from "next/server"

import { runSignalBacktest, type PricePoint, type SignalOccurrence } from "@/lib/backtest/signal-backtest"
import { fetchOkxDailyCandles } from "@/lib/okx-history"
import { getRangeDays, isTimeRangeId } from "@/lib/time-range"

export const revalidate = 300

type SignalId = "black-swan" | "euphoria"

function sanitizeCcy(value: string | null): string {
  const upper = (value ?? "BTC").trim().toUpperCase()
  return /^[A-Z0-9]{2,12}$/.test(upper) ? upper : "BTC"
}

function sanitizeSignal(value: string | null): SignalId {
  return value === "euphoria" ? "euphoria" : "black-swan"
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return { mean, std: Math.sqrt(variance) }
}

function buildOccurrences({
  prices,
  signal,
}: {
  prices: Array<PricePoint & { open: number; high: number; low: number; volume: number }>
  signal: SignalId
}): SignalOccurrence[] {
  const returns = prices.map((point, index) => {
    const previous = prices[index - 7]
    if (!previous || previous.close <= 0) return 0
    return (point.close / previous.close - 1) * 100
  })

  return prices.flatMap((point, index) => {
    if (index < 60) return []
    const range = Math.max(point.high - point.low, Number.EPSILON)
    const lowerWick = ((Math.min(point.open, point.close) - point.low) / range) * 100
    const upperWick = ((point.high - Math.max(point.open, point.close)) / range) * 100
    const { mean, std } = meanStd(returns.slice(Math.max(0, index - 60), index))
    const z = std > 0 ? (returns[index] - mean) / std : 0
    const score =
      signal === "black-swan"
        ? Number(lowerWick >= 45) * 42 + Number(z <= -2) * 38 + Number(point.volume > 0) * 10
        : Number(upperWick >= 45) * 42 + Number(z >= 2) * 38 + Number(point.volume > 0) * 10

    if (score < 70) return []
    return [{
      time: point.time,
      direction: signal === "black-swan" ? "long" : "short",
      score,
    }]
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const signal = sanitizeSignal(url.searchParams.get("signal"))
  const requestedRange = url.searchParams.get("range")
  const rangeCandidate = requestedRange ?? ""
  const rangeId = isTimeRangeId(rangeCandidate) ? rangeCandidate : "5y"
  const daysWanted = Math.max(365, getRangeDays(rangeId))
  const candles = await fetchOkxDailyCandles({
    instId: `${ccy}-USDT-SWAP`,
    daysWanted,
    revalidateSeconds: revalidate,
  })

  const prices = candles.map((candle) => ({
    time: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.quoteVolume || candle.volume,
  }))
  const occurrences = buildOccurrences({ prices, signal })
  const summary = runSignalBacktest({
    prices,
    occurrences,
    horizons: [7, 30, 90],
  })

  return NextResponse.json({
    ccy,
    signal,
    range: rangeId,
    updatedAt: Date.now(),
    methodology: "Free OKX daily candles; event if wick exhaustion plus 7-day return z-score reaches the threshold. No lookahead in event creation.",
    summary,
    recentOccurrences: occurrences.slice(-12).reverse(),
    upstream: {
      candles: candles.length > 0 ? `OKX ${ccy} daily candles · ${candles.length} bars` : "OKX candles unavailable",
    },
  })
}
