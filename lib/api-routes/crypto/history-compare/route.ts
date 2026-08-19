import { NextResponse } from "next/server"

import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import {
  fetchBlockchainInfoSeries,
  fetchBtcUsdDailyFromBlockchain,
} from "@/lib/data-sources/blockchain-info-charts"
import { fetchStablecoinMarketCap, fetchDefiTvl } from "@/lib/data-sources/defillama"
import { fetchMempoolHashrateHistory } from "@/lib/data-sources/mempool"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { fetchJson } from "@/lib/data-sources/_fetch"
import {
  computeMiningCostFromHashrateHps,
  computeMiningCostFromHashrateThPerSec,
  resolveMiningCostParameters,
} from "@/lib/mining-cost"
import { computeMarketManipulationMetrics } from "@/lib/market-manipulation-metrics"
import {
  DEFAULT_CRYPTO_HISTORY_REFRESH_MS,
  getEnabledCryptoIndicators,
  type CryptoIndicatorGroup,
  type CryptoIndicatorUnit,
} from "@/lib/crypto-indicator-config"
import {
  buildOrderBookDepthSnapshot,
  computeCompositeSignals,
  computeDerivativeFeatures,
  computeOiVolumeRatio,
  computeQuantFeatures,
} from "@/lib/crypto-quant-features"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_CRYPTO_HISTORY_INTERVAL,
  DEFAULT_TIME_RANGE,
  getBlockchainTimespan,
  getCryptoHistoryInterval,
  getDefaultCryptoIntervalForRange,
  getRangeStartMs,
  getTimeRange,
  isCryptoHistoryInterval,
  type TimeRangeId,
  type TimeRangeOption,
} from "@/lib/time-range"

export const revalidate = 300

/**
 * History Compare aggregator.
 *
 * Pulls ~30 BTC + crypto + macro time series from public APIs in parallel,
 * resamples each onto a shared daily UTC grid spanning the selected range,
 * keeps only series that fully cover that grid with real/fresh source data,
 * and returns a flat list of series-specs ready to drop into a multi-pane chart.
 *
 * Why server-side: aligning N series against one timeline is a CPU-light
 * but I/O-heavy job. Doing it once on the server lets every client fetch
 * a single JSON instead of 15+ cross-origin requests.
 */

interface RawPoint {
  timestamp: number
  value: number
}

/* lightweight-charts asserts |value| < 9e13. Anything denser than that we
   must scale here, both so the chart accepts the data and so the units
   shown in the tooltip stay readable. */
const LWC_MAX_ABS = 9e13

function scale(points: RawPoint[], factor: number): RawPoint[] {
  if (factor === 1) return points
  return points.map((p) => ({ timestamp: p.timestamp, value: p.value / factor }))
}

function dropOutOfRange(points: RawPoint[]): RawPoint[] {
  return points.filter((p) => Math.abs(p.value) < LWC_MAX_ABS && Number.isFinite(p.value))
}

function rollingReturnZScore(points: RawPoint[], windowSize: number): RawPoint[] {
  const sorted = dropOutOfRange(points).sort((a, b) => a.timestamp - b.timestamp)
  if (sorted.length === 0) return []

  const returns: RawPoint[] = sorted.map((point, index) => {
    const previous = sorted[index - 1]
    if (!previous || previous.value === 0) return { timestamp: point.timestamp, value: 0 }
    return { timestamp: point.timestamp, value: (point.value / previous.value - 1) * 100 }
  })

  return returns.map((point, index) => {
    const sample = returns.slice(Math.max(0, index - windowSize + 1), index + 1).map((row) => row.value)
    const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length
    const variance = sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sample.length
    const deviation = Math.sqrt(variance)
    return { timestamp: point.timestamp, value: deviation === 0 ? 0 : (point.value - mean) / deviation }
  })
}

function rollingReturnPct(points: RawPoint[], lookbackDays: number): RawPoint[] {
  const sorted = dropOutOfRange(points).sort((a, b) => a.timestamp - b.timestamp)
  return sorted.map((point, index) => {
    const previous = sorted[index - lookbackDays]
    if (!previous || previous.value === 0) return { timestamp: point.timestamp, value: 0 }
    return { timestamp: point.timestamp, value: (point.value / previous.value - 1) * 100 }
  })
}

function dailyChangePct(points: RawPoint[]): RawPoint[] {
  const sorted = dropOutOfRange(points).sort((a, b) => a.timestamp - b.timestamp)
  return sorted.map((point, index) => {
    const previous = sorted[index - 1]
    if (!previous || previous.value === 0) return { timestamp: point.timestamp, value: 0 }
    return { timestamp: point.timestamp, value: (point.value / previous.value - 1) * 100 }
  })
}

function rollingRealizedVolatilityPct(points: RawPoint[], windowSize: number): RawPoint[] {
  const sorted = dropOutOfRange(points).sort((a, b) => a.timestamp - b.timestamp)
  const returns = sorted.map((point, index) => {
    const previous = sorted[index - 1]
    if (!previous || previous.value === 0) return { timestamp: point.timestamp, value: 0 }
    return { timestamp: point.timestamp, value: Math.log(point.value / previous.value) }
  })

  return returns.map((point, index) => {
    const sample = returns.slice(Math.max(0, index - windowSize + 1), index + 1).map((row) => row.value)
    const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length
    const variance = sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sample.length
    return { timestamp: point.timestamp, value: Math.sqrt(variance) * Math.sqrt(365) * 100 }
  })
}

function drawdownPct(points: RawPoint[]): RawPoint[] {
  const sorted = dropOutOfRange(points).sort((a, b) => a.timestamp - b.timestamp)
  let peak = 0
  return sorted.map((point) => {
    peak = Math.max(peak, point.value)
    if (peak === 0) return { timestamp: point.timestamp, value: 0 }
    return { timestamp: point.timestamp, value: (point.value / peak - 1) * 100 }
  })
}

function rollingValueZScore(points: RawPoint[], windowSize: number): RawPoint[] {
  const sorted = dropOutOfRange(points).sort((a, b) => a.timestamp - b.timestamp)
  if (sorted.length === 0) return []

  return sorted.map((point, index) => {
    const sample = sorted.slice(Math.max(0, index - windowSize + 1), index + 1).map((row) => row.value)
    const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length
    const variance = sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sample.length
    const deviation = Math.sqrt(variance)
    return { timestamp: point.timestamp, value: deviation === 0 ? 0 : (point.value - mean) / deviation }
  })
}

function toRawPoints(candles: OkxCandlePoint[], field: keyof Pick<OkxCandlePoint, "close" | "quoteVolume" | "upperWickPct" | "lowerWickPct">): RawPoint[] {
  return candles.map((candle) => ({ timestamp: candle.timestamp, value: candle[field] }))
}

function toDayKey(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS) * DAY_MS
}

function buildBasis(perpCandles: OkxCandlePoint[], spotCandles: OkxCandlePoint[]): RawPoint[] {
  const spotByDay = new Map(spotCandles.map((candle) => [toDayKey(candle.timestamp), candle.close]))
  return perpCandles
    .map((candle) => {
      const spot = spotByDay.get(toDayKey(candle.timestamp))
      if (!spot || spot === 0) return null
      return { timestamp: candle.timestamp, value: ((candle.close - spot) / spot) * 100 }
    })
    .filter((point): point is RawPoint => point !== null && Number.isFinite(point.value))
}

function buildDailySignalScores({
  candles,
  oi,
  funding,
  lsRatio,
}: {
  candles: OkxCandlePoint[]
  oi: RawPoint[]
  funding: RawPoint[]
  lsRatio: RawPoint[]
}): {
  buyScore: RawPoint[]
  sellScore: RawPoint[]
  riskScore: RawPoint[]
  direction: RawPoint[]
} {
  const sortedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp)
  const volumeZ = rollingValueZScore(toRawPoints(sortedCandles, "quoteVolume"), 30)
  const returnZ = rollingReturnZScore(toRawPoints(sortedCandles, "close"), 30)
  const oiByDay = new Map(oi.map((point) => [toDayKey(point.timestamp), point.value]))
  const fundingByDay = new Map(funding.map((point) => [toDayKey(point.timestamp), point.value]))
  const lsByDay = new Map(lsRatio.map((point) => [toDayKey(point.timestamp), point.value]))
  const volumeZByDay = new Map(volumeZ.map((point) => [toDayKey(point.timestamp), point.value]))
  const returnZByDay = new Map(returnZ.map((point) => [toDayKey(point.timestamp), point.value]))

  const buyScore: RawPoint[] = []
  const sellScore: RawPoint[] = []
  const riskScore: RawPoint[] = []
  const direction: RawPoint[] = []

  let previousOi: number | null = null
  for (const candle of sortedCandles) {
    const day = toDayKey(candle.timestamp)
    const oiValue = oiByDay.get(day) ?? null
    const oiChangePct = previousOi && previousOi !== 0 && oiValue ? ((oiValue - previousOi) / previousOi) * 100 : 0
    if (oiValue) previousOi = oiValue

    const retZ = returnZByDay.get(day) ?? 0
    const volZ = volumeZByDay.get(day) ?? 0
    const fundingValue = fundingByDay.get(day) ?? 0
    const lsValue = lsByDay.get(day) ?? 1

    const buy = Math.min(
      100,
      Number(retZ < -2.5) * 24 +
        Number(candle.lowerWickPct > 55) * 20 +
        Number(volZ > 2.5) * 18 +
        Number(oiChangePct < -2) * 20 +
        Number(fundingValue < 0) * 8 +
        Number(lsValue < 0.85) * 10,
    )
    const sell = Math.min(
      100,
      Number(retZ > 2.5) * 24 +
        Number(candle.upperWickPct > 55) * 20 +
        Number(volZ > 2.5) * 18 +
        Number(oiChangePct < -2) * 16 +
        Number(fundingValue > 0.05) * 10 +
        Number(lsValue > 1.25) * 12,
    )
    const risk = Math.min(
      100,
      Math.abs(retZ) * 10 +
        Math.max(0, volZ) * 5 +
        Math.abs(oiChangePct) * 3 +
        Math.abs(fundingValue) * 100 +
        Math.abs(lsValue - 1) * 20,
    )
    const directionCode = risk >= 70 ? 2 : buy >= 70 ? 1 : sell >= 70 ? -1 : 0

    buyScore.push({ timestamp: candle.timestamp, value: buy })
    sellScore.push({ timestamp: candle.timestamp, value: sell })
    riskScore.push({ timestamp: candle.timestamp, value: risk })
    direction.push({ timestamp: candle.timestamp, value: directionCode })
  }

  return { buyScore, sellScore, riskScore, direction }
}

interface SeriesSpec {
  key: string
  i18nKey: string
  infoI18nKey: string
  labelVars?: Record<string, string | number>
  order: number
  paneIndex: number
  group: CryptoIndicatorGroup
  tier: "core" | "secondary"
  color: string
  source: string
  unit: CryptoIndicatorUnit
  refreshMs: number
  relevanceScore?: number
  nativeInterval: string
  coverage: "complete" | "partial"
  freshness: "live" | "collected" | "historical"
  data: { time: number; value: number | null }[]
}

const DAY_MS = 86_400_000
const MAX_HISTORY_POINTS = 5_000
const CUSTOM_COVERAGE_RANGES: readonly TimeRangeId[] = ["1mo", "3mo", "6mo", "1y", "5y", "10y", "max"]

interface HistorySelection {
  rangeId: string
  startMs: number
  endMs: number
  days: number
  interval: ReturnType<typeof getCryptoHistoryInterval>
  custom: boolean
}

/* Build a UTC timeline covering the requested window at the selected candle interval. */
function buildTimeline(startMs: number, anchorMs: number, stepMs: number): number[] {
  const out: number[] = []
  const start = Math.floor(startMs / stepMs) * stepMs
  const end = Math.floor(anchorMs / stepMs) * stepMs
  for (let t = start; t <= end; t += stepMs) out.push(t)
  return out
}

function compactTimeline(timeline: number[]): number[] {
  if (timeline.length <= MAX_HISTORY_POINTS) return timeline
  const stride = Math.ceil(timeline.length / MAX_HISTORY_POINTS)
  return timeline.filter((_, index) => index % stride === 0 || index === timeline.length - 1)
}

/**
 * Resample sparse points onto a daily timeline by nearest-prior carry-forward
 * (max 7-day staleness). Carry-forward is only used to normalize real source
 * updates onto a daily grid; series with gaps after this pass are excluded.
 */
function alignSeries(points: RawPoint[], timeline: number[], maxStaleMs: number): (number | null)[] {
  if (points.length === 0) return timeline.map(() => null)
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  const out: (number | null)[] = []
  let cursor = 0
  let lastValue: number | null = null
  let lastTime = -Infinity
  for (const t of timeline) {
    while (cursor < sorted.length && sorted[cursor].timestamp <= t + maxStaleMs / 2) {
      lastValue = sorted[cursor].value
      lastTime = sorted[cursor].timestamp
      cursor++
    }
    out.push(lastValue !== null && t - lastTime <= maxStaleMs ? lastValue : null)
  }
  return out
}

function hasCompleteCoverage(values: (number | null)[]): boolean {
  return values.length > 0 && values.every((value) => value !== null && Number.isFinite(value))
}

function hasUsableCoverage(values: (number | null)[]): boolean {
  return values.filter((value) => value !== null && Number.isFinite(value)).length >= 2
}

function chooseCompleteCandidate(candidates: RawPoint[][], timeline: number[]): RawPoint[] {
  const nonEmpty = candidates.filter((candidate) => candidate.length > 0)
  if (nonEmpty.length === 0) return []
  return nonEmpty.find((candidate) => hasCompleteCoverage(alignSeries(dropOutOfRange(candidate), timeline, 7 * DAY_MS))) ?? nonEmpty[0]
}

function resolveHistorySelection(url: URL): HistorySelection {
  const rangeId = url.searchParams.get("range") ?? DEFAULT_TIME_RANGE
  const presetRange = getTimeRange(rangeId)
  const now = Date.now()
  const requestedEnd = Number(url.searchParams.get("end"))
  const requestedStart = Number(url.searchParams.get("start"))
  const hasCustomWindow = Number.isFinite(requestedStart) && Number.isFinite(requestedEnd) && requestedEnd > requestedStart
  const endMs = hasCustomWindow ? Math.min(requestedEnd, now) : now
  const startMs = hasCustomWindow ? requestedStart : getRangeStartMs(presetRange.id, endMs)
  const days = Math.max(1, Math.ceil((endMs - startMs) / DAY_MS))
  const intervalParam = url.searchParams.get("interval")
  const defaultInterval = getDefaultCryptoIntervalForRange(presetRange.id)
  const interval = getCryptoHistoryInterval(
    intervalParam && isCryptoHistoryInterval(intervalParam) ? intervalParam : defaultInterval ?? DEFAULT_CRYPTO_HISTORY_INTERVAL,
  )
  return {
    rangeId: hasCustomWindow ? "custom" : presetRange.id,
    startMs,
    endMs,
    days,
    interval,
    custom: hasCustomWindow,
  }
}

/* ---------------------- per-source fetchers ---------------------- */

interface OkxResponse<T> {
  code: string | number
  data?: T[]
}

interface OkxCandlePoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  changePercent: number
  upperWickPct: number
  lowerWickPct: number
}

const OKX = "https://www.okx.com"

/* OKX Rubik stat endpoints cap at 100 rows per request; market history-candles
   and funding-rate-history also cap at 100. To cover ranges longer than
   ~100 days we must paginate manually using begin/end (Rubik) or after
   (candles/funding). MAX_PAGES caps total requests per endpoint to bound
   latency and rate-limit pressure. */
const OKX_RUBIK_PAGE_LIMIT = 100
const OKX_CANDLE_PAGE_LIMIT = 100
const OKX_FUNDING_PAGE_LIMIT = 100
const OKX_MAX_PAGES = 60
const OKX_RETRY_DELAYS_MS = [500, 1_250, 2_500] as const
const OKX_RUBIK_REQUEST_SPACING_MS = 150
/* OKX publishes hard retention windows for these Rubik derivatives stats;
   skip requests that cannot cover the selected range's left edge. */
const OKX_INSTRUMENT_HISTORY_EARLIEST_MS = Date.UTC(2024, 0, 1)
const OKX_TOP_TRADER_HISTORY_EARLIEST_MS = Date.UTC(2024, 2, 22)
const OKX_MARKET_LONG_SHORT_MAX_DAYS = 180

type OkxDerivativeHistoryPeriod = "5m" | "15m" | "30m" | "1H" | "4H" | "1D" | "1W"

function okxDerivativeHistoryPeriod(daysWanted: number, requestedPeriod?: OkxDerivativeHistoryPeriod | null): {
  period: OkxDerivativeHistoryPeriod
  stepDays: number
} {
  if (requestedPeriod) {
    switch (requestedPeriod) {
      case "5m":
        return { period: "5m", stepDays: 5 / 1440 }
      case "15m":
        return { period: "15m", stepDays: 15 / 1440 }
      case "30m":
        return { period: "30m", stepDays: 30 / 1440 }
      case "1H":
        return { period: "1H", stepDays: 1 / 24 }
      case "4H":
        return { period: "4H", stepDays: 4 / 24 }
      case "1D":
        return { period: "1D", stepDays: 1 }
      case "1W":
        return { period: "1W", stepDays: 7 }
    }
  }
  return daysWanted > 450 ? { period: "1W", stepDays: 7 } : { period: "1D", stepDays: 1 }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

let okxRubikQueue: Promise<void> = Promise.resolve()
let okxRubikNextSlot = 0

async function reserveOkxRubikSlot(): Promise<void> {
  const previous = okxRubikQueue
  let release: () => void = () => {}
  okxRubikQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  const now = Date.now()
  const waitMs = Math.max(0, okxRubikNextSlot - now)
  okxRubikNextSlot = Math.max(now, okxRubikNextSlot) + OKX_RUBIK_REQUEST_SPACING_MS
  release()
  if (waitMs > 0) await wait(waitMs)
}

async function okxRubikSeries(path: string): Promise<string[][]> {
  const shouldThrottle = path.startsWith("/api/v5/rubik/")
  for (let attempt = 0; attempt <= OKX_RETRY_DELAYS_MS.length; attempt++) {
    try {
      if (shouldThrottle) await reserveOkxRubikSlot()
      const res = await fetch(`${OKX}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        next: { revalidate },
      })
      const json = (await res.json()) as OkxResponse<string[]>
      const code = String(json.code)
      const rateLimited = res.status === 429 || code === "50011"
      if (rateLimited && attempt < OKX_RETRY_DELAYS_MS.length) {
        await wait(OKX_RETRY_DELAYS_MS[attempt])
        continue
      }
      if (!res.ok || code !== "0") return []
      return (json.data ?? []) as string[][]
    } catch {
      if (attempt >= OKX_RETRY_DELAYS_MS.length) return []
      await wait(OKX_RETRY_DELAYS_MS[attempt])
    }
  }
  return []
}

/* Anchors backward pagination to the selected window so custom windows in
   the past fetch the data that actually covers them instead of walking back
   from "now". startMs keeps a warmup margin for rolling z-scores/percentiles. */
interface FetchWindow {
  startMs: number
  endMs: number
}

/* Paginate Rubik stat endpoints with begin/end. We move the end timestamp
   backward by the oldest row returned each page until we either cover the
   requested days, pass the window's left edge, exhaust upstream data, or hit
   MAX_PAGES. */
async function okxRubikPaginated(
  buildPath: (begin: string, end: string, limit: number) => string,
  daysWanted: number,
  stepDays = 1,
  window?: FetchWindow,
): Promise<string[][]> {
  const desired = Math.max(60, Math.ceil(daysWanted / stepDays) + 7)
  const collected = new Map<number, string[]>()
  let end = window ? Math.min(window.endMs, Date.now()) : Date.now()
  const stopMs = window ? window.startMs - 30 * stepDays * DAY_MS : 0

  for (let page = 0; page < OKX_MAX_PAGES; page++) {
    const begin = end - (OKX_RUBIK_PAGE_LIMIT + 2) * stepDays * DAY_MS
    const path = buildPath(String(Math.max(0, begin)), String(end), OKX_RUBIK_PAGE_LIMIT)
    const rows = await okxRubikSeries(path)
    if (rows.length === 0) break

    let oldestTs = Number.POSITIVE_INFINITY
    let added = 0
    for (const row of rows) {
      const ts = Number(row[0])
      if (!Number.isFinite(ts)) continue
      if (!collected.has(ts)) {
        collected.set(ts, row)
        added++
      }
      if (ts < oldestTs) oldestTs = ts
    }
    if (added === 0) break
    if (collected.size >= desired) break
    if (!Number.isFinite(oldestTs)) break
    if (oldestTs <= stopMs) break
    end = oldestTs - 1
  }

  return Array.from(collected.values()).sort((a, b) => Number(b[0]) - Number(a[0]))
}

/* Paginate market candles with after=oldestTs to walk backwards. The
   history-candles endpoint exposes older data than market/candles, with a
   per-request limit of 100. */
async function okxCandleRows(
  instId: string,
  daysWanted: number,
  bar: string,
  pointLimit: number,
  window?: FetchWindow & { stepMs: number },
  endpoint = "history-candles",
): Promise<string[][]> {
  const desired = Math.max(60, Math.min(OKX_MAX_PAGES * OKX_CANDLE_PAGE_LIMIT, pointLimit + Math.ceil(daysWanted / 7) + 7))
  const collected = new Map<number, string[]>()
  /* "after" returns rows strictly older than the given ts, so anchor one step
     past endMs to include the window's last candle. 250 warmup bars before
     startMs keep EMA/RSI/VWAP meaningful at the window's left edge. */
  let after: string | null = window && window.endMs < Date.now() ? String(window.endMs + window.stepMs) : null
  const stopMs = window ? window.startMs - 250 * window.stepMs : 0

  for (let page = 0; page < OKX_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      instId,
      bar,
      limit: String(OKX_CANDLE_PAGE_LIMIT),
    })
    if (after) params.set("after", after)
    const path = `/api/v5/market/${endpoint}?${params.toString()}`
    const rows = await okxRubikSeries(path)
    if (rows.length === 0) break

    let oldestTs = Number.POSITIVE_INFINITY
    let added = 0
    for (const row of rows) {
      const ts = Number(row[0])
      if (!Number.isFinite(ts)) continue
      if (!collected.has(ts)) {
        collected.set(ts, row)
        added++
      }
      if (ts < oldestTs) oldestTs = ts
    }
    if (added === 0) break
    if (collected.size >= desired) break
    if (!Number.isFinite(oldestTs)) break
    if (oldestTs <= stopMs) break
    after = String(oldestTs)
  }

  return Array.from(collected.values()).sort((a, b) => Number(b[0]) - Number(a[0]))
}

async function okxCandles(
  instId: string,
  daysWanted: number,
  bar: string,
  pointLimit: number,
  window?: FetchWindow & { stepMs: number },
): Promise<OkxCandlePoint[]> {
  const rows = await okxCandleRows(instId, daysWanted, bar, pointLimit, window)
  return rows
    .map((row) => {
      const timestamp = Number(row[0])
      const open = Number(row[1])
      const high = Number(row[2])
      const low = Number(row[3])
      const close = Number(row[4])
      const volume = Number(row[5])
      const quoteVolume = Number(row[7]) || volume * close
      const range = Math.max(high - low, Number.EPSILON)
      return {
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        quoteVolume,
        changePercent: open === 0 ? 0 : ((close - open) / open) * 100,
        upperWickPct: ((high - Math.max(open, close)) / range) * 100,
        lowerWickPct: ((Math.min(open, close) - low) / range) * 100,
      }
    })
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.close))
}

async function okxDailyKlines(instId: string, daysWanted: number, window?: FetchWindow): Promise<RawPoint[]> {
  return okxCandles(instId, daysWanted, "1D", Math.ceil(daysWanted) + 7, window ? { ...window, stepMs: DAY_MS } : undefined).then(
    (candles) => candles.map((candle) => ({ timestamp: candle.timestamp, value: candle.close })),
  )
}

/* OKX multi-venue index candles ({ccy}-USDT index) — the cross-venue fair
   price used to separate a local wick from market-wide repricing. */
async function okxIndexCloses(
  indexInstId: string,
  daysWanted: number,
  bar: string,
  pointLimit: number,
  window?: FetchWindow & { stepMs: number },
): Promise<RawPoint[]> {
  const rows = await okxCandleRows(indexInstId, daysWanted, bar, pointLimit, window, "history-index-candles")
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[4]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value) && p.value > 0)
}

async function okxOiHistory(
  instId: string,
  daysWanted: number,
  requestedPeriod?: OkxDerivativeHistoryPeriod | null,
  window?: FetchWindow,
): Promise<RawPoint[]> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted, requestedPeriod)
  const rows = await okxRubikPaginated(
    (begin, end, limit) =>
      `/api/v5/rubik/stat/contracts/open-interest-history?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
    daysWanted,
    stepDays,
    window,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[3]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxLongShort(
  ccy: string,
  daysWanted: number,
  requestedPeriod?: OkxDerivativeHistoryPeriod | null,
  window?: FetchWindow,
): Promise<RawPoint[]> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted, requestedPeriod)
  const rows = await okxRubikPaginated(
    (begin, end, limit) =>
      `/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
    daysWanted,
    stepDays,
    window,
  )
  return rows
    .map((row) => ({ timestamp: toDayKey(Number(row[0])), value: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxContractLongShort(
  instId: string,
  daysWanted: number,
  requestedPeriod?: OkxDerivativeHistoryPeriod | null,
  window?: FetchWindow,
): Promise<RawPoint[]> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted, requestedPeriod)
  const rows = await okxRubikPaginated(
    (begin, end, limit) =>
      `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
    daysWanted,
    stepDays,
    window,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxTopTraderPosition(
  instId: string,
  daysWanted: number,
  requestedPeriod?: OkxDerivativeHistoryPeriod | null,
  window?: FetchWindow,
): Promise<{
  account: RawPoint[]
  position: RawPoint[]
}> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted, requestedPeriod)
  const [accountRows, positionRows] = await Promise.all([
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
      stepDays,
      window,
    ),
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
      stepDays,
      window,
    ),
  ])
  return {
    account: accountRows
      .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value)),
    position: positionRows
      .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value)),
  }
}

async function okxTakerNet(
  ccy: string,
  daysWanted: number,
  requestedPeriod?: OkxDerivativeHistoryPeriod | null,
  window?: FetchWindow,
): Promise<{
  buy: RawPoint[]
  sell: RawPoint[]
  net: RawPoint[]
  cumulativeNet: RawPoint[]
}> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted, requestedPeriod)
  const [contractRows, spotRows] = await Promise.all([
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=CONTRACTS&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
      stepDays,
      window,
    ),
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SPOT&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
      stepDays,
      window,
    ),
  ])
  const merged = new Map<number, { sell: number; buy: number }>()
  for (const row of [...contractRows, ...spotRows]) {
    const t = Number(row[0])
    const s = Number(row[1])
    const b = Number(row[2])
    if (!Number.isFinite(t) || !Number.isFinite(s) || !Number.isFinite(b)) continue
    const entry = merged.get(t) ?? { sell: 0, buy: 0 }
    entry.sell += s
    entry.buy += b
    merged.set(t, entry)
  }
  const ordered = Array.from(merged.entries()).sort(([a], [b]) => a - b)
  let cum = 0
  const buy: RawPoint[] = []
  const sell: RawPoint[] = []
  const net: RawPoint[] = []
  const cumulative: RawPoint[] = []
  for (const [t, row] of ordered) {
    const s = row.sell
    const b = row.buy
    cum += b - s
    buy.push({ timestamp: t, value: b })
    sell.push({ timestamp: t, value: s })
    net.push({ timestamp: t, value: b - s })
    cumulative.push({ timestamp: t, value: cum })
  }
  return { buy, sell, net, cumulativeNet: cumulative }
}

/* Funding rate updates every 8h (3 per day), so total records needed scales
   with days. Paginate with after=oldestTs to walk backwards. */
async function okxFundingHistory(instId: string, daysWanted: number, window?: FetchWindow): Promise<RawPoint[]> {
  const desired = Math.max(180, Math.ceil(daysWanted) * 3 + 24)
  const collected = new Map<number, number>()
  let after: string | null = window && window.endMs < Date.now() ? String(window.endMs + 1) : null
  const stopMs = window ? window.startMs - 90 * DAY_MS : 0

  for (let page = 0; page < OKX_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      instId,
      limit: String(OKX_FUNDING_PAGE_LIMIT),
    })
    if (after) params.set("after", after)
    try {
      const res = await fetch(
        `${OKX}/api/v5/public/funding-rate-history?${params.toString()}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate } },
      )
      if (!res.ok) break
      const json = (await res.json()) as OkxResponse<{ fundingTime: string; fundingRate: string }>
      const rows = json.data ?? []
      if (rows.length === 0) break

      let oldestTs = Number.POSITIVE_INFINITY
      let added = 0
      for (const row of rows) {
        const ts = Number(row.fundingTime)
        const v = Number(row.fundingRate) * 100
        if (!Number.isFinite(ts) || !Number.isFinite(v)) continue
        if (!collected.has(ts)) {
          collected.set(ts, v)
          added++
        }
        if (ts < oldestTs) oldestTs = ts
      }
      if (added === 0) break
      if (collected.size >= desired) break
      if (!Number.isFinite(oldestTs)) break
      if (oldestTs <= stopMs) break
      after = String(oldestTs)
    } catch {
      break
    }
  }

  return Array.from(collected.entries())
    .map(([ts, v]) => ({ timestamp: ts, value: v }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

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

/* OKX USDT-margined swap face value: 1 contract = ctVal base-currency units.
   Used to compute notional USD = sz × ctVal × bkPx. */
const SWAP_CT_VAL: Record<string, number> = {
  "BTC-USDT-SWAP": 0.01,
  "ETH-USDT-SWAP": 0.01,
  "SOL-USDT-SWAP": 0.1,
  "XRP-USDT-SWAP": 100,
  "BNB-USDT-SWAP": 0.01,
  "DOGE-USDT-SWAP": 1000,
  "ADA-USDT-SWAP": 100,
  "AVAX-USDT-SWAP": 0.1,
}

/* OKX keeps ~90 days of liquidation order history. Paginate until cutoff
   or OKX stops returning data. */
async function okxLiquidationDaily(
  instId: string,
  daysWanted: number,
  window?: FetchWindow,
): Promise<{ long: RawPoint[]; short: RawPoint[] }> {
  const maxDays = Math.min(daysWanted, 90)
  const cutoffMs = window
    ? Math.max(window.startMs - 30 * DAY_MS, Date.now() - 90 * DAY_MS)
    : Date.now() - maxDays * DAY_MS
  const ctVal = SWAP_CT_VAL[instId] ?? 0.01
  const longByDay = new Map<number, number>()
  const shortByDay = new Map<number, number>()
  let after: string | null = window && window.endMs < Date.now() ? String(window.endMs + 1) : null

  for (let page = 0; page < 30; page++) {
    /* OKX rejects instId-only queries (code 50015): this endpoint requires
       the underlying (uly) instead. */
    const params = new URLSearchParams({
      instType: "SWAP",
      uly: instId.replace(/-SWAP$/, ""),
      state: "filled",
      limit: "100",
    })
    if (after) params.set("after", after)

    let groups: OkxLiquidationGroup[] = []
    try {
      const res = await fetch(
        `${OKX}/api/v5/public/liquidation-orders?${params.toString()}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate } },
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
    let added = 0

    for (const group of groups) {
      for (const detail of group.details ?? []) {
        const ts = Number(detail.ts)
        const bkPx = Number(detail.bkPx)
        const sz = Number(detail.sz)
        if (!Number.isFinite(ts) || !Number.isFinite(bkPx) || !Number.isFinite(sz)) continue

        const notionalUsd = sz * ctVal * bkPx
        const dayKey = toDayKey(ts)
        if (detail.posSide === "long") {
          longByDay.set(dayKey, (longByDay.get(dayKey) ?? 0) + notionalUsd)
        } else {
          shortByDay.set(dayKey, (shortByDay.get(dayKey) ?? 0) + notionalUsd)
        }
        if (ts < oldestTs) oldestTs = ts
        added++
      }
    }

    if (added === 0) break
    if (oldestTs <= cutoffMs) break
    if (!Number.isFinite(oldestTs)) break
    after = String(oldestTs)
  }

  return {
    long: Array.from(longByDay.entries()).map(([ts, v]) => ({ timestamp: ts, value: v })),
    short: Array.from(shortByDay.entries()).map(([ts, v]) => ({ timestamp: ts, value: v })),
  }
}

/* Deribit BTC DVOL daily close — single-asset implied-volatility index. */
async function deribitDvolDaily(rangeDays: number, window?: FetchWindow): Promise<RawPoint[]> {
  const end = window ? Math.min(window.endMs, Date.now()) : Date.now()
  const start = window ? window.startMs - 30 * DAY_MS : end - (rangeDays + 30) * DAY_MS
  const payload = await fetchJson<{
    result?: { data?: [number, number, number, number, number][] }
  }>(
    `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=1D&start_timestamp=${start}&end_timestamp=${end}`,
    { revalidate, timeoutMs: 15_000 },
  )
  return (payload?.result?.data ?? [])
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[4]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function yahooPoints(symbol: string, range: TimeRangeOption): Promise<RawPoint[]> {
  const res = await fetchYahooSeries(symbol, range)
  return (res?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value }))
}

async function blockchainSeries(chart: string, timespan: string): Promise<RawPoint[]> {
  const rows = await fetchBlockchainInfoSeries(chart, timespan)
  return rows.map((p) => ({ timestamp: p.timestamp, value: p.value }))
}

interface StoredMarketSnapshot {
  timestamp: string
  spread_pct: number | null
  bid_depth_01_usd: number | null
  ask_depth_01_usd: number | null
  bid_depth_05_usd: number | null
  ask_depth_05_usd: number | null
  bid_depth_1_usd: number | null
  ask_depth_1_usd: number | null
  orderbook_imbalance_pct: number | null
}

function pointsFromStoredSnapshots(
  rows: StoredMarketSnapshot[],
  field: keyof Omit<StoredMarketSnapshot, "timestamp">,
): RawPoint[] {
  return rows
    .map((row) => {
      const value = row[field]
      return {
        timestamp: new Date(row.timestamp).getTime(),
        value: typeof value === "number" ? value : Number.NaN,
      }
    })
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
}

async function fetchStoredMarketSnapshots({
  instId,
  startMs,
  endMs,
}: {
  instId: string
  startMs: number
  endMs: number
}): Promise<StoredMarketSnapshot[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from("crypto_market_snapshots")
    .select(
      "timestamp,spread_pct,bid_depth_01_usd,ask_depth_01_usd,bid_depth_05_usd,ask_depth_05_usd,bid_depth_1_usd,ask_depth_1_usd,orderbook_imbalance_pct",
    )
    .eq("inst_id", instId)
    .gte("timestamp", new Date(startMs).toISOString())
    .lte("timestamp", new Date(endMs).toISOString())
    .order("timestamp", { ascending: true })
    .limit(MAX_HISTORY_POINTS)

  if (error || !data) return []
  return data as StoredMarketSnapshot[]
}

const BTC_PRICE_KEYS = [
  "btcPrice",
  "vwap",
  "vwapDistancePct",
  "vwapZScore",
  "rsi14",
  "atr14",
  "atrPct",
  "ema20",
  "ema50",
  "ema200",
  "ema20Slope",
  "ema50Slope",
  "adx14",
  "plusDi",
  "minusDi",
  "realizedVol",
  "rvPercentile30d",
  "rvPercentile90d",
  "trendRegime",
  "volRegime",
  "btcMomentum7d",
  "btcMomentum30d",
  "btcMomentum90d",
  "btcRealizedVol30d",
  "btcDrawdown",
  "btcReturnZ",
] as const

const BTC_SWAP_CANDLE_KEYS = [
  ...BTC_PRICE_KEYS,
  "ret24hNorm",
  "ret72hNorm",
  "ret7dNorm",
  "donchianUpper20",
  "donchianLower20",
  "oiVolumeRatio",
  "perpIndexPremium",
  "btcVolumeUsd",
  "btcVolumeZ",
  "upperWick",
  "lowerWick",
  "basis",
  "signalBuyScore",
  "signalSellScore",
  "signalRiskScore",
  "signalDirection",
  "manipLeveragePressure",
  "manipPriceOiDivergence",
  "manipBasisDislocationZ",
  "manipCvdPriceDivergence",
  "manipWickAsymmetryPct",
  "manipVolumeImpactZ",
] as const

const OI_KEYS = [
  "oi",
  "oiChangePct",
  "oiChange1h",
  "oiChange4h",
  "oiPct30d",
  "oiPct90d",
  "oiZScore",
  "oiReturnZ",
  "oiVolumeRatio",
  "liqOverOi",
  "signalBuyScore",
  "signalSellScore",
  "signalRiskScore",
  "signalDirection",
  "manipLeveragePressure",
  "manipPriceOiDivergence",
] as const
const FUNDING_KEYS = [
  "funding",
  "fundingPct30d",
  "fundingPct90d",
  "fundingZScore",
  "signalBuyScore",
  "signalSellScore",
  "signalRiskScore",
  "signalDirection",
  "manipFundingSqueezeZ",
] as const
const LONG_SHORT_KEYS = [
  "ls",
  "signalBuyScore",
  "signalSellScore",
  "signalRiskScore",
  "signalDirection",
] as const
const LIQ_KEYS = [
  "liqLong",
  "liqShort",
  "liquidationZScore",
  "liquidationImbalance",
  "liqOverOi",
  "manipLiquidationImbalancePct",
  "manipLiquidationIntensityZ",
] as const
const INDEX_PRICE_KEYS = ["indexPrice", "perpIndexPremium"] as const
const MINING_COST_KEYS = ["miningElectricityCost", "miningComprehensiveCost"] as const
const TOP_TRADER_KEYS = ["topTraderAccount", "topTraderPosition"] as const
const SMART_MONEY_KEYS = [
  "buyVolume",
  "sellVolume",
  "volumeDelta",
  "takerImbalancePct",
  "cvd",
  "smartBuy",
  "smartSell",
  "smartNet",
  "smartCum",
  "manipTakerImbalancePct",
  "manipCvdPriceDivergence",
] as const
const BASIS_KEYS = ["basis", "manipBasisDislocationZ"] as const
const ORDERBOOK_KEYS = [
  "spread",
  "bidDepth01",
  "askDepth01",
  "bidDepth05",
  "askDepth05",
  "bidDepth1",
  "askDepth1",
  "orderbookImbalance",
] as const
const COMPOSITE_SIGNAL_KEYS = [
  "crowdingScore",
  "extensionScore",
  "trendScore",
  "cascadeScore",
  "cascadeInProgress",
  "exhaustionScore",
] as const

const MANIPULATION_KEYS = [
  "manipLeveragePressure",
  "manipPriceOiDivergence",
  "manipFundingSqueezeZ",
  "manipBasisDislocationZ",
  "manipTakerImbalancePct",
  "manipCvdPriceDivergence",
  "manipLiquidationImbalancePct",
  "manipLiquidationIntensityZ",
  "manipWickAsymmetryPct",
  "manipVolumeImpactZ",
] as const

const STRICT_RANGE_COVERAGE_KEYS = new Set<string>([
  "oi",
  "oiChangePct",
  "oiReturnZ",
  "ls",
  "contractLs",
  ...TOP_TRADER_KEYS,
  ...MANIPULATION_KEYS,
  ...ORDERBOOK_KEYS,
])

const SELECTED_INSTRUMENT_LABEL_KEYS = new Set<string>([
  ...BTC_SWAP_CANDLE_KEYS,
  ...OI_KEYS,
  ...FUNDING_KEYS,
  ...LONG_SHORT_KEYS,
  ...LIQ_KEYS,
  "contractLs",
  ...TOP_TRADER_KEYS,
  ...SMART_MONEY_KEYS,
  ...COMPOSITE_SIGNAL_KEYS,
  ...INDEX_PRICE_KEYS,
])

const CROSS_SECTION_PRICE_KEY_BY_CCY: Readonly<Record<string, string>> = {
  ETH: "ethPrice",
  SOL: "solPrice",
  XRP: "xrpPrice",
  BNB: "bnbPrice",
  DOGE: "dogePrice",
}

function getPositiveInteger(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getNonNegativeInteger(value: string | null): number {
  if (!value) return 0
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

function hasRequestedKey(requestedWithSignals: Set<string>, keys: readonly string[]): boolean {
  return keys.some((key) => requestedWithSignals.has(key))
}

function getAlignmentMaxStaleMs(key: string, group: CryptoIndicatorGroup, intervalMs: number): number {
  if (group === "orderbook") return Math.max(intervalMs * 2, 10 * 60_000)
  if (key === "funding" || key.startsWith("funding")) return Math.max(intervalMs * 2, 12 * 60 * 60_000)
  return Math.max(intervalMs * 2, 7 * DAY_MS)
}

function getFreshness(group: CryptoIndicatorGroup): "live" | "collected" | "historical" {
  return group === "orderbook" ? "collected" : "historical"
}

/* ----------------------------- handler ----------------------------- */

export async function GET(request: Request) {
  const url = new URL(request.url)
  const selection = resolveHistorySelection(url)
  /* Range-based sources (Yahoo, blockchain.info, F&G, DefiLlama) always fetch
     back from "now", so a custom window needs the smallest preset range whose
     left edge still covers the window start — not the window's length. */
  const customCoverageRange = CUSTOM_COVERAGE_RANGES.find(
    (id) => id === "max" || getRangeStartMs(id) <= selection.startMs,
  ) ?? "max"
  const range = getTimeRange(selection.custom ? customCoverageRange : selection.rangeId)
  const miningCostParameters = resolveMiningCostParameters(url.searchParams)
  const days = selection.days
  const ccy = (url.searchParams.get("ccy") ?? "BTC").toUpperCase()
  const isBtc = ccy === "BTC"
  const instId = `${ccy}-USDT-SWAP`
  const blockchainSpan = getBlockchainTimespan(range.id)
  /* Total days requested from OKX endpoints. The per-call helpers paginate
     internally (begin/end for Rubik stats, after for candles/funding) up to
     OKX_MAX_PAGES, so this is no longer bounded by any single-request cap. */
  const intradayBufferDays = selection.interval.id === "1m" || selection.interval.id === "5m" ? 1 : 2
  const okxDays =
    selection.interval.id === "1d" || selection.interval.id === "1w"
      ? Math.max(60, Math.ceil(days) + 7)
      : Math.max(1, Math.ceil(days) + intradayBufferDays)
  const okxPointLimit = Math.min(OKX_MAX_PAGES * OKX_CANDLE_PAGE_LIMIT, Math.ceil((selection.endMs - selection.startMs) / selection.interval.stepMs) + 250)
  const rubikPeriod = selection.interval.okxBar === "1W" ? "1W" : selection.interval.okxBar === "1D" ? "1D" : selection.interval.okxBar
  const supportedRubikPeriod: OkxDerivativeHistoryPeriod | null =
    rubikPeriod === "5m" || rubikPeriod === "15m" || rubikPeriod === "30m" || rubikPeriod === "1H" || rubikPeriod === "4H" || rubikPeriod === "1D" || rubikPeriod === "1W"
      ? rubikPeriod
      : null

  const now = selection.endMs
  const fetchWindow: FetchWindow = { startMs: selection.startMs, endMs: selection.endMs }
  const candleWindow = { ...fetchWindow, stepMs: selection.interval.stepMs }
  let timeline = compactTimeline(buildTimeline(selection.startMs, selection.endMs, selection.interval.stepMs))
  const timelineStart = timeline[0] ?? now
  const okxInstrumentHistoryCoversRange = timelineStart >= OKX_INSTRUMENT_HISTORY_EARLIEST_MS
  const okxTopTraderHistoryCoversRange = timelineStart >= OKX_TOP_TRADER_HISTORY_EARLIEST_MS
  const okxMarketLongShortCoversRange = days <= OKX_MARKET_LONG_SHORT_MAX_DAYS
  const indicatorLimit = getPositiveInteger(url.searchParams.get("limit"))
  const indicatorOffset = getNonNegativeInteger(url.searchParams.get("offset"))
  const configuredIndicators = getEnabledCryptoIndicators()
  const offsetIndicators = configuredIndicators.slice(indicatorOffset)
  const requestedIndicators =
    indicatorLimit === null ? offsetIndicators : offsetIndicators.slice(0, indicatorLimit)
  const requestedKeys = new Set(requestedIndicators.map((indicator) => indicator.key))
  const requestedWithSignals = new Set<string>(requestedKeys)
  if (hasRequestedKey(requestedWithSignals, COMPOSITE_SIGNAL_KEYS)) {
    for (const key of [...BTC_PRICE_KEYS, ...OI_KEYS, ...FUNDING_KEYS, ...LIQ_KEYS, ...SMART_MONEY_KEYS, ...ORDERBOOK_KEYS]) {
      requestedWithSignals.add(key)
    }
  }

  /* Staged clients request the top ordered slice first; skip lower-priority
     upstream calls until the background full-history request asks for them. */
  const [
    btcPriceA, // blockchain.info (BTC only, longer history)
    btcSwapCandles, // OKX daily swap candles (fallback / derivatives metrics)
    btcSpotCandles,
    indexCloses, // OKX multi-venue index closes (cross-venue reference)
    ethPrice,
    solPrice,
    xrpPrice,
    bnbPrice,
    dogePrice,
    oi,
    funding,
    lsRatio,
    contractLsRatio,
    topTrader,
    taker,
    liq,
    fng,
    stablecoin,
    defiTvl,
    mempoolHashRate,
    hashRate,
    difficulty,
    nTxs,
    activeAddrs,
    mempool,
    txFeesUsd,
    avgBlockSize,
    dvol,
    dxy,
    us10y,
    us2y,
    vix,
    sp500,
    nasdaq,
    russell2k,
    gold,
    silver,
    copper,
    oil,
    natgas,
    nikkei,
    hangseng,
    storedSnapshots,
  ] = await Promise.all([
    isBtc && hasRequestedKey(requestedWithSignals, BTC_PRICE_KEYS)
      ? fetchBtcUsdDailyFromBlockchain(blockchainSpan, revalidate).then((r) =>
          (r?.points ?? []).map((p) => ({ timestamp: p.timestamp, value: p.close })),
        )
      : [],
    hasRequestedKey(requestedWithSignals, BTC_SWAP_CANDLE_KEYS)
      ? okxCandles(instId, okxDays, selection.interval.okxBar, okxPointLimit, candleWindow)
      : [],
    hasRequestedKey(requestedWithSignals, BASIS_KEYS)
      ? okxCandles(`${ccy}-USDT`, okxDays, selection.interval.okxBar, okxPointLimit, candleWindow)
      : [],
    hasRequestedKey(requestedWithSignals, INDEX_PRICE_KEYS)
      ? okxIndexCloses(`${ccy}-USDT`, okxDays, selection.interval.okxBar, okxPointLimit, candleWindow)
      : [],
    requestedWithSignals.has("ethPrice") ? okxDailyKlines("ETH-USDT", okxDays, fetchWindow) : [],
    requestedWithSignals.has("solPrice") ? okxDailyKlines("SOL-USDT", okxDays, fetchWindow) : [],
    requestedWithSignals.has("xrpPrice") ? okxDailyKlines("XRP-USDT", okxDays, fetchWindow) : [],
    requestedWithSignals.has("bnbPrice") ? okxDailyKlines("BNB-USDT", okxDays, fetchWindow) : [],
    requestedWithSignals.has("dogePrice") ? okxDailyKlines("DOGE-USDT", okxDays, fetchWindow) : [],
    hasRequestedKey(requestedWithSignals, OI_KEYS) && okxInstrumentHistoryCoversRange
      ? okxOiHistory(instId, okxDays, supportedRubikPeriod, fetchWindow)
      : [],
    hasRequestedKey(requestedWithSignals, FUNDING_KEYS) ? okxFundingHistory(instId, okxDays, fetchWindow) : [],
    hasRequestedKey(requestedWithSignals, LONG_SHORT_KEYS) && okxMarketLongShortCoversRange
      ? okxLongShort(ccy, okxDays, supportedRubikPeriod, fetchWindow)
      : [],
    requestedWithSignals.has("contractLs") && okxInstrumentHistoryCoversRange
      ? okxContractLongShort(instId, okxDays, supportedRubikPeriod, fetchWindow)
      : [],
    hasRequestedKey(requestedWithSignals, TOP_TRADER_KEYS) && okxTopTraderHistoryCoversRange
      ? okxTopTraderPosition(instId, okxDays, supportedRubikPeriod, fetchWindow)
      : { account: [], position: [] },
    hasRequestedKey(requestedWithSignals, SMART_MONEY_KEYS)
      ? okxTakerNet(ccy, okxDays, supportedRubikPeriod, fetchWindow)
      : { buy: [], sell: [], net: [], cumulativeNet: [] },
    hasRequestedKey(requestedWithSignals, LIQ_KEYS)
      ? okxLiquidationDaily(instId, okxDays, fetchWindow)
      : { long: [], short: [] },
    requestedWithSignals.has("fng")
      ? fetchFearGreedHistory(range, revalidate).then((r) =>
          (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
        )
      : [],
    requestedWithSignals.has("stablecoinMcap")
      ? fetchStablecoinMarketCap(range, revalidate).then((r) =>
          (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
        )
      : [],
    requestedWithSignals.has("defiTvl")
      ? fetchDefiTvl(range, revalidate).then((r) =>
          (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
        )
      : [],
    hasRequestedKey(requestedWithSignals, MINING_COST_KEYS) ? fetchMempoolHashrateHistory(revalidate) : [],
    requestedWithSignals.has("hashRate") || hasRequestedKey(requestedWithSignals, MINING_COST_KEYS)
      ? blockchainSeries("hash-rate", blockchainSpan)
      : [],
    requestedWithSignals.has("difficulty") ? blockchainSeries("difficulty", blockchainSpan) : [],
    requestedWithSignals.has("nTxs") ? blockchainSeries("n-transactions", blockchainSpan) : [],
    requestedWithSignals.has("activeAddrs") ? blockchainSeries("n-unique-addresses", blockchainSpan) : [],
    requestedWithSignals.has("mempool") ? blockchainSeries("mempool-size", blockchainSpan) : [],
    requestedWithSignals.has("txFeesUsd") ? blockchainSeries("transaction-fees-usd", blockchainSpan) : [],
    requestedWithSignals.has("avgBlockSize") ? blockchainSeries("avg-block-size", blockchainSpan) : [],
    requestedWithSignals.has("dvol") ? deribitDvolDaily(days, fetchWindow) : [],
    requestedWithSignals.has("dxy") ? yahooPoints("DX-Y.NYB", range) : [],
    requestedWithSignals.has("us10y") ? yahooPoints("^TNX", range) : [], // US 10Y yield
    requestedWithSignals.has("us2y") ? yahooPoints("^IRX", range) : [], // Short rate proxy (13W)
    requestedWithSignals.has("vix") ? yahooPoints("^VIX", range) : [],
    requestedWithSignals.has("sp500") ? yahooPoints("^GSPC", range) : [],
    requestedWithSignals.has("nasdaq") ? yahooPoints("^IXIC", range) : [],
    requestedWithSignals.has("russell") ? yahooPoints("^RUT", range) : [],
    requestedWithSignals.has("gold") ? yahooPoints("GC=F", range) : [],
    requestedWithSignals.has("silver") ? yahooPoints("SI=F", range) : [],
    requestedWithSignals.has("copper") ? yahooPoints("HG=F", range) : [],
    requestedWithSignals.has("oil") ? yahooPoints("CL=F", range) : [],
    requestedWithSignals.has("natgas") ? yahooPoints("NG=F", range) : [],
    requestedWithSignals.has("nikkei") ? yahooPoints("^N225", range) : [],
    requestedWithSignals.has("hangseng") ? yahooPoints("^HSI", range) : [],
    hasRequestedKey(requestedWithSignals, ORDERBOOK_KEYS)
      ? fetchStoredMarketSnapshots({ instId, startMs: selection.startMs, endMs: selection.endMs })
      : [],
  ])

  const btcPriceB = toRawPoints(btcSwapCandles, "close")
  const priceCandidates = isBtc && (selection.interval.id === "1d" || selection.interval.id === "1w")
    ? [btcPriceA, btcPriceB]
    : [btcPriceB, btcPriceA]
  let btcPrice = chooseCompleteCandidate(priceCandidates, timeline)
  if (!selection.custom && range.id === "max" && btcPrice.length > 0) {
    timeline = compactTimeline(buildTimeline(Math.min(...btcPrice.map((point) => point.timestamp)), now, selection.interval.stepMs))
    btcPrice = chooseCompleteCandidate(priceCandidates, timeline)
  }

  /* Prefer mempool.space for production-cost curves because it is the same
     hashrate source as /api/crypto/mining-cost; fall back to Blockchain.com
     when mempool is unavailable. */
  const miningCostPoints =
    mempoolHashRate.length > 0
      ? mempoolHashRate.map((row) =>
          computeMiningCostFromHashrateHps({
            time: row.timestamp,
            hashrateHps: row.hashrateHps,
            marketPriceUsd: null,
            parameters: miningCostParameters,
          }),
        )
      : hashRate.map((row) =>
          computeMiningCostFromHashrateThPerSec({
            time: row.timestamp,
            hashrateThPerSec: row.value,
            marketPriceUsd: null,
            parameters: miningCostParameters,
          }),
        )
  const miningElectricityCost: RawPoint[] = miningCostPoints.map((point) => ({
    timestamp: point.time,
    value: point.electricityUsdPerBtc,
  }))
  const miningComprehensiveCost: RawPoint[] = miningCostPoints.map((point) => ({
    timestamp: point.time,
    value: point.comprehensiveUsdPerBtc,
  }))

  /* Scale to chart-friendly units. Storing the divisor next to the series
     keeps the i18n label honest (e.g. "Hashrate (EH/s)" — the user sees the
     unit baked into the legend instead of guessing). */
  const hashRateEH = scale(hashRate, 1e6) // TH/s → EH/s
  const difficultyT = scale(difficulty, 1e12) // raw → T
  const mempoolMB = scale(mempool, 1e6) // bytes → MB
  const avgBlockSizeMB = scale(avgBlockSize, 1) // already MB
  const btcVolumeUsd = toRawPoints(btcSwapCandles, "quoteVolume")
  const btcVolumeZ = rollingValueZScore(btcVolumeUsd, 30)
  const btcUpperWick = toRawPoints(btcSwapCandles, "upperWickPct")
  const btcLowerWick = toRawPoints(btcSwapCandles, "lowerWickPct")
  const btcReturnZ = rollingReturnZScore(btcPrice, 30)
  const btcMomentum7d = rollingReturnPct(btcPrice, 7)
  const btcMomentum30d = rollingReturnPct(btcPrice, 30)
  const btcMomentum90d = rollingReturnPct(btcPrice, 90)
  const btcRealizedVol30d = rollingRealizedVolatilityPct(btcPrice, 30)
  const btcDrawdown = drawdownPct(btcPrice)
  const oiChangePct = dailyChangePct(oi)
  const oiReturnZ = rollingReturnZScore(oi, 30)
  const quantFeatures = computeQuantFeatures(btcSwapCandles, selection.interval.approxBarsPerDay)
  const derivativeFeatures = computeDerivativeFeatures({
    funding,
    oi,
    longLiquidations: liq.long,
    shortLiquidations: liq.short,
  })
  const buyVolume = taker.buy
  const sellVolume = taker.sell
  const volumeDelta = taker.net
  const cvd = taker.cumulativeNet
  const takerSellByTs = new Map(taker.sell.map((point) => [point.timestamp, point.value]))
  const takerImbalancePct: RawPoint[] = taker.buy
    .map((point) => {
      const sell = takerSellByTs.get(point.timestamp) ?? 0
      const total = point.value + sell
      if (total <= 0) return null
      return { timestamp: point.timestamp, value: ((point.value - sell) / total) * 100 }
    })
    .filter((point): point is RawPoint => point !== null)
  const orderBookSpread = pointsFromStoredSnapshots(storedSnapshots, "spread_pct")
  const orderBookBidDepth01 = pointsFromStoredSnapshots(storedSnapshots, "bid_depth_01_usd")
  const orderBookAskDepth01 = pointsFromStoredSnapshots(storedSnapshots, "ask_depth_01_usd")
  const orderBookBidDepth05 = pointsFromStoredSnapshots(storedSnapshots, "bid_depth_05_usd")
  const orderBookAskDepth05 = pointsFromStoredSnapshots(storedSnapshots, "ask_depth_05_usd")
  const orderBookBidDepth1 = pointsFromStoredSnapshots(storedSnapshots, "bid_depth_1_usd")
  const orderBookAskDepth1 = pointsFromStoredSnapshots(storedSnapshots, "ask_depth_1_usd")
  const orderBookImbalance = pointsFromStoredSnapshots(storedSnapshots, "orderbook_imbalance_pct")
  const basis = buildBasis(btcSwapCandles, btcSpotCandles)
  const indexCloseByTs = new Map(indexCloses.map((point) => [point.timestamp, point.value]))
  const perpIndexPremium: RawPoint[] = btcSwapCandles
    .map((candle) => {
      const indexClose = indexCloseByTs.get(candle.timestamp)
      if (!indexClose) return null
      return { timestamp: candle.timestamp, value: ((candle.close - indexClose) / indexClose) * 100 }
    })
    .filter((point): point is RawPoint => point !== null && Number.isFinite(point.value))
  const oiVolumeRatio = computeOiVolumeRatio(oi, btcSwapCandles, selection.interval.approxBarsPerDay)
  const signalScores = buildDailySignalScores({
    candles: btcSwapCandles,
    oi,
    funding,
    lsRatio,
  })
  const manipulationMetrics = computeMarketManipulationMetrics({
    price: btcPrice,
    openInterest: oi,
    funding,
    basis,
    takerBuy: taker.buy,
    takerSell: taker.sell,
    takerCumulativeNet: taker.cumulativeNet,
    longLiquidations: liq.long,
    shortLiquidations: liq.short,
    upperWick: btcUpperWick,
    lowerWick: btcLowerWick,
    volume: btcVolumeUsd,
  })
  const compositeSignals = computeCompositeSignals({
    candles: btcSwapCandles,
    barsPerDay: selection.interval.approxBarsPerDay,
    quant: quantFeatures,
    fundingPct90d: derivativeFeatures.fundingPct90d,
    oiPct90d: derivativeFeatures.oiPct90d,
    oiChange4h: derivativeFeatures.oiChange4h,
    liquidationZScore: derivativeFeatures.liquidationZScore,
    liquidationImbalance: derivativeFeatures.liquidationImbalance,
    buyVolume,
    sellVolume,
    cvd,
    bidDepth05: orderBookBidDepth05,
    askDepth05: orderBookAskDepth05,
    spread: orderBookSpread,
  })

  const rawSeriesByKey = new Map<string, RawPoint[]>([
    ["crowdingScore", compositeSignals.crowdingScore],
    ["extensionScore", compositeSignals.extensionScore],
    ["trendScore", compositeSignals.trendScore],
    ["cascadeScore", compositeSignals.cascadeScore],
    ["cascadeInProgress", compositeSignals.cascadeInProgress],
    ["exhaustionScore", compositeSignals.exhaustionScore],
    ["btcPrice", btcPrice],
    ["return", quantFeatures.returns],
    ["vwap", quantFeatures.vwap],
    ["vwapDistancePct", quantFeatures.vwapDistancePct],
    ["vwapZScore", quantFeatures.vwapZScore],
    ["rsi14", quantFeatures.rsi14],
    ["atr14", quantFeatures.atr14],
    ["atrPct", quantFeatures.atrPct],
    ["ema20", quantFeatures.ema20],
    ["ema50", quantFeatures.ema50],
    ["ema200", quantFeatures.ema200],
    ["ema20Slope", quantFeatures.ema20Slope],
    ["ema50Slope", quantFeatures.ema50Slope],
    ["adx14", quantFeatures.adx14],
    ["plusDi", quantFeatures.plusDi],
    ["minusDi", quantFeatures.minusDi],
    ["realizedVol", quantFeatures.realizedVol],
    ["rvPercentile30d", quantFeatures.rvPercentile30d],
    ["rvPercentile90d", quantFeatures.rvPercentile90d],
    ["trendRegime", quantFeatures.trendRegime],
    ["volRegime", quantFeatures.volRegime],
    ["ret24hNorm", quantFeatures.ret24hNorm],
    ["ret72hNorm", quantFeatures.ret72hNorm],
    ["ret7dNorm", quantFeatures.ret7dNorm],
    ["donchianUpper20", quantFeatures.donchianUpper20],
    ["donchianLower20", quantFeatures.donchianLower20],
    ["indexPrice", indexCloses],
    ["perpIndexPremium", perpIndexPremium],
    ["btcMomentum7d", btcMomentum7d],
    ["btcMomentum30d", btcMomentum30d],
    ["btcMomentum90d", btcMomentum90d],
    ["btcRealizedVol30d", btcRealizedVol30d],
    ["btcDrawdown", btcDrawdown],
    ["miningElectricityCost", miningElectricityCost],
    ["miningComprehensiveCost", miningComprehensiveCost],
    ["ethPrice", ethPrice],
    ["solPrice", solPrice],
    ["xrpPrice", xrpPrice],
    ["bnbPrice", bnbPrice],
    ["dogePrice", dogePrice],
    ["btcReturnZ", btcReturnZ],
    ["btcVolumeZ", btcVolumeZ],
    ["btcVolumeUsd", btcVolumeUsd],
    ["basis", basis],
    ["upperWick", btcUpperWick],
    ["lowerWick", btcLowerWick],
    ["signalBuyScore", signalScores.buyScore],
    ["signalSellScore", signalScores.sellScore],
    ["signalRiskScore", signalScores.riskScore],
    ["signalDirection", signalScores.direction],
    ["stablecoinMcap", stablecoin],
    ["defiTvl", defiTvl],
    ["oi", oi],
    ["oiChangePct", oiChangePct],
    ["oiChange1h", derivativeFeatures.oiChange1h],
    ["oiChange4h", derivativeFeatures.oiChange4h],
    ["oiPct30d", derivativeFeatures.oiPct30d],
    ["oiPct90d", derivativeFeatures.oiPct90d],
    ["oiZScore", derivativeFeatures.oiZScore],
    ["oiReturnZ", oiReturnZ],
    ["oiVolumeRatio", oiVolumeRatio],
    ["funding", funding],
    ["fundingPct30d", derivativeFeatures.fundingPct30d],
    ["fundingPct90d", derivativeFeatures.fundingPct90d],
    ["fundingZScore", derivativeFeatures.fundingZScore],
    ["ls", lsRatio],
    ["contractLs", contractLsRatio],
    ["topTraderAccount", topTrader.account],
    ["topTraderPosition", topTrader.position],
    ["buyVolume", buyVolume],
    ["sellVolume", sellVolume],
    ["volumeDelta", volumeDelta],
    ["takerImbalancePct", takerImbalancePct],
    ["cvd", cvd],
    ["smartBuy", taker.buy],
    ["smartSell", taker.sell],
    ["smartNet", taker.net],
    ["smartCum", taker.cumulativeNet],
    ["liqLong", liq.long],
    ["liqShort", liq.short],
    ["liquidationZScore", derivativeFeatures.liquidationZScore],
    ["liquidationImbalance", derivativeFeatures.liquidationImbalance],
    ["liqOverOi", derivativeFeatures.liqOverOi],
    ["spread", orderBookSpread],
    ["bidDepth01", orderBookBidDepth01],
    ["askDepth01", orderBookAskDepth01],
    ["bidDepth05", orderBookBidDepth05],
    ["askDepth05", orderBookAskDepth05],
    ["bidDepth1", orderBookBidDepth1],
    ["askDepth1", orderBookAskDepth1],
    ["orderbookImbalance", orderBookImbalance],
    ["manipLeveragePressure", manipulationMetrics.manipLeveragePressure],
    ["manipPriceOiDivergence", manipulationMetrics.manipPriceOiDivergence],
    ["manipFundingSqueezeZ", manipulationMetrics.manipFundingSqueezeZ],
    ["manipBasisDislocationZ", manipulationMetrics.manipBasisDislocationZ],
    ["manipTakerImbalancePct", manipulationMetrics.manipTakerImbalancePct],
    ["manipCvdPriceDivergence", manipulationMetrics.manipCvdPriceDivergence],
    ["manipLiquidationImbalancePct", manipulationMetrics.manipLiquidationImbalancePct],
    ["manipLiquidationIntensityZ", manipulationMetrics.manipLiquidationIntensityZ],
    ["manipWickAsymmetryPct", manipulationMetrics.manipWickAsymmetryPct],
    ["manipVolumeImpactZ", manipulationMetrics.manipVolumeImpactZ],
    ["fng", fng],
    ["dvol", dvol],
    ["hashRate", hashRateEH],
    ["difficulty", difficultyT],
    ["nTxs", nTxs],
    ["activeAddrs", activeAddrs],
    ["mempool", mempoolMB],
    ["txFeesUsd", txFeesUsd],
    ["avgBlockSize", avgBlockSizeMB],
    ["dxy", dxy],
    ["us10y", us10y],
    ["us2y", us2y],
    ["vix", vix],
    ["sp500", sp500],
    ["nasdaq", nasdaq],
    ["russell", russell2k],
    ["gold", gold],
    ["silver", silver],
    ["copper", copper],
    ["oil", oil],
    ["natgas", natgas],
    ["nikkei", nikkei],
    ["hangseng", hangseng],
  ])

  const selectedCrossSectionPriceKey = CROSS_SECTION_PRICE_KEY_BY_CCY[ccy]
  const series: SeriesSpec[] = requestedIndicators
    .flatMap((config, configIndex) => {
      const absoluteIndex = indicatorOffset + configIndex
      if (config.key === selectedCrossSectionPriceKey) return []
      const safe = dropOutOfRange(rawSeriesByKey.get(config.key) ?? [])
      const group = config.group ?? "secondary"
      const aligned = alignSeries(safe, timeline, getAlignmentMaxStaleMs(config.key, group, selection.interval.stepMs))
      const hasCoverage = STRICT_RANGE_COVERAGE_KEYS.has(config.key)
        ? hasCompleteCoverage(aligned)
        : hasUsableCoverage(aligned)
      if (!hasCoverage) return []
      return [{
        key: config.key,
        i18nKey: config.i18nKey,
        infoI18nKey: config.infoI18nKey,
        labelVars: SELECTED_INSTRUMENT_LABEL_KEYS.has(config.key) ? { ccy } : undefined,
        order: absoluteIndex + 1,
        paneIndex: Math.floor(absoluteIndex / 2),
        group,
        tier: config.tier ?? "secondary",
        color: config.color,
        source: config.key === "btcPrice" && !isBtc ? "OKX" : config.source,
        unit: config.unit,
        refreshMs: config.refreshMs,
        relevanceScore: config.relevanceScore,
        nativeInterval: group === "orderbook" ? "collector" : selection.interval.id,
        coverage: hasCompleteCoverage(aligned) ? "complete" : "partial",
        freshness: getFreshness(group),
        data: timeline.map((t, i) => ({ time: t, value: aligned[i] })),
      }]
    })
  const refreshMs =
    series.length === 0
      ? DEFAULT_CRYPTO_HISTORY_REFRESH_MS
      : Math.max(30_000, Math.min(...series.map((entry) => entry.refreshMs)))

  return NextResponse.json({
    range: selection.rangeId,
    days,
    selection: {
      range: selection.rangeId,
      custom: selection.custom,
      interval: selection.interval.id,
      okxBar: selection.interval.okxBar,
      start: selection.startMs,
      end: selection.endMs,
      maxPoints: MAX_HISTORY_POINTS,
    },
    candles: btcSwapCandles
      .filter((candle) => candle.timestamp >= selection.startMs && candle.timestamp <= selection.endMs)
      .map((candle) => ({
        time: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        quoteVolume: candle.quoteVolume,
      })),
    signals: {
      crowdingScore: compositeSignals.crowdingScore.at(-1)?.value ?? null,
      extensionScore: compositeSignals.extensionScore.at(-1)?.value ?? null,
      trendScore: compositeSignals.trendScore.at(-1)?.value ?? null,
      cascadeScore: compositeSignals.cascadeScore.at(-1)?.value ?? null,
      cascadeInProgress: (compositeSignals.cascadeInProgress.at(-1)?.value ?? 0) >= 1,
      exhaustionScore: compositeSignals.exhaustionScore.at(-1)?.value ?? null,
    },
    ccy,
    timeline,
    series,
    refreshMs,
    paneCount: series.length === 0 ? 0 : Math.max(...series.map((s) => s.paneIndex)) + 1,
    updatedAt: Date.now(),
  })
}
