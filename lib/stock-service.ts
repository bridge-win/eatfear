import type { StockAsset } from "./types"

// Major U.S. indices
export const US_INDICES = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "NASDAQ 100" },
  { symbol: "DIA", name: "Dow Jones" },
]

// Top 50 U.S. stocks by market cap
export const US_TOP_50 = [
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
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "PEP", name: "PepsiCo Inc." },
  { symbol: "COST", name: "Costco Wholesale" },
  { symbol: "CSCO", name: "Cisco Systems" },
  { symbol: "TMO", name: "Thermo Fisher" },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "ABBV", name: "AbbVie Inc." },
  { symbol: "MRK", name: "Merck & Co." },
  { symbol: "AMD", name: "AMD Inc." },
  { symbol: "LLY", name: "Eli Lilly" },
  { symbol: "ACN", name: "Accenture" },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "NKE", name: "Nike Inc." },
  { symbol: "TXN", name: "Texas Instruments" },
  { symbol: "QCOM", name: "Qualcomm Inc." },
  { symbol: "INTU", name: "Intuit Inc." },
  { symbol: "AMAT", name: "Applied Materials" },
  { symbol: "IBM", name: "IBM Corporation" },
  { symbol: "GE", name: "General Electric" },
  { symbol: "CAT", name: "Caterpillar Inc." },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "NOW", name: "ServiceNow Inc." },
  { symbol: "SPGI", name: "S&P Global" },
  { symbol: "AXP", name: "American Express" },
  { symbol: "BKNG", name: "Booking Holdings" },
  { symbol: "ISRG", name: "Intuitive Surgical" },
  { symbol: "UBER", name: "Uber Technologies" },
  { symbol: "BLK", name: "BlackRock Inc." },
]

// Hong Kong Top 20 stocks (using Yahoo Finance HK tickers)
export const HK_TOP_20 = [
  { symbol: "0700.HK", name: "腾讯控股" },
  { symbol: "9988.HK", name: "阿里巴巴" },
  { symbol: "0941.HK", name: "中国移动" },
  { symbol: "1299.HK", name: "友邦保险" },
  { symbol: "0005.HK", name: "汇丰控股" },
  { symbol: "3690.HK", name: "美团" },
  { symbol: "0939.HK", name: "建设银行" },
  { symbol: "1398.HK", name: "工商银行" },
  { symbol: "2318.HK", name: "中国平安" },
  { symbol: "0883.HK", name: "中国海洋石油" },
  { symbol: "9618.HK", name: "京东集团" },
  { symbol: "9999.HK", name: "网易" },
  { symbol: "1810.HK", name: "小米集团" },
  { symbol: "0388.HK", name: "香港交易所" },
  { symbol: "2628.HK", name: "中国人寿" },
  { symbol: "2388.HK", name: "中银香港" },
  { symbol: "0016.HK", name: "新鸿基地产" },
  { symbol: "0027.HK", name: "银河娱乐" },
  { symbol: "0001.HK", name: "长江实业" },
  { symbol: "0002.HK", name: "中电控股" },
]

// Vietnam concept stocks (US-listed Vietnam exposure)
export const VIETNAM_STOCKS = [
  { symbol: "VNM", name: "VanEck Vietnam ETF" },
  { symbol: "FUTU", name: "富途控股" },
  { symbol: "BIDU", name: "百度" },
  { symbol: "JD", name: "京东" },
  { symbol: "PDD", name: "拼多多" },
  { symbol: "BABA", name: "阿里巴巴ADR" },
  { symbol: "NIO", name: "蔚来汽车" },
  { symbol: "XPEV", name: "小鹏汽车" },
  { symbol: "LI", name: "理想汽车" },
  { symbol: "BILI", name: "哔哩哔哩" },
  { symbol: "TME", name: "腾讯音乐" },
  { symbol: "EDU", name: "新东方" },
  { symbol: "TAL", name: "好未来" },
  { symbol: "VIPS", name: "唯品会" },
  { symbol: "IQ", name: "爱奇艺" },
]

// All US stocks (indices + top 50)
export const ALL_US_STOCKS = [...US_INDICES, ...US_TOP_50]

// Combined all stocks for backward compatibility
export const ALL_STOCKS = ALL_US_STOCKS

// Export categories for dashboard tabs
export const STOCK_CATEGORIES = {
  us: { name: "美股 Top 50", stocks: ALL_US_STOCKS },
  hk: { name: "港股 Top 20", stocks: HK_TOP_20 },
  vietnam: { name: "越南概念股", stocks: VIETNAM_STOCKS },
}

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
