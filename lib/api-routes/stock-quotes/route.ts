import { NextResponse } from "next/server"

import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { getTimeRange } from "@/lib/time-range"

// Bulk Yahoo /v7/finance/quote — one HTTP round-trip for many symbols.
export const revalidate = 30

const CACHE_HEADER = "public, s-maxage=30, stale-while-revalidate=60"

interface YahooQuote {
  symbol: string
  longName?: string
  shortName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  regularMarketPreviousClose?: number
  regularMarketVolume?: number
}

interface StockQuoteRow {
  symbol: string
  name: string
  price: number
  changeToday: number
  changePercentToday: number
  volume: number
  lastUpdate: number
}

async function fetchChartFallback(symbols: string[]): Promise<StockQuoteRow[]> {
  const range = getTimeRange("5d")
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      const result = await fetchYahooSeries(symbol, range, undefined, revalidate)
      const latest = result?.history.at(-1)
      if (!result || !latest) return null
      const price = result.currentValue ?? latest.value
      const previousValue = result.previousValue ?? result.history.at(-2)?.value ?? price
      const changeToday = price - previousValue
      const changePercentToday = previousValue === 0 ? 0 : (changeToday / previousValue) * 100
      return {
        symbol,
        name: symbol,
        price,
        changeToday,
        changePercentToday,
        volume: 0,
        lastUpdate: result.lastUpdate,
      }
    }),
  )
  return rows.filter((row): row is StockQuoteRow => row !== null)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")

  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols query is required" }, { status: 400 })
  }

  // Yahoo accepts comma-separated symbols. Limit to a sensible upper bound to
  // protect against runaway URLs / 4xx from upstream.
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols query is empty" }, { status: 400 })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate },
    })

    if (!response.ok) {
      const fallback = await fetchChartFallback(symbols)
      if (fallback.length > 0) {
        return NextResponse.json(
          { quotes: fallback, lastUpdate: Date.now(), fallback: "Yahoo chart" },
          { headers: { "Cache-Control": CACHE_HEADER } },
        )
      }
      return NextResponse.json({ error: "Stock data unavailable" }, { status: response.status === 404 ? 404 : 502 })
    }

    const json = await response.json()
    const result: YahooQuote[] = json?.quoteResponse?.result ?? []

    const now = Date.now()
    const quotes: StockQuoteRow[] = result.map((q) => {
      const price = q.regularMarketPrice ?? 0
      const previousClose = q.regularMarketPreviousClose ?? price
      const changeToday = q.regularMarketChange ?? price - previousClose
      const changePercentToday =
        q.regularMarketChangePercent ?? (previousClose ? (changeToday / previousClose) * 100 : 0)
      return {
        symbol: q.symbol,
        name: q.longName || q.shortName || q.symbol,
        price,
        changeToday,
        changePercentToday,
        volume: q.regularMarketVolume ?? 0,
        lastUpdate: now,
      }
    })

    if (quotes.length === 0) {
      const fallback = await fetchChartFallback(symbols)
      if (fallback.length > 0) {
        return NextResponse.json(
          { quotes: fallback, lastUpdate: now, fallback: "Yahoo chart" },
          { headers: { "Cache-Control": CACHE_HEADER } },
        )
      }
    }

    return NextResponse.json(
      { quotes, lastUpdate: now },
      { headers: { "Cache-Control": CACHE_HEADER } },
    )
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 502 })
  }
}
