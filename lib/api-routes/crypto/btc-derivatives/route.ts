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

const normalizeTopTraderRatioHistory = (rows: string[][]) =>
  rows
    .map((row) => ({
      time: Number(row[0]),
      longShortAccountRatio: Number(row[1]),
      longShortPositionRatio: Number(row[2]),
    }))
    .filter((point) => Number.isFinite(point.longShortAccountRatio))
    .reverse()

interface OkxLiquidationGroup {
  instId: string
  details: {
    side: "buy" | "sell"
    posSide: "long" | "short"
    bkPx: string
    sz: string
    ts: string
  }[]
}

/* Per-price-bucket aggregation of recent liquidation orders (last ~24h).
   Useful for identifying price levels with high cascade-liquidation density. */
async function fetchLiquidationLevels(instId: string, currentPrice: number) {
  if (currentPrice <= 0) return []

  const ccy = instId.split("-")[0] ?? "BTC"
  // Scale bucket to ~0.3% of price, snapped to a round number
  const rawBucket = currentPrice * 0.003
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawBucket)))
  const bucketSize = Math.max(magnitude, Math.round(rawBucket / magnitude) * magnitude)

  const longByBucket = new Map<number, number>()
  const shortByBucket = new Map<number, number>()
  // BTC-USDT-SWAP: 1 contract = 0.01 BTC face value
  const CT_VAL: Record<string, number> = {
    BTC: 0.01, ETH: 0.01, SOL: 0.1, XRP: 100, BNB: 0.01, DOGE: 1000,
  }
  const ctVal = CT_VAL[ccy] ?? 0.01
  let after: string | null = null

  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      instType: "SWAP",
      instId,
      state: "filled",
      limit: "100",
    })
    if (after) params.set("after", after)

    let groups: OkxLiquidationGroup[] = []
    try {
      const res = await fetch(
        `${OKX_BASE_URL}/api/v5/public/liquidation-orders?${params.toString()}`,
        { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, next: { revalidate } },
      )
      if (!res.ok) break
      const json = (await res.json()) as { code: string; data?: OkxLiquidationGroup[] }
      if (String(json.code) !== "0") break
      groups = json.data ?? []
    } catch {
      break
    }

    if (groups.length === 0) break
    let oldestTs = Number.POSITIVE_INFINITY

    for (const group of groups) {
      for (const detail of group.details ?? []) {
        const ts = Number(detail.ts)
        const bkPx = Number(detail.bkPx)
        const sz = Number(detail.sz)
        if (!Number.isFinite(bkPx) || !Number.isFinite(sz) || bkPx <= 0) continue
        const notionalUsd = sz * ctVal * bkPx
        const bucket = Math.floor(bkPx / bucketSize) * bucketSize
        if (detail.posSide === "long") {
          longByBucket.set(bucket, (longByBucket.get(bucket) ?? 0) + notionalUsd)
        } else {
          shortByBucket.set(bucket, (shortByBucket.get(bucket) ?? 0) + notionalUsd)
        }
        if (Number.isFinite(ts) && ts < oldestTs) oldestTs = ts
      }
    }

    if (!Number.isFinite(oldestTs)) break
    after = String(oldestTs)
  }

  const allBuckets = new Set([...longByBucket.keys(), ...shortByBucket.keys()])
  return Array.from(allBuckets)
    .sort((a, b) => a - b)
    .map((bucket) => {
      const longLiqUsd = longByBucket.get(bucket) ?? 0
      const shortLiqUsd = shortByBucket.get(bucket) ?? 0
      return {
        priceLow: bucket,
        priceHigh: bucket + bucketSize,
        longLiqUsd,
        shortLiqUsd,
        totalUsd: longLiqUsd + shortLiqUsd,
      }
    })
    .filter((level) => level.totalUsd > 0)
}

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
    /* OKX rubik endpoints cap at ~300 points/request, so we keep history below that ceiling. */
    const rubikLimit = Math.max(60, Math.min(300, range.okxLimit))

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
      topTraderPositionRows,
      takerVolumeRows,
      spotTickerRows,
    ] = await Promise.all([
      okxFetch<OkxTicker>(`/api/v5/market/ticker?instId=${instId}`),
      okxFetchSafe<string[]>(`/api/v5/market/candles?instId=${instId}&bar=1m&limit=120`),
      okxFetchSafe<string[]>(`/api/v5/market/candles?instId=${instId}&bar=5m&limit=120`),
      okxFetchSafe<string[]>(`/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`),
      okxFetchSafe<OkxOrderBook>(`/api/v5/market/books?instId=${instId}&sz=20`),
      okxFetchSafe<OkxOpenInterest>(`/api/v5/public/open-interest?instType=SWAP&instId=${instId}`),
      okxFetchSafe<OkxFundingRate>(`/api/v5/public/funding-rate?instId=${instId}`),
      okxFetchSafe<OkxFundingRate>(`/api/v5/public/funding-rate-history?instId=${instId}&limit=${rubikLimit}`),
      okxFetchSafe<string[]>(`/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=${rubikPeriod}&limit=${rubikLimit}`),
      okxFetchSafe<string[]>(`/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=${rubikPeriod}&limit=${rubikLimit}`),
      okxFetchSafe<string[]>(
        `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${instId}&period=${rubikPeriod}&limit=${rubikLimit}`,
      ),
      // Top trader position ratio (account + position)
      okxFetchSafe<string[]>(
        `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${instId}&period=${rubikPeriod}&limit=${rubikLimit}`,
      ),
      // Taker buy/sell volume (for CVD calculation)
      okxFetchSafe<string[]>(`/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SWAP&period=${rubikPeriod}&limit=${rubikLimit}`),
      // Spot ticker for basis calculation
      okxFetchSafe<OkxTicker>(`/api/v5/market/ticker?instId=${ccy}-USDT`),
    ])

    const ticker = tickerRows[0]
    const price = Number(ticker?.last ?? 0)
    const open24h = Number(ticker?.open24h ?? price)
    const openInterest = openInterestRows[0]
    const funding = fundingRows[0]
    const spotTicker = spotTickerRows[0]
    const spotPrice = Number(spotTicker?.last ?? 0)

    const liquidationLevels = await fetchLiquidationLevels(instId, price)

    // Calculate perpetual premium (basis) = (perp price - spot price) / spot price * 100
    const perpPremium = spotPrice > 0 ? ((price - spotPrice) / spotPrice) * 100 : 0

    // Process taker volume for CVD calculation
    // takerVolumeRows format: [ts, sellVol, buyVol]
    const takerVolumeHistory = takerVolumeRows
      .map((row) => {
        const time = Number(row[0])
        const sellVol = Number(row[1])
        const buyVol = Number(row[2])
        return {
          time,
          sellVolume: sellVol,
          buyVolume: buyVol,
          netVolume: buyVol - sellVol,
          cvd: buyVol - sellVol, // Cumulative will be calculated client-side
        }
      })
      .filter((point) => Number.isFinite(point.netVolume))
      .reverse()

    // Calculate cumulative CVD
    let cumulativeCvd = 0
    for (const point of takerVolumeHistory) {
      cumulativeCvd += point.netVolume
      point.cvd = cumulativeCvd
    }

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
      spotPrice,
      perpPremium,
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
      topTraderPositionHistory: normalizeTopTraderRatioHistory(topTraderPositionRows),
      takerVolumeHistory,
      liquidationLevels,
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
