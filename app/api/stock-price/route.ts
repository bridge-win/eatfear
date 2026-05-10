import { NextResponse } from "next/server"

export const runtime = "edge"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
  }

  try {
    // Use Yahoo Finance API via query1.finance.yahoo.com
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
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

    // Get current price and calculate change
    const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1]
    const previousClose = meta.chartPreviousClose || quote.close[0]
    const changeToday = currentPrice - previousClose
    const changePercentToday = (changeToday / previousClose) * 100
    const volume = quote.volume[quote.volume.length - 1] || 0

    // Get stock name from meta or use symbol
    const stockName = meta.longName || meta.shortName || symbol

    return NextResponse.json({
      symbol: symbol,
      name: stockName,
      price: currentPrice,
      changeToday: changeToday,
      changePercentToday: changePercentToday,
      volume: volume,
      lastUpdate: Date.now(),
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 502 })
  }
}
