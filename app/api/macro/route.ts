import { NextResponse } from "next/server"
import type { MacroIndicator } from "@/lib/types"

export const revalidate = 300

interface MacroSource {
  symbol: string
  name: string
  group: MacroIndicator["group"]
  unit: MacroIndicator["unit"]
  transform?: (value: number) => number
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
    error?: {
      description?: string
    } | null
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
    quote?: Array<{
      close?: Array<number | null>
    }>
  }
}

const macroSources: MacroSource[] = [
  { symbol: "^GSPC", name: "S&P 500", group: "Equity", unit: "index" },
  { symbol: "^IXIC", name: "Nasdaq Composite", group: "Equity", unit: "index" },
  { symbol: "^DJI", name: "Dow Jones Industrial Average", group: "Equity", unit: "index" },
  { symbol: "^RUT", name: "Russell 2000", group: "Equity", unit: "index" },
  { symbol: "^HSI", name: "Hang Seng Index", group: "Equity", unit: "index" },
  { symbol: "^N225", name: "Nikkei 225", group: "Equity", unit: "index" },
  { symbol: "^VIX", name: "CBOE VIX", group: "Volatility", unit: "index" },
  { symbol: "^VXN", name: "Nasdaq 100 Volatility", group: "Volatility", unit: "index" },
  { symbol: "^IRX", name: "U.S. 3M Treasury Yield", group: "Rates", unit: "percent", transform: (value) => value / 10 },
  { symbol: "^FVX", name: "U.S. 5Y Treasury Yield", group: "Rates", unit: "percent", transform: (value) => value / 10 },
  { symbol: "^TNX", name: "U.S. 10Y Treasury Yield", group: "Rates", unit: "percent", transform: (value) => value / 10 },
  { symbol: "^TYX", name: "U.S. 30Y Treasury Yield", group: "Rates", unit: "percent", transform: (value) => value / 10 },
  { symbol: "DX-Y.NYB", name: "U.S. Dollar Index", group: "Dollar", unit: "index" },
  { symbol: "TLT", name: "20+ Year Treasury Bond ETF", group: "Rates", unit: "usd" },
  { symbol: "HYG", name: "High Yield Credit ETF", group: "Credit", unit: "usd" },
  { symbol: "LQD", name: "Investment Grade Credit ETF", group: "Credit", unit: "usd" },
  { symbol: "GC=F", name: "Gold Futures", group: "Commodity", unit: "usd" },
  { symbol: "SI=F", name: "Silver Futures", group: "Commodity", unit: "usd" },
  { symbol: "CL=F", name: "WTI Crude Oil", group: "Commodity", unit: "usd" },
  { symbol: "BZ=F", name: "Brent Crude Oil", group: "Commodity", unit: "usd" },
  { symbol: "HG=F", name: "Copper Futures", group: "Commodity", unit: "usd" },
  { symbol: "EURUSD=X", name: "EUR/USD", group: "FX", unit: "ratio" },
  { symbol: "USDJPY=X", name: "USD/JPY", group: "FX", unit: "ratio" },
  { symbol: "USDCNH=X", name: "USD/CNH", group: "FX", unit: "ratio" },
  { symbol: "GBPUSD=X", name: "GBP/USD", group: "FX", unit: "ratio" },
  { symbol: "BTC-USD", name: "Bitcoin Spot", group: "Crypto", unit: "usd" },
  { symbol: "ETH-USD", name: "Ethereum Spot", group: "Crypto", unit: "usd" },
]

const applyTransform = (value: number, source: MacroSource) => source.transform?.(value) ?? value

async function fetchIndicator(source: MacroSource): Promise<MacroIndicator | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    source.symbol,
  )}?interval=1d&range=6mo`

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate },
    })

    if (!response.ok) return null

    const payload = (await response.json()) as YahooChartResponse
    const result = payload.chart?.result?.[0]
    const timestamps = result?.timestamp ?? []
    const closes = result?.indicators?.quote?.[0]?.close ?? []

    const history = timestamps
      .map((timestamp, index) => {
        const rawValue = closes[index]
        if (rawValue === null || rawValue === undefined || !Number.isFinite(rawValue)) return null

        const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
        return {
          timestamp: timestamp * 1000,
          date,
          value: applyTransform(rawValue, source),
        }
      })
      .filter((point): point is MacroIndicator["history"][number] => point !== null)

    const latestHistoryPoint = history.at(-1)
    const previousHistoryPoint = history.at(-2)
    const rawCurrentValue = result?.meta?.regularMarketPrice
    const rawPreviousValue = result?.meta?.previousClose ?? result?.meta?.chartPreviousClose

    const value = rawCurrentValue === undefined ? latestHistoryPoint?.value ?? 0 : applyTransform(rawCurrentValue, source)
    const previousValue =
      rawPreviousValue === undefined ? previousHistoryPoint?.value ?? value : applyTransform(rawPreviousValue, source)
    const change = value - previousValue
    const changePercent = previousValue === 0 ? 0 : (change / previousValue) * 100

    if (!latestHistoryPoint && value === 0) return null

    return {
      symbol: source.symbol,
      name: source.name,
      group: source.group,
      unit: source.unit,
      source: "Yahoo Finance",
      value,
      change,
      changePercent,
      lastUpdate: (result?.meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
      history,
    }
  } catch {
    return null
  }
}

export async function GET() {
  const indicators = (await Promise.all(macroSources.map(fetchIndicator))).filter(
    (indicator): indicator is MacroIndicator => indicator !== null,
  )

  return NextResponse.json({
    updatedAt: Date.now(),
    indicators,
  })
}
