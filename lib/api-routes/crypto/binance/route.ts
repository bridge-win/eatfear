import { NextResponse } from "next/server"
import { DEFAULT_TIME_RANGE, getTimeRange } from "@/lib/time-range"

export const revalidate = 10

interface BinanceTicker {
  symbol: string
  lastPrice: string
  openPrice: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
  priceChangePercent: string
}

interface BinanceKline {
  0: number // open time
  1: string // open
  2: string // high
  3: string // low
  4: string // close
  5: string // volume
  6: number // close time
  7: string // quote asset volume
  8: number // number of trades
  9: string // taker buy base volume
  10: string // taker buy quote volume
}

interface BinanceFundingRate {
  symbol: string
  fundingRate: string
  fundingTime: number
  markPrice: string
}

interface BinanceOpenInterest {
  symbol: string
  openInterest: string
  time: number
}

interface BinanceBookTicker {
  symbol: string
  bidPrice: string
  bidQty: string
  askPrice: string
  askQty: string
  time: number
}

interface BinanceLongShortRatio {
  symbol: string
  longShortRatio: string
  longAccount: string
  shortAccount: string
  timestamp: number
}

interface BinanceTopTraderRatio {
  symbol: string
  longShortRatio: string
  longAccount: string
  shortAccount: string
  timestamp: number
}

interface BinanceTakerVolume {
  buySellRatio: string
  buyVol: string
  sellVol: string
  timestamp: number
}

const BINANCE_SPOT_BASE = "https://api.binance.com"
const BINANCE_FUTURES_BASE = "https://fapi.binance.com"
const DEFAULT_SYMBOL = "BTCUSDT"

// Map time range to Binance interval
const RANGE_TO_BINANCE_INTERVAL: Record<string, string> = {
  "1h": "1m",
  "4h": "5m",
  "12h": "15m",
  "1d": "30m",
  "3d": "1h",
  "7d": "4h",
  "30d": "1d",
}

const binanceFetch = async <T>(baseUrl: string, path: string): Promise<T | null> => {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      next: { revalidate },
    })

    if (!response.ok) {
      console.error(`Binance request failed: ${path}, status: ${response.status}`)
      return null
    }

    return (await response.json()) as T
  } catch (error) {
    console.error(`Binance fetch error: ${path}`, error)
    return null
  }
}

const formatTimeLabel = (time: number) =>
  new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

const normalizeKlines = (klines: BinanceKline[] | null) => {
  if (!klines) return []
  return klines
    .map((k) => {
      const time = k[0]
      const open = Number(k[1])
      const high = Number(k[2])
      const low = Number(k[3])
      const close = Number(k[4])
      const volume = Number(k[5])
      const range = Math.max(high - low, Number.EPSILON)

      return {
        time,
        label: formatTimeLabel(time),
        open,
        high,
        low,
        close,
        volume,
        changePercent: open === 0 ? 0 : ((close - open) / open) * 100,
        upperWickRatio: Math.max(0, (high - Math.max(open, close)) / range),
        lowerWickRatio: Math.max(0, (Math.min(open, close) - low) / range),
        isClosed: true,
      }
    })
    .filter((point) => Number.isFinite(point.close))
}

const sanitizeSymbol = (raw: string | null) => {
  if (!raw) return DEFAULT_SYMBOL
  // Convert OKX format to Binance format
  const cleaned = raw.toUpperCase().replace(/-SWAP$/, "").replace(/-/g, "")
  if (!/^[A-Z0-9]+$/.test(cleaned)) return DEFAULT_SYMBOL
  return cleaned
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const symbol = sanitizeSymbol(url.searchParams.get("symbol") || url.searchParams.get("instId"))
    const ccy = symbol.replace(/USDT$/, "")

    const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
    const interval = RANGE_TO_BINANCE_INTERVAL[range.id] ?? "1h"
    const limit = Math.min(range.okxLimit, 500)

    // Fetch all data in parallel
    const [
      ticker24h,
      spotTicker,
      klines1m,
      klines5m,
      rangeKlines,
      fundingRate,
      fundingHistory,
      openInterest,
      openInterestHist,
      longShortRatio,
      topTraderRatio,
      topTraderPositionRatio,
      takerBuySellHist,
      bookTicker,
    ] = await Promise.all([
      // 24h ticker for futures
      binanceFetch<BinanceTicker>(BINANCE_FUTURES_BASE, `/fapi/v1/ticker/24hr?symbol=${symbol}`),
      // Spot ticker for basis calculation
      binanceFetch<BinanceTicker>(BINANCE_SPOT_BASE, `/api/v3/ticker/24hr?symbol=${symbol}`),
      // 1-minute klines
      binanceFetch<BinanceKline[]>(BINANCE_FUTURES_BASE, `/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=120`),
      // 5-minute klines
      binanceFetch<BinanceKline[]>(BINANCE_FUTURES_BASE, `/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=120`),
      // Range klines
      binanceFetch<BinanceKline[]>(
        BINANCE_FUTURES_BASE,
        `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      ),
      // Current funding rate
      binanceFetch<BinanceFundingRate[]>(BINANCE_FUTURES_BASE, `/fapi/v1/fundingRate?symbol=${symbol}&limit=1`),
      // Funding rate history
      binanceFetch<BinanceFundingRate[]>(BINANCE_FUTURES_BASE, `/fapi/v1/fundingRate?symbol=${symbol}&limit=100`),
      // Open interest
      binanceFetch<BinanceOpenInterest>(BINANCE_FUTURES_BASE, `/fapi/v1/openInterest?symbol=${symbol}`),
      // Open interest history
      binanceFetch<{ sumOpenInterest: string; sumOpenInterestValue: string; timestamp: number }[]>(
        BINANCE_FUTURES_BASE,
        `/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=100`,
      ),
      // Long/Short Ratio (accounts)
      binanceFetch<BinanceLongShortRatio[]>(
        BINANCE_FUTURES_BASE,
        `/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=100`,
      ),
      // Top Trader Long/Short Ratio (accounts)
      binanceFetch<BinanceTopTraderRatio[]>(
        BINANCE_FUTURES_BASE,
        `/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=100`,
      ),
      // Top Trader Long/Short Ratio (positions)
      binanceFetch<BinanceTopTraderRatio[]>(
        BINANCE_FUTURES_BASE,
        `/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=5m&limit=100`,
      ),
      // Taker Buy/Sell Volume
      binanceFetch<BinanceTakerVolume[]>(
        BINANCE_FUTURES_BASE,
        `/futures/data/takerlongshortRatio?symbol=${symbol}&period=5m&limit=100`,
      ),
      // Order book ticker
      binanceFetch<BinanceBookTicker>(BINANCE_FUTURES_BASE, `/fapi/v1/ticker/bookTicker?symbol=${symbol}`),
    ])

    const price = Number(ticker24h?.lastPrice ?? 0)
    const open24h = Number(ticker24h?.openPrice ?? price)
    const spotPrice = Number(spotTicker?.lastPrice ?? 0)
    const perpPremium = spotPrice > 0 ? ((price - spotPrice) / spotPrice) * 100 : 0

    // Process funding rate history
    const fundingRateHistory = (fundingHistory ?? [])
      .map((f) => ({
        time: f.fundingTime,
        rate: Number(f.fundingRate) * 100,
      }))
      .filter((point) => Number.isFinite(point.rate))

    // Process open interest history
    const openInterestHistory = (openInterestHist ?? [])
      .map((oi) => ({
        time: oi.timestamp,
        valueUsd: Number(oi.sumOpenInterestValue),
      }))
      .filter((point) => Number.isFinite(point.valueUsd))

    // Process long/short ratio history
    const longShortAccountRatioHistory = (longShortRatio ?? [])
      .map((ls) => ({
        time: ls.timestamp,
        ratio: Number(ls.longShortRatio),
      }))
      .filter((point) => Number.isFinite(point.ratio))

    // Process top trader ratio history
    const topTraderAccountHistory = topTraderRatio ?? []
    const topTraderPositionHistory = topTraderPositionRatio ?? []
    const topTraderPositionHistoryNormalized = topTraderAccountHistory.map((acc, i) => ({
      time: acc.timestamp,
      longShortAccountRatio: Number(acc.longShortRatio),
      longShortPositionRatio: Number(topTraderPositionHistory[i]?.longShortRatio ?? acc.longShortRatio),
    }))

    // Process taker volume for CVD calculation
    let cumulativeCvd = 0
    const takerVolumeHistory = (takerBuySellHist ?? [])
      .map((tv) => {
        const buyVol = Number(tv.buyVol)
        const sellVol = Number(tv.sellVol)
        const netVolume = buyVol - sellVol
        cumulativeCvd += netVolume
        return {
          time: tv.timestamp,
          sellVolume: sellVol,
          buyVolume: buyVol,
          netVolume,
          cvd: cumulativeCvd,
        }
      })
      .filter((point) => Number.isFinite(point.netVolume))

    // Calculate order book metrics
    const bidPrice = Number(bookTicker?.bidPrice ?? 0)
    const askPrice = Number(bookTicker?.askPrice ?? 0)
    const bidQty = Number(bookTicker?.bidQty ?? 0)
    const askQty = Number(bookTicker?.askQty ?? 0)
    const bidDepth = bidPrice * bidQty
    const askDepth = askPrice * askQty
    const bidAskRatio = askDepth > 0 ? bidDepth / askDepth : 1
    const imbalance = bidDepth + askDepth > 0 ? ((bidDepth - askDepth) / (bidDepth + askDepth)) * 100 : 0

    const currentFunding = fundingRate?.[0]
    const currentOI = openInterest

    return NextResponse.json({
      source: "Binance Public API",
      symbol,
      instrumentId: symbol,
      base: ccy,
      bar: interval,
      limit,
      range: range.id,
      updatedAt: Date.now(),
      ticker: {
        price,
        change24h: price - open24h,
        changePercent24h: Number(ticker24h?.priceChangePercent ?? 0),
        high24h: Number(ticker24h?.highPrice ?? 0),
        low24h: Number(ticker24h?.lowPrice ?? 0),
        volume24hUsd: Number(ticker24h?.quoteVolume ?? 0),
        timestamp: Date.now(),
      },
      spotPrice,
      perpPremium,
      oneMinuteKlines: normalizeKlines(klines1m),
      fiveMinuteKlines: normalizeKlines(klines5m),
      rangeKlines: normalizeKlines(rangeKlines),
      orderBook: {
        bidDepth,
        askDepth,
        bidAskRatio,
        imbalance,
        bids: [{ price: bidPrice, quantity: bidQty, notional: bidDepth }],
        asks: [{ price: askPrice, quantity: askQty, notional: askDepth }],
        timestamp: Date.now(),
      },
      openInterest: {
        contracts: 0,
        btc: Number(currentOI?.openInterest ?? 0),
        usd: Number(currentOI?.openInterest ?? 0) * price,
        timestamp: currentOI?.time ?? Date.now(),
      },
      openInterestHistory,
      fundingRate: {
        rate: Number(currentFunding?.fundingRate ?? 0) * 100,
        nextFundingTime: currentFunding?.fundingTime ?? 0,
      },
      fundingRateHistory,
      longShortAccountRatioHistory,
      contractLongShortRatioHistory: longShortAccountRatioHistory,
      topTraderPositionHistory: topTraderPositionHistoryNormalized,
      takerVolumeHistory,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch Binance data",
        source: "Binance",
      },
      { status: 502 },
    )
  }
}
