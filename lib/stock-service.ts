import type { StockAsset } from "./types"

// Major indices and top U.S. stocks
export const MAJOR_INDICES = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "NASDAQ" },
  { symbol: "DIA", name: "Dow Jones" },
]

export const TOP_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "BRK-B", name: "Berkshire Hathaway" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "UNH", name: "UnitedHealth Group" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "DIS", name: "Walt Disney" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "KO", name: "Coca-Cola" },
]

export const ALL_STOCKS = [...MAJOR_INDICES, ...TOP_STOCKS]

// Fetch stock data via Yahoo Finance API
export async function fetchStockData(symbols: string[]): Promise<Map<string, StockAsset>> {
  const stockMap = new Map<string, StockAsset>()

  try {
    // Fetch data for all symbols in parallel
    const promises = symbols.map(async (symbol) => {
      try {
        const response = await fetch(`/api/stock-price?symbol=${symbol}`)
        if (!response.ok) return null

        const data = await response.json()
        return data
      } catch (error) {
        console.error(`[v0] Error fetching ${symbol}:`, error)
        return null
      }
    })

    const results = await Promise.all(promises)

    results.forEach((data) => {
      if (data) {
        stockMap.set(data.symbol, data)
      }
    })
  } catch (error) {
    console.error("[v0] Error fetching stock data:", error)
  }

  return stockMap
}

// Calculate crash leaderboard (stocks with biggest drops)
export function calculateCrashLeaderboard(stocks: StockAsset[], minDropPercent = 2): StockAsset[] {
  return stocks
    .filter((stock) => stock.changePercentToday < -minDropPercent)
    .sort((a, b) => a.changePercentToday - b.changePercentToday)
    .slice(0, 10)
}
