import { NextResponse } from "next/server"

// Cache stock snapshots for ~30s at the edge; allow 60s of stale-while-revalidate.
export const revalidate = 30

const CACHE_HEADER = "public, s-maxage=30, stale-while-revalidate=60"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate },
      },
    )

    if (!response.ok) {
      return NextResponse.json({ error: "Stock data unavailable" }, { status: response.status === 404 ? 404 : 502 })
    }

    const data = await response.json()

    if (!data.chart?.result?.[0]) {
      throw new Error("Invalid response from Yahoo Finance")
    }

    const result = data.chart.result[0]
    const meta = result.meta
    const quote = result.indicators.quote[0]

    const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1]
    const previousClose = meta.chartPreviousClose || quote.close[0]
    const changeToday = currentPrice - previousClose
    const changePercentToday = (changeToday / previousClose) * 100
    const volume = quote.volume[quote.volume.length - 1] || 0

    const stockName = meta.longName || meta.shortName || symbol

    return NextResponse.json(
      {
        symbol,
        name: stockName,
        price: currentPrice,
        changeToday,
        changePercentToday,
        volume,
        lastUpdate: Date.now(),
      },
      { headers: { "Cache-Control": CACHE_HEADER } },
    )
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 502 })
  }
}
