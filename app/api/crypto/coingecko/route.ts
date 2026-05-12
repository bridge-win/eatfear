import { NextResponse } from "next/server"
import { DEFAULT_TIME_RANGE, getTimeRange } from "@/lib/time-range"

export const revalidate = 30

// CoinGecko Free API: 10-30 calls/min (no key needed)
// CoinGecko Demo API: 30 calls/min (free key from dashboard)
// CoinGecko Pro API: 500 calls/min (paid)
// Note: CoinGecko only provides aggregated market data, NOT derivatives data
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY
const COINGECKO_BASE = COINGECKO_API_KEY
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3"

// Map symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  BNB: "binancecoin",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  TON: "the-open-network",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  BCH: "bitcoin-cash",
  DOT: "polkadot",
  UNI: "uniswap",
  LTC: "litecoin",
  NEAR: "near",
  APT: "aptos",
  SUI: "sui",
  ICP: "internet-computer",
  ETC: "ethereum-classic",
}

// Map time range to CoinGecko days parameter
const RANGE_TO_DAYS: Record<string, string> = {
  "1h": "1",
  "4h": "1",
  "12h": "1",
  "1d": "1",
  "3d": "3",
  "7d": "7",
  "30d": "30",
}

interface CoinGeckoMarketChart {
  prices: [number, number][]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}

interface CoinGeckoCoinData {
  id: string
  symbol: string
  name: string
  market_data: {
    current_price: { usd: number }
    price_change_24h: number
    price_change_percentage_24h: number
    high_24h: { usd: number }
    low_24h: { usd: number }
    total_volume: { usd: number }
    market_cap: { usd: number }
    circulating_supply: number
    total_supply: number
    ath: { usd: number }
    atl: { usd: number }
  }
  tickers: Array<{
    market: { name: string }
    last: number
    volume: number
    bid_ask_spread_percentage: number
    trust_score: string
  }>
}

interface CoinGeckoDerivativesTicker {
  symbol: string
  base: string
  target: string
  market: { name: string }
  last: number
  volume: number
  open_interest_usd: number
  funding_rate: number
  index: number
  price_percentage_change_24h: number
  spread: number
  bid_ask_spread_percentage: number
}

const coingeckoFetch = async <T>(path: string): Promise<{ data: T | null; error: string | null; apiKeyMissing: boolean }> => {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json",
  }

  if (COINGECKO_API_KEY) {
    headers["x-cg-pro-api-key"] = COINGECKO_API_KEY
  }

  try {
    const response = await fetch(`${COINGECKO_BASE}${path}`, {
      headers,
      next: { revalidate },
    })

    if (response.status === 429) {
      return {
        data: null,
        error: "CoinGecko rate limit exceeded. Please add COINGECKO_API_KEY for higher limits.",
        apiKeyMissing: !COINGECKO_API_KEY,
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        data: null,
        error: "CoinGecko API key is invalid or expired.",
        apiKeyMissing: false,
      }
    }

    if (!response.ok) {
      return {
        data: null,
        error: `CoinGecko request failed: ${response.status}`,
        apiKeyMissing: false,
      }
    }

    const data = (await response.json()) as T
    return { data, error: null, apiKeyMissing: false }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "CoinGecko fetch error",
      apiKeyMissing: false,
    }
  }
}

const formatTimeLabel = (time: number) =>
  new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

const sanitizeSymbol = (raw: string | null): string => {
  if (!raw) return "BTC"
  // Extract base currency from various formats
  const cleaned = raw.toUpperCase().replace(/-SWAP$/, "").replace(/-USDT$/, "").replace(/USDT$/, "")
  return cleaned || "BTC"
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const symbol = sanitizeSymbol(url.searchParams.get("symbol") || url.searchParams.get("instId"))
    const coinId = SYMBOL_TO_ID[symbol] ?? "bitcoin"

    const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
    const days = RANGE_TO_DAYS[range.id] ?? "1"

    // Fetch coin data and market chart in parallel
    const [coinResult, chartResult, derivativesResult] = await Promise.all([
      coingeckoFetch<CoinGeckoCoinData>(`/coins/${coinId}?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false&sparkline=false`),
      coingeckoFetch<CoinGeckoMarketChart>(`/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`),
      // Derivatives data for BTC only (most reliable)
      symbol === "BTC"
        ? coingeckoFetch<CoinGeckoDerivativesTicker[]>(`/derivatives?coin_ids=bitcoin`)
        : Promise.resolve({ data: null, error: null, apiKeyMissing: false }),
    ])

    // Check for API key issues
    const apiKeyMissing = !COINGECKO_API_KEY
    const apiKeyInvalid = coinResult.error?.includes("invalid") || coinResult.error?.includes("expired")
    const rateLimited = coinResult.error?.includes("rate limit")

    if (!coinResult.data && !chartResult.data) {
      return NextResponse.json({
        source: "CoinGecko",
        error: coinResult.error || chartResult.error || "Failed to fetch CoinGecko data",
        apiKeyStatus: {
          missing: apiKeyMissing,
          invalid: apiKeyInvalid,
          rateLimited,
          envVar: "COINGECKO_API_KEY",
        },
      }, { status: apiKeyMissing || rateLimited ? 200 : 502 })
    }

    const coinData = coinResult.data
    const chartData = chartResult.data
    const derivativesData = derivativesResult.data

    const price = coinData?.market_data?.current_price?.usd ?? 0
    const open24h = price - (coinData?.market_data?.price_change_24h ?? 0)

    // Process price chart to klines format
    const pricePoints = chartData?.prices ?? []
    const volumePoints = chartData?.total_volumes ?? []
    
    const rangeKlines = pricePoints.map((point, i) => {
      const time = point[0]
      const close = point[1]
      const prevClose = i > 0 ? pricePoints[i - 1][1] : close
      const vol = volumePoints[i]?.[1] ?? 0

      return {
        time,
        label: formatTimeLabel(time),
        open: prevClose,
        high: Math.max(close, prevClose),
        low: Math.min(close, prevClose),
        close,
        volume: vol,
        changePercent: prevClose === 0 ? 0 : ((close - prevClose) / prevClose) * 100,
        upperWickRatio: 0,
        lowerWickRatio: 0,
        isClosed: true,
      }
    })

    // Extract derivatives metrics from aggregated tickers
    let aggregatedFundingRate = 0
    let aggregatedOI = 0
    let tickerCount = 0

    if (derivativesData) {
      for (const ticker of derivativesData) {
        if (ticker.funding_rate && Number.isFinite(ticker.funding_rate)) {
          aggregatedFundingRate += ticker.funding_rate
          tickerCount++
        }
        if (ticker.open_interest_usd && Number.isFinite(ticker.open_interest_usd)) {
          aggregatedOI += ticker.open_interest_usd
        }
      }
    }

    const avgFundingRate = tickerCount > 0 ? aggregatedFundingRate / tickerCount : 0

    // Calculate bid/ask spread from tickers
    let avgSpread = 0
    let spreadCount = 0
    if (coinData?.tickers) {
      for (const ticker of coinData.tickers.slice(0, 10)) {
        if (ticker.bid_ask_spread_percentage && Number.isFinite(ticker.bid_ask_spread_percentage)) {
          avgSpread += ticker.bid_ask_spread_percentage
          spreadCount++
        }
      }
    }
    avgSpread = spreadCount > 0 ? avgSpread / spreadCount : 0

    return NextResponse.json({
      source: "CoinGecko",
      symbol: `${symbol}USDT`,
      instrumentId: `${symbol}-USDT`,
      base: symbol,
      bar: days === "1" ? "5m" : "1h",
      limit: rangeKlines.length,
      range: range.id,
      updatedAt: Date.now(),
      apiKeyStatus: {
        missing: apiKeyMissing,
        invalid: apiKeyInvalid,
        rateLimited,
        envVar: "COINGECKO_API_KEY",
      },
      ticker: {
        price,
        change24h: coinData?.market_data?.price_change_24h ?? 0,
        changePercent24h: coinData?.market_data?.price_change_percentage_24h ?? 0,
        high24h: coinData?.market_data?.high_24h?.usd ?? 0,
        low24h: coinData?.market_data?.low_24h?.usd ?? 0,
        volume24hUsd: coinData?.market_data?.total_volume?.usd ?? 0,
        timestamp: Date.now(),
      },
      spotPrice: price,
      perpPremium: 0, // CoinGecko doesn't provide reliable perp data
      oneMinuteKlines: [], // Not available from CoinGecko free tier
      fiveMinuteKlines: rangeKlines.slice(-120),
      rangeKlines,
      orderBook: {
        bidDepth: 0,
        askDepth: 0,
        bidAskRatio: 1,
        imbalance: 0,
        bids: [],
        asks: [],
        timestamp: Date.now(),
        spread: avgSpread,
      },
      openInterest: {
        contracts: 0,
        btc: 0,
        usd: aggregatedOI,
        timestamp: Date.now(),
      },
      openInterestHistory: [],
      fundingRate: {
        rate: avgFundingRate * 100,
        nextFundingTime: 0,
      },
      fundingRateHistory: [],
      longShortAccountRatioHistory: [],
      contractLongShortRatioHistory: [],
      topTraderPositionHistory: [],
      takerVolumeHistory: [],
      // Extra CoinGecko-specific data
      marketCap: coinData?.market_data?.market_cap?.usd ?? 0,
      circulatingSupply: coinData?.market_data?.circulating_supply ?? 0,
      totalSupply: coinData?.market_data?.total_supply ?? 0,
      ath: coinData?.market_data?.ath?.usd ?? 0,
      atl: coinData?.market_data?.atl?.usd ?? 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch CoinGecko data",
        source: "CoinGecko",
        apiKeyStatus: {
          missing: !COINGECKO_API_KEY,
          invalid: false,
          rateLimited: false,
          envVar: "COINGECKO_API_KEY",
        },
      },
      { status: 502 },
    )
  }
}
