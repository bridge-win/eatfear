import { NextResponse } from "next/server"

import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { getTimeRange } from "@/lib/time-range"

// Bulk sparkline endpoint — Yahoo /v8/finance/spark accepts comma-separated
// symbols and returns close arrays. One request per chunk of ~50 symbols
// replaces a per-symbol fan-out.
export const revalidate = 300

const CACHE_HEADER = "public, s-maxage=300, stale-while-revalidate=900"

interface YahooSparkResult {
  symbol?: string
  response?: Array<{
    timestamp?: number[]
    indicators?: { quote?: Array<{ close?: Array<number | null> }> }
  }>
}

async function fetchChartFallback(symbols: string[], range: string, interval: string): Promise<Record<string, number[]>> {
  const rangeOption = getTimeRange(range)
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      const result = await fetchYahooSeries(symbol, rangeOption, interval, revalidate)
      const values = result?.history.map((point) => point.value).filter((value) => Number.isFinite(value)) ?? []
      return values.length > 0 ? ([symbol, values] as const) : null
    }),
  )
  return Object.fromEntries(rows.filter((row): row is readonly [string, number[]] => row !== null))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")
  const range = searchParams.get("range") ?? "1y"
  const interval = searchParams.get("interval") ?? "1d"

  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols query is required" }, { status: 400 })
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols query is empty" }, { status: 400 })
  }

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(","))}` +
      `&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate },
    })

    if (!response.ok) {
      const fallback = await fetchChartFallback(symbols, range, interval)
      if (Object.keys(fallback).length > 0) {
        return NextResponse.json({ series: fallback, fallback: "Yahoo chart" }, { headers: { "Cache-Control": CACHE_HEADER } })
      }
      return NextResponse.json({ error: "Sparkline data unavailable" }, { status: response.status === 404 ? 404 : 502 })
    }

    const json = (await response.json()) as Record<string, YahooSparkResult>

    // Yahoo returns keys as symbols; some clients have seen `spark` wrapper too.
    const series: Record<string, number[]> = {}
    for (const sym of symbols) {
      const entry = json[sym]
      const closes = entry?.response?.[0]?.indicators?.quote?.[0]?.close ?? []
      const points = closes.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      if (points.length > 0) series[sym] = points
    }

    if (Object.keys(series).length === 0) {
      const fallback = await fetchChartFallback(symbols, range, interval)
      if (Object.keys(fallback).length > 0) {
        return NextResponse.json({ series: fallback, fallback: "Yahoo chart" }, { headers: { "Cache-Control": CACHE_HEADER } })
      }
    }

    return NextResponse.json({ series }, { headers: { "Cache-Control": CACHE_HEADER } })
  } catch {
    return NextResponse.json({ error: "Failed to fetch sparkline data" }, { status: 502 })
  }
}
