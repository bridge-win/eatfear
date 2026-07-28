import { NextResponse } from "next/server"
import { DEFAULT_TIME_RANGE, getRangeDays, getTimeRange } from "@/lib/time-range"

export const revalidate = 60

/**
 * Smart-money positioning vs. the crowd.
 *
 * Binance futures/data endpoints are the industry-standard source for
 * top-trader (position-weighted) long/short ratios; the global account ratio
 * is the retail baseline. The OKX Rubik account ratio cross-checks against a
 * second venue. Taker buy/sell volume ratio confirms whether positioning
 * shifts are backed by aggressive flow.
 *
 * Upstream retention: Binance keeps only the last 30 days and serves at most
 * 500 rows per request, so longer ranges are clamped (reported via `note`)
 * and multi-page windows are stitched to keep full in-range coverage.
 *
 * Binance's futures/data endpoints answer HTTP 451 from datacenter/US IPs —
 * exactly where this app runs on Vercel — so in production those series come
 * back empty. OKX Rubik exposes contract-level 1:1 equivalents that are
 * reachable from the same hosts, so every series falls back to OKX when the
 * Binance page is empty. That keeps top-trader / all-market long ratios,
 * divergence and taker buy/sell populated regardless of where we execute.
 */

const BINANCE_FAPI = "https://fapi.binance.com"
const OKX = "https://www.okx.com"
const BINANCE_RETENTION_DAYS = 30
const BINANCE_PAGE_LIMIT = 500
const OKX_PAGE_LIMIT = 100

const SUPPORTED_CCY = /^[A-Z0-9]{2,10}$/

interface RatioPoint {
  time: number
  ratio: number
  longPct: number
}

interface TakerPoint {
  time: number
  ratio: number
  buyVol: number
  sellVol: number
}

const sanitizeCcy = (raw: string | null) => {
  if (!raw) return "BTC"
  const cleaned = raw.toUpperCase().trim()
  return SUPPORTED_CCY.test(cleaned) ? cleaned : "BTC"
}

const PERIODS = {
  "5m": { binance: "5m", okx: "5m", ms: 5 * 60 * 1000 },
  // OKX rubik long/short only supports 5m/1H/1D — nearest coarser bucket for 30m
  "30m": { binance: "30m", okx: "1H", ms: 30 * 60 * 1000 },
  "1h": { binance: "1h", okx: "1H", ms: 60 * 60 * 1000 },
} as const

type PeriodKey = keyof typeof PERIODS

const pickPeriod = (rangeId: string): PeriodKey => {
  if (rangeId === "1d") return "5m"
  if (rangeId === "5d") return "30m"
  return "1h"
}

const fetchJsonSafe = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate },
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

interface BinanceRatioRow {
  longShortRatio?: string
  longAccount?: string
  shortAccount?: string
  timestamp?: number
}

interface BinanceTakerRow {
  buySellRatio?: string
  buyVol?: string
  sellVol?: string
  timestamp?: number
}

/**
 * Binance caps futures/data responses at 500 rows, so ranges that need more
 * points are fetched in forward time windows and stitched together.
 */
const fetchBinanceWindows = async <T extends { timestamp?: number }>(
  path: string,
  symbol: string,
  period: PeriodKey,
  startMs: number,
  endMs: number,
): Promise<T[]> => {
  const windowMs = BINANCE_PAGE_LIMIT * PERIODS[period].ms
  const rows: T[] = []
  let cursor = startMs
  let guard = 0
  while (cursor < endMs && guard < 8) {
    guard += 1
    const windowEnd = Math.min(cursor + windowMs - 1, endMs)
    const page = await fetchJsonSafe<T[]>(
      `${BINANCE_FAPI}${path}?symbol=${symbol}&period=${PERIODS[period].binance}` +
        `&limit=${BINANCE_PAGE_LIMIT}&startTime=${cursor}&endTime=${windowEnd}`,
    )
    if (Array.isArray(page)) rows.push(...page)
    cursor = windowEnd + 1
  }
  return rows
}

const toRatioPoints = (rows: BinanceRatioRow[]): RatioPoint[] => {
  const byTime = new Map<number, RatioPoint>()
  for (const row of rows) {
    const time = Number(row.timestamp)
    const ratio = Number(row.longShortRatio)
    if (!Number.isFinite(time) || !Number.isFinite(ratio) || ratio < 0) continue
    const longAccount = Number(row.longAccount)
    const longPct = Number.isFinite(longAccount) && longAccount > 0 && longAccount < 1
      ? longAccount * 100
      : (ratio / (1 + ratio)) * 100
    byTime.set(time, { time, ratio, longPct })
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

const toTakerPoints = (rows: BinanceTakerRow[]): TakerPoint[] => {
  const byTime = new Map<number, TakerPoint>()
  for (const row of rows) {
    const time = Number(row.timestamp)
    const ratio = Number(row.buySellRatio)
    if (!Number.isFinite(time) || !Number.isFinite(ratio)) continue
    byTime.set(time, {
      time,
      ratio,
      buyVol: Number(row.buyVol) || 0,
      sellVol: Number(row.sellVol) || 0,
    })
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

interface OkxRubikResponse {
  code?: string
  data?: [string, string][]
}

const fetchOkxAccountRatio = async (
  ccy: string,
  period: PeriodKey,
  startMs: number,
  endMs: number,
): Promise<RatioPoint[]> => {
  const windowMs = BINANCE_PAGE_LIMIT * PERIODS[period].ms
  const byTime = new Map<number, RatioPoint>()
  let cursor = startMs
  let guard = 0
  while (cursor < endMs && guard < 8) {
    guard += 1
    const windowEnd = Math.min(cursor + windowMs - 1, endMs)
    const payload = await fetchJsonSafe<OkxRubikResponse>(
      `${OKX}/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}` +
        `&period=${PERIODS[period].okx}&begin=${cursor}&end=${windowEnd}`,
    )
    if (payload?.code === "0" && Array.isArray(payload.data)) {
      for (const row of payload.data) {
        const time = Number(row[0])
        const ratio = Number(row[1])
        if (!Number.isFinite(time) || !Number.isFinite(ratio) || ratio < 0) continue
        byTime.set(time, { time, ratio, longPct: (ratio / (1 + ratio)) * 100 })
      }
    }
    cursor = windowEnd + 1
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

interface OkxContractResponse {
  code?: string
  data?: string[][]
}

/**
 * OKX Rubik contract-level stats page by `begin`/`end` (max 100 rows/request),
 * newest-first. Windows are stitched forward to cover the full requested range.
 */
const fetchOkxContractWindows = async (
  path: string,
  instId: string,
  period: PeriodKey,
  startMs: number,
  endMs: number,
): Promise<string[][]> => {
  const windowMs = OKX_PAGE_LIMIT * PERIODS[period].ms
  const rows: string[][] = []
  let cursor = startMs
  let guard = 0
  while (cursor < endMs && guard < 16) {
    guard += 1
    const windowEnd = Math.min(cursor + windowMs - 1, endMs)
    const payload = await fetchJsonSafe<OkxContractResponse>(
      `${OKX}${path}?instId=${instId}&period=${PERIODS[period].okx}` +
        `&begin=${cursor}&end=${windowEnd}&limit=${OKX_PAGE_LIMIT}`,
    )
    if (payload?.code === "0" && Array.isArray(payload.data)) rows.push(...payload.data)
    cursor = windowEnd + 1
  }
  return rows
}

const okxRatioPoints = (rows: string[][]): RatioPoint[] => {
  const byTime = new Map<number, RatioPoint>()
  for (const row of rows) {
    const time = Number(row[0])
    const ratio = Number(row[1])
    if (!Number.isFinite(time) || !Number.isFinite(ratio) || ratio < 0) continue
    byTime.set(time, { time, ratio, longPct: (ratio / (1 + ratio)) * 100 })
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

// OKX taker-volume-contract rows are [ts, sellVol, buyVol]; ratio = buy / sell.
const okxTakerPoints = (rows: string[][]): TakerPoint[] => {
  const byTime = new Map<number, TakerPoint>()
  for (const row of rows) {
    const time = Number(row[0])
    const sellVol = Number(row[1])
    const buyVol = Number(row[2])
    if (!Number.isFinite(time) || !Number.isFinite(buyVol) || !Number.isFinite(sellVol)) continue
    byTime.set(time, { time, ratio: sellVol > 0 ? buyVol / sellVol : 0, buyVol, sellVol })
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

type SeriesSource = "binance" | "okx" | "none"

const preferBinance = <T>(binance: T[], okx: T[]): { points: T[]; source: SeriesSource } =>
  binance.length > 0
    ? { points: binance, source: "binance" }
    : okx.length > 0
      ? { points: okx, source: "okx" }
      : { points: [], source: "none" }

const latestOf = <T>(points: T[]): T | null => (points.length > 0 ? points[points.length - 1] : null)

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
  const requestedDays = getRangeDays(range.id)
  const days = Math.min(requestedDays, BINANCE_RETENTION_DAYS)
  const period = pickPeriod(range.id)
  const symbol = `${ccy}USDT`

  const endMs = Date.now()
  const startMs = endMs - days * 24 * 60 * 60 * 1000

  const instId = `${ccy}-USDT-SWAP`

  const [
    topPositionRows,
    topAccountRows,
    globalAccountRows,
    takerRows,
    okxAccount,
    okxTopPositionRows,
    okxTopAccountRows,
    okxGlobalRows,
    okxTakerRows,
  ] = await Promise.all([
    fetchBinanceWindows<BinanceRatioRow>("/futures/data/topLongShortPositionRatio", symbol, period, startMs, endMs),
    fetchBinanceWindows<BinanceRatioRow>("/futures/data/topLongShortAccountRatio", symbol, period, startMs, endMs),
    fetchBinanceWindows<BinanceRatioRow>("/futures/data/globalLongShortAccountRatio", symbol, period, startMs, endMs),
    fetchBinanceWindows<BinanceTakerRow>("/futures/data/takerlongshortRatio", symbol, period, startMs, endMs),
    fetchOkxAccountRatio(ccy, period, startMs, endMs),
    fetchOkxContractWindows(
      "/api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader",
      instId,
      period,
      startMs,
      endMs,
    ),
    fetchOkxContractWindows(
      "/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader",
      instId,
      period,
      startMs,
      endMs,
    ),
    fetchOkxContractWindows(
      "/api/v5/rubik/stat/contracts/long-short-account-ratio-contract",
      instId,
      period,
      startMs,
      endMs,
    ),
    fetchOkxContractWindows("/api/v5/rubik/stat/taker-volume-contract", instId, period, startMs, endMs),
  ])

  const topPositionPick = preferBinance(toRatioPoints(topPositionRows), okxRatioPoints(okxTopPositionRows))
  const topAccountPick = preferBinance(toRatioPoints(topAccountRows), okxRatioPoints(okxTopAccountRows))
  const globalAccountPick = preferBinance(toRatioPoints(globalAccountRows), okxRatioPoints(okxGlobalRows))
  const takerPick = preferBinance(toTakerPoints(takerRows), okxTakerPoints(okxTakerRows))

  const topPosition = topPositionPick.points
  const topAccount = topAccountPick.points
  const globalAccount = globalAccountPick.points
  const takerRatio = takerPick.points

  const latestTop = latestOf(topPosition)
  const latestGlobal = latestOf(globalAccount)
  const latestTaker = latestOf(takerRatio)
  const spread = latestTop && latestGlobal ? latestTop.longPct - latestGlobal.longPct : null

  const bias = spread === null ? "unknown" : spread > 5 ? "smartLong" : spread < -5 ? "smartShort" : "aligned"

  return NextResponse.json({
    sources: [
      "Binance futures/data top-trader & global long/short ratios (primary)",
      "Binance futures/data taker buy/sell volume (primary)",
      "OKX Rubik contract top-trader / all-account long-short & taker volume (fallback)",
    ],
    ccy,
    symbol,
    instId,
    range: range.id,
    period,
    requestedDays,
    clampedDays: days,
    note: requestedDays > BINANCE_RETENTION_DAYS ? "binance-30d-retention" : null,
    sourceUsed: {
      topPosition: topPositionPick.source,
      topAccount: topAccountPick.source,
      globalAccount: globalAccountPick.source,
      takerRatio: takerPick.source,
    },
    series: {
      topPosition,
      topAccount,
      globalAccount,
      takerRatio,
      okxAccount,
    },
    divergence: {
      topPositionLongPct: latestTop?.longPct ?? null,
      globalLongPct: latestGlobal?.longPct ?? null,
      spread,
      takerRatio: latestTaker?.ratio ?? null,
      bias,
    },
    updatedAt: Date.now(),
  })
}
