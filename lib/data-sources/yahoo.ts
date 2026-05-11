import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
    error?: { description?: string } | null
  }
}

interface YahooChartResult {
  meta?: {
    regularMarketPrice?: number
    chartPreviousClose?: number
    previousClose?: number
    regularMarketTime?: number
  }
  timestamp?: number[]
  indicators?: {
    quote?: Array<{ close?: Array<number | null> }>
  }
}

export interface YahooFetchResult {
  history: MacroSeriesPoint[]
  currentValue?: number
  previousValue?: number
  lastUpdate: number
}

/**
 * Fetch a Yahoo Finance chart series and return normalized history + meta values.
 * Returns null when the network call fails or the response is empty.
 */
export async function fetchYahooSeries(
  symbol: string,
  range: TimeRangeOption,
  intervalOverride?: string,
  revalidate = 300,
): Promise<YahooFetchResult | null> {
  const interval = intervalOverride ?? range.yahooInterval
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range.yahooRange)}`

  const payload = await fetchJson<YahooChartResponse>(url, {
    revalidate,
    headers: { "User-Agent": "Mozilla/5.0" },
  })
  if (!payload) return null

  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const closes = result?.indicators?.quote?.[0]?.close ?? []

  const history: MacroSeriesPoint[] = []
  for (let index = 0; index < timestamps.length; index += 1) {
    const ts = timestamps[index]
    const value = closes[index]
    if (ts === undefined || value === null || value === undefined || !Number.isFinite(value)) continue
    history.push({
      timestamp: ts * 1000,
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      value,
    })
  }

  if (history.length === 0 && result?.meta?.regularMarketPrice === undefined) {
    return null
  }

  return {
    history,
    currentValue: result?.meta?.regularMarketPrice,
    previousValue: result?.meta?.previousClose ?? result?.meta?.chartPreviousClose,
    lastUpdate: (result?.meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
  }
}
