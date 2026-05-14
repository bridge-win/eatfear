import type { StockAsset } from "./types"

// Server-only stock fetchers: hit Yahoo directly (no internal route hop).
// Used by RSC pages to pre-fetch initial data before hydration.

const BATCH_SIZE = 50
const SPARK_DEFAULT_RANGE = "1y"
const SPARK_DEFAULT_INTERVAL = "1d"

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

async function fetchQuoteBatch(symbols: string[]): Promise<StockAsset[]> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 30 },
    })
    if (!response.ok) return []
    const json = await response.json()
    const result: YahooQuote[] = json?.quoteResponse?.result ?? []
    const now = Date.now()
    return result.map((q) => {
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
  } catch {
    return []
  }
}

async function fetchSparkBatch(
  symbols: string[],
  range: string,
  interval: string,
): Promise<Record<string, number[]>> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(","))}` +
    `&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    })
    if (!response.ok) return {}
    const json = (await response.json()) as Record<
      string,
      { response?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> }
    >
    const out: Record<string, number[]> = {}
    for (const symbol of symbols) {
      const closes = json[symbol]?.response?.[0]?.indicators?.quote?.[0]?.close ?? []
      const points = closes.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      if (points.length > 0) out[symbol] = points
    }
    return out
  } catch {
    return {}
  }
}

export interface FetchStockDataServerOptions {
  includeSparkline?: boolean
  sparkRange?: string
  sparkInterval?: string
}

export async function fetchStockDataServer(
  symbols: string[],
  options: FetchStockDataServerOptions = {},
): Promise<Map<string, StockAsset>> {
  const map = new Map<string, StockAsset>()
  if (symbols.length === 0) return map

  const includeSparkline = options.includeSparkline ?? true
  const sparkRange = options.sparkRange ?? SPARK_DEFAULT_RANGE
  const sparkInterval = options.sparkInterval ?? SPARK_DEFAULT_INTERVAL

  const chunks: string[][] = []
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    chunks.push(symbols.slice(i, i + BATCH_SIZE))
  }

  const [quoteBatches, sparkBatches] = await Promise.all([
    Promise.all(chunks.map((chunk) => fetchQuoteBatch(chunk))),
    includeSparkline
      ? Promise.all(chunks.map((chunk) => fetchSparkBatch(chunk, sparkRange, sparkInterval)))
      : Promise.resolve([] as Record<string, number[]>[]),
  ])

  const sparkSeries = new Map<string, number[]>()
  for (const batch of sparkBatches) {
    for (const [symbol, series] of Object.entries(batch)) {
      sparkSeries.set(symbol, series)
    }
  }

  for (const batch of quoteBatches) {
    for (const quote of batch) {
      const sparkline = sparkSeries.get(quote.symbol)
      map.set(quote.symbol, sparkline ? { ...quote, sparkline } : quote)
    }
  }

  return map
}
