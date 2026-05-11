import { NextResponse } from "next/server"
import { DEFAULT_TIME_RANGE, getTimeRange } from "@/lib/time-range"

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

interface OkxOrderBook {
  bids?: string[][]
  asks?: string[][]
  ts?: string
}

const OKX_BASE_URL = "https://www.okx.com"
const DEFAULT_INST_ID = "BTC-USDT-SWAP"
const RUBIK_PERIODS = new Set(["5m", "15m", "30m", "1H", "4H", "1D"])

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

const okxFetchSafe = async <T>(path: string): Promise<T[]> => {
  try {
    return await okxFetch<T>(path)
  } catch {
    return []
  }
}

const formatTimeLabel = (time: number) =>
  new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })

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

const sanitizeInstId = (raw: string | null) => {
  if (!raw) return DEFAULT_INST_ID
  const cleaned = raw.toUpperCase().trim()
  if (!/^[A-Z0-9-]+$/.test(cleaned)) return DEFAULT_INST_ID
  return cleaned
}

const extractCcy = (instId: string) => instId.split("-")[0] ?? "BTC"

const sanitizeBar = (raw: string | null, fallback: string) => {
  if (!raw) return fallback
  const allowed = ["1m", "3m", "5m", "15m", "30m", "1H", "2H", "4H", "6H", "12H", "1D", "1W", "1M"]
  return allowed.includes(raw) ? raw : fallback
}

const sanitizeLimit = (raw: string | null, fallback: number) => {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.max(50, Math.min(300, Math.round(value)))
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const instId = sanitizeInstId(url.searchParams.get("instId"))
    const ccy = extractCcy(instId)

    const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
    const bar = sanitizeBar(url.searchParams.get("bar"), range.okxBar)
    const limit = sanitizeLimit(url.searchParams.get("limit"), range.okxLimit)
    const rubikPeriod = RUBIK_PERIODS.has(bar) ? bar : "1H"

    const [
      tickerRows,
      oneMinuteCandles,
      fiveMinuteCandles,
      rangeCandles,
      bookRows,
      openInterestRows,
      fundingRows,
      fundingHistoryRows,
      openInterestVolumeRows,
      longShortRatioRows,
      contractLongShortRatioRows,
    ] = await Promise.all([
      okxFetch<OkxTicker>(`/api/v5/market/ticker?instId=${instId}`),
      okxFetchSafe<string[]>(`/api/v5/market/candles?instId=${instId}&bar=1m&limit=120`),
      okxFetchSafe<string[]>(`/api/v5/market/candles?instId=${instId}&bar=5m&limit=120`),
      okxFetchSafe<string[]>(`/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`),
      okxFetchSafe<OkxOrderBook>(`/api/v5/market/books?instId=${instId}&sz=20`),
      okxFetchSafe<OkxOpenInterest>(`/api/v5/public/open-interest?instType=SWAP&instId=${instId}`),
      okxFetchSafe<OkxFundingRate>(`/api/v5/public/funding-rate?instId=${instId}`),
      okxFetchSafe<OkxFundingRate>(`/api/v5/public/funding-rate-history?instId=${instId}&limit=100`),
      okxFetchSafe<string[]>(`/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=${rubikPeriod}`),
      okxFetchSafe<string[]>(`/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=${rubikPeriod}`),
      okxFetchSafe<string[]>(
        `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${instId}&period=${rubikPeriod}`,
      ),
    ])

    const ticker = tickerRows[0]
    const price = Number(ticker?.last ?? 0)
    const open24h = Number(ticker?.open24h ?? price)
    const openInterest = openInterestRows[0]
    const funding = fundingRows[0]

    return NextResponse.json({
      source: "OKX Public API",
      symbol: instId.replace(/-/g, ""),
      instrumentId: instId,
      base: ccy,
      bar,
      limit,
      range: range.id,
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
      rangeKlines: normalizeCandles(rangeCandles),
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
        error: error instanceof Error ? error.message : "Failed to fetch crypto derivatives data",
      },
      { status: 502 },
    )
  }
}
