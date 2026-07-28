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
  type CryptoIndicatorUnit,
} from "@/lib/crypto-indicator-config"
import {
  DEFAULT_TIME_RANGE,
  getBlockchainTimespan,
  getRangeDays,
  getTimeRange,
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
  color: string
  source: string
  unit: CryptoIndicatorUnit
  refreshMs: number
  relevanceScore?: number
  data: { time: number; value: number | null }[]
}

const DAY_MS = 86_400_000

/* Build a daily UTC timeline covering the lookback window. */
function buildTimeline(days: number, anchorMs: number): number[] {
  const out: number[] = []
  const start = Math.floor((anchorMs - days * DAY_MS) / DAY_MS) * DAY_MS
  const end = Math.floor(anchorMs / DAY_MS) * DAY_MS
  for (let t = start; t <= end; t += DAY_MS) out.push(t)
  return out
}

function buildTimelineFromStart(startMs: number, anchorMs: number): number[] {
  const out: number[] = []
  const start = Math.floor(startMs / DAY_MS) * DAY_MS
  const end = Math.floor(anchorMs / DAY_MS) * DAY_MS
  for (let t = start; t <= end; t += DAY_MS) out.push(t)
  return out
}

/**
 * Resample sparse points onto a daily timeline by nearest-prior carry-forward
 * (max 7-day staleness). Carry-forward is only used to normalize real source
 * updates onto a daily grid; series with gaps after this pass are excluded.
 */
function alignDaily(points: RawPoint[], timeline: number[]): (number | null)[] {
  if (points.length === 0) return timeline.map(() => null)
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp)
  const out: (number | null)[] = []
  let cursor = 0
  let lastValue: number | null = null
  let lastTime = -Infinity
  for (const t of timeline) {
    while (cursor < sorted.length && sorted[cursor].timestamp <= t + DAY_MS / 2) {
      lastValue = sorted[cursor].value
      lastTime = sorted[cursor].timestamp
      cursor++
    }
    out.push(lastValue !== null && t - lastTime <= 7 * DAY_MS ? lastValue : null)
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
  return nonEmpty.find((candidate) => hasCompleteCoverage(alignDaily(dropOutOfRange(candidate), timeline))) ?? nonEmpty[0]
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
const OKX_RUBIK_REQUEST_SPACING_MS = 420
/* OKX publishes hard retention windows for these Rubik derivatives stats;
   skip requests that cannot cover the selected range's left edge. */
const OKX_INSTRUMENT_HISTORY_EARLIEST_MS = Date.UTC(2024, 0, 1)
const OKX_TOP_TRADER_HISTORY_EARLIEST_MS = Date.UTC(2024, 2, 22)
const OKX_MARKET_LONG_SHORT_MAX_DAYS = 180

type OkxDerivativeHistoryPeriod = "1D" | "1W"

function okxDerivativeHistoryPeriod(daysWanted: number): {
  period: OkxDerivativeHistoryPeriod
  stepDays: number
} {
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

/* Paginate Rubik stat endpoints with begin/end. We move the end timestamp
   backward by the oldest row returned each page until we either cover the
   requested days, exhaust upstream data, or hit MAX_PAGES. */
async function okxRubikPaginated(
  buildPath: (begin: string, end: string, limit: number) => string,
  daysWanted: number,
  stepDays = 1,
): Promise<string[][]> {
  const desired = Math.max(60, Math.ceil(daysWanted / stepDays) + 7)
  const collected = new Map<number, string[]>()
  let end = Date.now()

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
): Promise<string[][]> {
  const desired = Math.max(60, Math.ceil(daysWanted) + 7)
  const collected = new Map<number, string[]>()
  let after: string | null = null

  for (let page = 0; page < OKX_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      instId,
      bar: "1D",
      limit: String(OKX_CANDLE_PAGE_LIMIT),
    })
    if (after) params.set("after", after)
    const path = `/api/v5/market/history-candles?${params.toString()}`
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
    after = String(oldestTs)
  }

  return Array.from(collected.values()).sort((a, b) => Number(b[0]) - Number(a[0]))
}

async function okxDailyCandles(instId: string, daysWanted: number): Promise<OkxCandlePoint[]> {
  const rows = await okxCandleRows(instId, daysWanted)
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

async function okxDailyKlines(instId: string, daysWanted: number): Promise<RawPoint[]> {
  return okxDailyCandles(instId, daysWanted).then((candles) =>
    candles.map((candle) => ({ timestamp: candle.timestamp, value: candle.close })),
  )
}

async function okxOiHistory(instId: string, daysWanted: number): Promise<RawPoint[]> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted)
  const rows = await okxRubikPaginated(
    (begin, end, limit) =>
      `/api/v5/rubik/stat/contracts/open-interest-history?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
    daysWanted,
    stepDays,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[3]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxLongShort(ccy: string, daysWanted: number): Promise<RawPoint[]> {
  const rows = await okxRubikPaginated(
    (begin, end, limit) =>
      `/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1D&begin=${begin}&end=${end}&limit=${limit}`,
    daysWanted,
  )
  return rows
    .map((row) => ({ timestamp: toDayKey(Number(row[0])), value: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxContractLongShort(instId: string, daysWanted: number): Promise<RawPoint[]> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted)
  const rows = await okxRubikPaginated(
    (begin, end, limit) =>
      `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
    daysWanted,
    stepDays,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxTopTraderPosition(instId: string, daysWanted: number): Promise<{
  account: RawPoint[]
  position: RawPoint[]
}> {
  const { period, stepDays } = okxDerivativeHistoryPeriod(daysWanted)
  const [accountRows, positionRows] = await Promise.all([
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
      stepDays,
    ),
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader?instId=${instId}&period=${period}&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
      stepDays,
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

async function okxTakerNet(ccy: string, daysWanted: number): Promise<{
  buy: RawPoint[]
  sell: RawPoint[]
  net: RawPoint[]
  cumulativeNet: RawPoint[]
}> {
  const [contractRows, spotRows] = await Promise.all([
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=CONTRACTS&period=1D&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
    ),
    okxRubikPaginated(
      (begin, end, limit) =>
        `/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SPOT&period=1D&begin=${begin}&end=${end}&limit=${limit}`,
      daysWanted,
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
async function okxFundingHistory(instId: string, daysWanted: number): Promise<RawPoint[]> {
  const desired = Math.max(180, Math.ceil(daysWanted) * 3 + 24)
  const collected = new Map<number, number>()
  let after: string | null = null

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
): Promise<{ long: RawPoint[]; short: RawPoint[] }> {
  const maxDays = Math.min(daysWanted, 90)
  const cutoffMs = Date.now() - maxDays * DAY_MS
  const ctVal = SWAP_CT_VAL[instId] ?? 0.01
  const longByDay = new Map<number, number>()
  const shortByDay = new Map<number, number>()
  let after: string | null = null

  for (let page = 0; page < 30; page++) {
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
async function deribitDvolDaily(rangeDays: number): Promise<RawPoint[]> {
  const end = Date.now()
  const start = end - (rangeDays + 30) * DAY_MS
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

const BTC_PRICE_KEYS = [
  "btcPrice",
  "btcMomentum7d",
  "btcMomentum30d",
  "btcMomentum90d",
  "btcRealizedVol30d",
  "btcDrawdown",
  "btcReturnZ",
] as const

const BTC_SWAP_CANDLE_KEYS = [
  ...BTC_PRICE_KEYS,
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
  "oiReturnZ",
  "signalBuyScore",
  "signalSellScore",
  "signalRiskScore",
  "signalDirection",
  "manipLeveragePressure",
  "manipPriceOiDivergence",
] as const
const FUNDING_KEYS = [
  "funding",
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
  "manipLiquidationImbalancePct",
  "manipLiquidationIntensityZ",
] as const
const MINING_COST_KEYS = ["miningElectricityCost", "miningComprehensiveCost"] as const
const TOP_TRADER_KEYS = ["topTraderAccount", "topTraderPosition"] as const
const SMART_MONEY_KEYS = [
  "smartBuy",
  "smartSell",
  "smartNet",
  "smartCum",
  "manipTakerImbalancePct",
  "manipCvdPriceDivergence",
] as const
const BASIS_KEYS = ["basis", "manipBasisDislocationZ"] as const

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

function hasRequestedKey(requestedKeys: Set<string>, keys: readonly string[]): boolean {
  return keys.some((key) => requestedKeys.has(key))
}

/* ----------------------------- handler ----------------------------- */

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rangeId = url.searchParams.get("range") ?? DEFAULT_TIME_RANGE
  const range = getTimeRange(rangeId)
  const miningCostParameters = resolveMiningCostParameters(url.searchParams)
  const days = getRangeDays(range.id)
  const ccy = (url.searchParams.get("ccy") ?? "BTC").toUpperCase()
  const isBtc = ccy === "BTC"
  const instId = `${ccy}-USDT-SWAP`
  const blockchainSpan = getBlockchainTimespan(range.id)
  /* Total days requested from OKX endpoints. The per-call helpers paginate
     internally (begin/end for Rubik stats, after for candles/funding) up to
     OKX_MAX_PAGES, so this is no longer bounded by any single-request cap. */
  const okxDays = Math.max(60, Math.ceil(days) + 7)

  const now = Date.now()
  let timeline = buildTimeline(days, now)
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

  /* Staged clients request the top ordered slice first; skip lower-priority
     upstream calls until the background full-history request asks for them. */
  const [
    btcPriceA, // blockchain.info (BTC only, longer history)
    btcSwapCandles, // OKX daily swap candles (fallback / derivatives metrics)
    btcSpotCandles,
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
  ] = await Promise.all([
    isBtc && hasRequestedKey(requestedKeys, BTC_PRICE_KEYS)
      ? fetchBtcUsdDailyFromBlockchain(blockchainSpan, revalidate).then((r) =>
          (r?.points ?? []).map((p) => ({ timestamp: p.timestamp, value: p.close })),
        )
      : [],
    hasRequestedKey(requestedKeys, BTC_SWAP_CANDLE_KEYS) ? okxDailyCandles(instId, okxDays) : [],
    hasRequestedKey(requestedKeys, BASIS_KEYS) ? okxDailyCandles(`${ccy}-USDT`, okxDays) : [],
    requestedKeys.has("ethPrice") ? okxDailyKlines("ETH-USDT", okxDays) : [],
    requestedKeys.has("solPrice") ? okxDailyKlines("SOL-USDT", okxDays) : [],
    requestedKeys.has("xrpPrice") ? okxDailyKlines("XRP-USDT", okxDays) : [],
    requestedKeys.has("bnbPrice") ? okxDailyKlines("BNB-USDT", okxDays) : [],
    requestedKeys.has("dogePrice") ? okxDailyKlines("DOGE-USDT", okxDays) : [],
    hasRequestedKey(requestedKeys, OI_KEYS) && okxInstrumentHistoryCoversRange
      ? okxOiHistory(instId, okxDays)
      : [],
    hasRequestedKey(requestedKeys, FUNDING_KEYS) ? okxFundingHistory(instId, okxDays) : [],
    hasRequestedKey(requestedKeys, LONG_SHORT_KEYS) && okxMarketLongShortCoversRange
      ? okxLongShort(ccy, okxDays)
      : [],
    requestedKeys.has("contractLs") && okxInstrumentHistoryCoversRange
      ? okxContractLongShort(instId, okxDays)
      : [],
    hasRequestedKey(requestedKeys, TOP_TRADER_KEYS) && okxTopTraderHistoryCoversRange
      ? okxTopTraderPosition(instId, okxDays)
      : { account: [], position: [] },
    hasRequestedKey(requestedKeys, SMART_MONEY_KEYS)
      ? okxTakerNet(ccy, okxDays)
      : { buy: [], sell: [], net: [], cumulativeNet: [] },
    hasRequestedKey(requestedKeys, LIQ_KEYS)
      ? okxLiquidationDaily(instId, okxDays)
      : { long: [], short: [] },
    requestedKeys.has("fng")
      ? fetchFearGreedHistory(range, revalidate).then((r) =>
          (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
        )
      : [],
    requestedKeys.has("stablecoinMcap")
      ? fetchStablecoinMarketCap(range, revalidate).then((r) =>
          (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
        )
      : [],
    requestedKeys.has("defiTvl")
      ? fetchDefiTvl(range, revalidate).then((r) =>
          (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
        )
      : [],
    hasRequestedKey(requestedKeys, MINING_COST_KEYS) ? fetchMempoolHashrateHistory(revalidate) : [],
    requestedKeys.has("hashRate") || hasRequestedKey(requestedKeys, MINING_COST_KEYS)
      ? blockchainSeries("hash-rate", blockchainSpan)
      : [],
    requestedKeys.has("difficulty") ? blockchainSeries("difficulty", blockchainSpan) : [],
    requestedKeys.has("nTxs") ? blockchainSeries("n-transactions", blockchainSpan) : [],
    requestedKeys.has("activeAddrs") ? blockchainSeries("n-unique-addresses", blockchainSpan) : [],
    requestedKeys.has("mempool") ? blockchainSeries("mempool-size", blockchainSpan) : [],
    requestedKeys.has("txFeesUsd") ? blockchainSeries("transaction-fees-usd", blockchainSpan) : [],
    requestedKeys.has("avgBlockSize") ? blockchainSeries("avg-block-size", blockchainSpan) : [],
    requestedKeys.has("dvol") ? deribitDvolDaily(days) : [],
    requestedKeys.has("dxy") ? yahooPoints("DX-Y.NYB", range) : [],
    requestedKeys.has("us10y") ? yahooPoints("^TNX", range) : [], // US 10Y yield
    requestedKeys.has("us2y") ? yahooPoints("^IRX", range) : [], // Short rate proxy (13W)
    requestedKeys.has("vix") ? yahooPoints("^VIX", range) : [],
    requestedKeys.has("sp500") ? yahooPoints("^GSPC", range) : [],
    requestedKeys.has("nasdaq") ? yahooPoints("^IXIC", range) : [],
    requestedKeys.has("russell") ? yahooPoints("^RUT", range) : [],
    requestedKeys.has("gold") ? yahooPoints("GC=F", range) : [],
    requestedKeys.has("silver") ? yahooPoints("SI=F", range) : [],
    requestedKeys.has("copper") ? yahooPoints("HG=F", range) : [],
    requestedKeys.has("oil") ? yahooPoints("CL=F", range) : [],
    requestedKeys.has("natgas") ? yahooPoints("NG=F", range) : [],
    requestedKeys.has("nikkei") ? yahooPoints("^N225", range) : [],
    requestedKeys.has("hangseng") ? yahooPoints("^HSI", range) : [],
  ])

  const btcPriceB = toRawPoints(btcSwapCandles, "close")
  const priceCandidates = isBtc ? [btcPriceA, btcPriceB] : [btcPriceB]
  let btcPrice = chooseCompleteCandidate(priceCandidates, timeline)
  if (range.id === "max" && btcPrice.length > 0) {
    timeline = buildTimelineFromStart(Math.min(...btcPrice.map((point) => point.timestamp)), now)
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
  const basis = buildBasis(btcSwapCandles, btcSpotCandles)
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

  const rawSeriesByKey = new Map<string, RawPoint[]>([
    ["btcPrice", btcPrice],
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
    ["oiReturnZ", oiReturnZ],
    ["funding", funding],
    ["ls", lsRatio],
    ["contractLs", contractLsRatio],
    ["topTraderAccount", topTrader.account],
    ["topTraderPosition", topTrader.position],
    ["smartBuy", taker.buy],
    ["smartSell", taker.sell],
    ["smartNet", taker.net],
    ["smartCum", taker.cumulativeNet],
    ["liqLong", liq.long],
    ["liqShort", liq.short],
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
      const aligned = alignDaily(safe, timeline)
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
        color: config.color,
        source: config.key === "btcPrice" && !isBtc ? "OKX" : config.source,
        unit: config.unit,
        refreshMs: config.refreshMs,
        relevanceScore: config.relevanceScore,
        data: timeline.map((t, i) => ({ time: t, value: aligned[i] })),
      }]
    })
  const refreshMs =
    series.length === 0
      ? DEFAULT_CRYPTO_HISTORY_REFRESH_MS
      : Math.max(30_000, Math.min(...series.map((entry) => entry.refreshMs)))

  return NextResponse.json({
    range: range.id,
    days,
    ccy,
    timeline,
    series,
    refreshMs,
    paneCount: series.length === 0 ? 0 : Math.max(...series.map((s) => s.paneIndex)) + 1,
    updatedAt: Date.now(),
  })
}
