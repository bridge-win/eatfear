import { NextResponse } from "next/server"

export const revalidate = 10

interface OkxResponse<T> {
  code: string
  msg?: string
  data?: T[]
}

interface OkxTicker {
  last: string
  open24h: string
  high24h: string
  low24h: string
  volCcy24h: string
  ts: string
}

interface OkxOpenInterest {
  oi: string
  oiCcy: string
  oiUsd: string
  ts: string
}

interface OkxFundingRate {
  fundingRate: string
  fundingTime: string
}

interface DepthLevel {
  price: number
  quantity: number
  notional: number
}

interface OkxOrderBook {
  bids?: string[][]
  asks?: string[][]
  ts?: string
}

const OKX_BASE_URL = "https://www.okx.com"
const INST_ID = "BTC-USDT-SWAP"

const okxFetch = async <T>(path: string) => {
  const response = await fetch(`${OKX_BASE_URL}${path}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    next: { revalidate },
  })

  if (!response.ok) {
    throw new Error(`OKX request failed: ${path}`)
  }

  const payload = (await response.json()) as OkxResponse<T>

  if (payload.code !== "0") {
    throw new Error(payload.msg ?? `Invalid OKX response: ${path}`)
  }

  return payload.data ?? []
}

const formatTimeLabel = (time: number) => new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

const normalizeCandles = (rows: string[][]) =>
  rows
    .map((row) => {
      const time = Number(row[0])
      const open = Number(row[1])
      const high = Number(row[2])
      const low = Number(row[3])
      const close = Number(row[4])
      const volume = Number(row[5])
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
        isClosed: row[8] === "1",
      }
    })
    .filter((point) => Number.isFinite(point.close))
    .reverse()

const normalizeDepthLevels = (rows: string[][] = []) =>
  rows.map((row) => {
    const price = Number(row[0])
    const quantity = Number(row[1])

    return {
      price,
      quantity,
      notional: price * quantity,
    }
  })

const calculateOrderBook = (book?: OkxOrderBook) => {
  const bids = normalizeDepthLevels(book?.bids)
  const asks = normalizeDepthLevels(book?.asks)
  const bidDepth = bids.reduce((sum, level) => sum + level.notional, 0)
  const askDepth = asks.reduce((sum, level) => sum + level.notional, 0)
  const bidAskRatio = askDepth > 0 ? bidDepth / askDepth : 1
  const imbalance = bidDepth + askDepth > 0 ? ((bidDepth - askDepth) / (bidDepth + askDepth)) * 100 : 0

  return {
    bidDepth,
    askDepth,
    bidAskRatio,
    imbalance,
    bids,
    asks,
    timestamp: Number(book?.ts) || Date.now(),
  }
}

const normalizeFundingHistory = (rows: OkxFundingRate[]) =>
  rows
    .map((row) => ({
      time: Number(row.fundingTime),
      rate: Number(row.fundingRate) * 100,
    }))
    .filter((point) => Number.isFinite(point.rate))
    .reverse()

const normalizeTwoColumnHistory = (rows: string[][], valueKey: "valueUsd" | "ratio") =>
  rows
    .map((row) => ({
      time: Number(row[0]),
      [valueKey]: Number(row[1]),
    }))
    .filter((point) => Number.isFinite(point[valueKey]))
    .reverse()

export async function GET() {
  try {
    const [
      tickerRows,
      oneMinuteCandles,
      fiveMinuteCandles,
      bookRows,
      openInterestRows,
      fundingRows,
      fundingHistoryRows,
      openInterestVolumeRows,
      longShortRatioRows,
      contractLongShortRatioRows,
    ] = await Promise.all([
      okxFetch<OkxTicker>(`/api/v5/market/ticker?instId=${INST_ID}`),
      okxFetch<string[]>(`/api/v5/market/candles?instId=${INST_ID}&bar=1m&limit=120`),
      okxFetch<string[]>(`/api/v5/market/candles?instId=${INST_ID}&bar=5m&limit=120`),
      okxFetch<OkxOrderBook>(`/api/v5/market/books?instId=${INST_ID}&sz=20`),
      okxFetch<OkxOpenInterest>(`/api/v5/public/open-interest?instType=SWAP&instId=${INST_ID}`),
      okxFetch<OkxFundingRate>(`/api/v5/public/funding-rate?instId=${INST_ID}`),
      okxFetch<OkxFundingRate>(`/api/v5/public/funding-rate-history?instId=${INST_ID}&limit=100`),
      okxFetch<string[]>(`/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=5m`),
      okxFetch<string[]>(`/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=5m`),
      okxFetch<string[]>(
        `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${INST_ID}&period=5m`,
      ),
    ])

    const ticker = tickerRows[0]
    const price = Number(ticker?.last ?? 0)
    const open24h = Number(ticker?.open24h ?? price)
    const openInterest = openInterestRows[0]
    const funding = fundingRows[0]

    return NextResponse.json({
      source: "OKX Public API",
      symbol: "BTCUSDT",
      instrumentId: INST_ID,
      updatedAt: Date.now(),
      ticker: {
        price,
        change24h: price - open24h,
        changePercent24h: open24h === 0 ? 0 : ((price - open24h) / open24h) * 100,
        high24h: Number(ticker?.high24h ?? 0),
        low24h: Number(ticker?.low24h ?? 0),
        volume24hUsd: Number(ticker?.volCcy24h ?? 0),
        timestamp: Number(ticker?.ts) || Date.now(),
      },
      oneMinuteKlines: normalizeCandles(oneMinuteCandles),
      fiveMinuteKlines: normalizeCandles(fiveMinuteCandles),
      orderBook: calculateOrderBook(bookRows[0]),
      openInterest: {
        contracts: Number(openInterest?.oi ?? 0),
        btc: Number(openInterest?.oiCcy ?? 0),
        usd: Number(openInterest?.oiUsd ?? 0),
        timestamp: Number(openInterest?.ts) || Date.now(),
      },
      openInterestHistory: normalizeTwoColumnHistory(openInterestVolumeRows, "valueUsd"),
      fundingRate: {
        rate: Number(funding?.fundingRate ?? 0) * 100,
        nextFundingTime: Number(funding?.fundingTime ?? 0),
      },
      fundingRateHistory: normalizeFundingHistory(fundingHistoryRows),
      longShortAccountRatioHistory: normalizeTwoColumnHistory(longShortRatioRows, "ratio"),
      contractLongShortRatioHistory: normalizeTwoColumnHistory(contractLongShortRatioRows, "ratio"),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch BTC derivatives data",
      },
      { status: 502 },
    )
  }
}
