import { NextResponse } from "next/server"
import { fetchOkxDailyCandles, fetchOkxOpenInterestUsd } from "@/lib/okx-history"
import { DEFAULT_TIME_RANGE, getRangeDays, getTimeRange } from "@/lib/time-range"

export const revalidate = 300

/**
 * Smart-money multi-factor intelligence.
 *
 * Fuses five independent OKX signal families into one composite read, so the
 * page answers "what are informed traders doing?" from more than one angle:
 *
 *  1. spread   — top-trader position long% minus all-account long% (who is on
 *                the other side of the crowd, and by how much, over time)
 *  2. flow     — contract taker buy/sell imbalance across the window
 *                (aggressive-order pressure backing the positioning)
 *  3. crowding — open-interest change × funding cost (is the dominant side
 *                paying an unsustainable price to stay in the trade)
 *  4. loan     — margin BTC/USDT borrow ratio percentile (spot-leverage
 *                sentiment; extremes are contrarian)
 *  5. options  — put/call open-interest ratio (hedging demand; BTC/ETH only)
 *
 * Every factor fails soft to "na" and drops out of the weighted composite, so
 * a single upstream outage degrades coverage instead of blanking the module.
 *
 * OKX contract-level Rubik stats only accept intraday periods (no 1D bucket)
 * and retention is bounded, so long ranges are served at 4H granularity and
 * clamped — reported via `clampedDays`.
 */

const OKX = "https://www.okx.com"
const PAGE_LIMIT = 100
const MAX_DAYS = 180
const DAY_MS = 86_400_000

const SUPPORTED_CCY = /^[A-Z0-9]{2,10}$/
const OPTION_CCY = new Set(["BTC", "ETH"])

const sanitizeCcy = (raw: string | null) => {
  if (!raw) return "BTC"
  const cleaned = raw.toUpperCase().trim()
  return SUPPORTED_CCY.test(cleaned) ? cleaned : "BTC"
}

// Contract-level Rubik endpoints reject 1D, so long ranges ride on 4H buckets.
const CONTRACT_PERIODS = {
  "5m": 5 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "4H": 4 * 60 * 60 * 1000,
} as const

type ContractPeriod = keyof typeof CONTRACT_PERIODS

const pickContractPeriod = (rangeId: string): ContractPeriod => {
  if (rangeId === "1d") return "5m"
  if (rangeId === "5d") return "30m"
  return "4H"
}

// ccy-level Rubik endpoints (margin loan ratio, option ratio) do support 1D.
const pickCcyPeriod = (rangeId: string): "5m" | "1H" | "1D" => {
  if (rangeId === "1d") return "5m"
  if (rangeId === "5d") return "1H"
  return "1D"
}

interface OkxArrayResponse {
  code?: string
  data?: string[][]
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

const fetchOkxWindowed = async (
  path: string,
  query: string,
  periodMs: number,
  startMs: number,
  endMs: number,
): Promise<string[][]> => {
  const windowMs = PAGE_LIMIT * periodMs
  const rows: string[][] = []
  let cursor = startMs
  let guard = 0
  while (cursor < endMs && guard < 16) {
    guard += 1
    const windowEnd = Math.min(cursor + windowMs - 1, endMs)
    const payload = await fetchJsonSafe<OkxArrayResponse>(
      `${OKX}${path}?${query}&begin=${cursor}&end=${windowEnd}&limit=${PAGE_LIMIT}`,
    )
    if (payload?.code === "0" && Array.isArray(payload.data)) rows.push(...payload.data)
    cursor = windowEnd + 1
  }
  return rows
}

interface TimeValue {
  time: number
  value: number
}

const toTimeValue = (rows: string[][], valueIndex: number): TimeValue[] => {
  const byTime = new Map<number, TimeValue>()
  for (const row of rows) {
    const time = Number(row[0])
    const value = Number(row[valueIndex])
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue
    byTime.set(time, { time, value })
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

interface FundingRow {
  fundingRate?: string
  fundingTime?: string
}

interface FundingResponse {
  code?: string
  data?: FundingRow[]
}

const fetchFundingHistory = async (instId: string, startMs: number): Promise<TimeValue[]> => {
  const byTime = new Map<number, TimeValue>()
  let after: number | null = null
  let guard = 0
  while (guard < 6) {
    guard += 1
    const suffix = after !== null ? `&after=${after}` : ""
    const payload = await fetchJsonSafe<FundingResponse>(
      `${OKX}/api/v5/public/funding-rate-history?instId=${instId}&limit=${PAGE_LIMIT}${suffix}`,
    )
    const rows = payload?.code === "0" && Array.isArray(payload.data) ? payload.data : []
    if (rows.length === 0) break
    let oldest = Number.POSITIVE_INFINITY
    for (const row of rows) {
      const time = Number(row.fundingTime)
      const rate = Number(row.fundingRate)
      if (!Number.isFinite(time) || !Number.isFinite(rate)) continue
      byTime.set(time, { time, value: rate * 100 })
      if (time < oldest) oldest = time
    }
    if (!Number.isFinite(oldest) || oldest <= startMs) break
    after = oldest
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
}

const percentileOfLast = (points: TimeValue[]): number | null => {
  if (points.length < 8) return null
  const last = points[points.length - 1].value
  const below = points.filter((point) => point.value <= last).length
  return below / points.length
}

const nearestBefore = (points: TimeValue[], time: number): number | null => {
  let best: number | null = null
  for (const point of points) {
    if (point.time > time) break
    best = point.value
  }
  return best
}

type FactorState = "bull" | "bear" | "neutral" | "na"

interface Factor {
  score: number | null
  state: FactorState
  value: number | null
  detail: Record<string, number | null>
}

const stateOf = (score: number | null): FactorState =>
  score === null ? "na" : score > 0 ? "bull" : score < 0 ? "bear" : "neutral"

const FACTOR_WEIGHTS = { spread: 0.3, flow: 0.25, crowding: 0.2, loan: 0.15, options: 0.1 } as const

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
  const requestedDays = getRangeDays(range.id)
  const days = Math.min(requestedDays, MAX_DAYS)
  const contractPeriod = pickContractPeriod(range.id)
  const ccyPeriod = pickCcyPeriod(range.id)
  const instId = `${ccy}-USDT-SWAP`

  const endMs = Date.now()
  const startMs = endMs - days * DAY_MS
  const contractMs = CONTRACT_PERIODS[contractPeriod]
  const ccyPeriodMs = ccyPeriod === "5m" ? 5 * 60 * 1000 : ccyPeriod === "1H" ? 60 * 60 * 1000 : DAY_MS

  const [topPositionRows, allAccountRows, takerRows, loanRows, putCallRows, funding, oiDaily, candles] =
    await Promise.all([
      fetchOkxWindowed(
        "/api/v5/rubik/stat/contracts/long-short-position-ratio-contract-top-trader",
        `instId=${instId}&period=${contractPeriod}`,
        contractMs,
        startMs,
        endMs,
      ),
      fetchOkxWindowed(
        "/api/v5/rubik/stat/contracts/long-short-account-ratio-contract",
        `instId=${instId}&period=${contractPeriod}`,
        contractMs,
        startMs,
        endMs,
      ),
      fetchOkxWindowed(
        "/api/v5/rubik/stat/taker-volume-contract",
        `instId=${instId}&period=${contractPeriod}`,
        contractMs,
        startMs,
        endMs,
      ),
      fetchOkxWindowed(
        "/api/v5/rubik/stat/margin/loan-ratio",
        `ccy=${ccy}&period=${ccyPeriod}`,
        ccyPeriodMs,
        startMs,
        endMs,
      ),
      OPTION_CCY.has(ccy)
        ? fetchOkxWindowed(
            "/api/v5/rubik/stat/option/open-interest-volume-ratio",
            `ccy=${ccy}&period=${ccyPeriod}`,
            ccyPeriodMs,
            startMs,
            endMs,
          )
        : Promise.resolve([] as string[][]),
      fetchFundingHistory(instId, startMs),
      fetchOkxOpenInterestUsd({ instId, daysWanted: days, revalidateSeconds: revalidate }),
      fetchOkxDailyCandles({ instId: `${ccy}-USDT`, daysWanted: days, revalidateSeconds: revalidate }),
    ])

  const longPct = (ratio: number) => (ratio / (1 + ratio)) * 100
  const topLong = toTimeValue(topPositionRows, 1).map((p) => ({ time: p.time, value: longPct(p.value) }))
  const allLong = toTimeValue(allAccountRows, 1).map((p) => ({ time: p.time, value: longPct(p.value) }))
  const loanSeries = toTimeValue(loanRows, 1)
  // option/open-interest-volume-ratio rows are [ts, oiRatio, volRatio]
  const putCallOi = toTimeValue(putCallRows, 1)
  const priceSeries: TimeValue[] = candles.map((candle) => ({ time: candle.timestamp, value: candle.close }))

  // taker-volume-contract rows are [ts, sellVol, buyVol]
  let buyTotal = 0
  let sellTotal = 0
  for (const row of takerRows) {
    const sell = Number(row[1])
    const buy = Number(row[2])
    if (Number.isFinite(buy) && Number.isFinite(sell)) {
      buyTotal += buy
      sellTotal += sell
    }
  }

  const allLongByTime = new Map(allLong.map((point) => [point.time, point.value]))
  const spreadSeries = topLong
    .filter((point) => allLongByTime.has(point.time))
    .map((point) => ({
      time: point.time,
      topLongPct: point.value,
      allLongPct: allLongByTime.get(point.time) as number,
      spread: point.value - (allLongByTime.get(point.time) as number),
      price: nearestBefore(priceSeries, point.time),
    }))

  // --- factor: positioning spread -----------------------------------------
  const latestSpread = spreadSeries.length > 0 ? spreadSeries[spreadSeries.length - 1].spread : null
  const spreadScore =
    latestSpread === null
      ? null
      : latestSpread >= 8
        ? 2
        : latestSpread >= 3
          ? 1
          : latestSpread > -3
            ? 0
            : latestSpread > -8
              ? -1
              : -2

  // --- factor: aggressive flow --------------------------------------------
  const totalFlow = buyTotal + sellTotal
  const flowImbalance = totalFlow > 0 ? (buyTotal - sellTotal) / totalFlow : null
  const flowScore =
    flowImbalance === null
      ? null
      : flowImbalance >= 0.06
        ? 2
        : flowImbalance >= 0.02
          ? 1
          : flowImbalance > -0.02
            ? 0
            : flowImbalance > -0.06
              ? -1
              : -2

  // --- factor: leverage crowding ------------------------------------------
  const oiFirst = oiDaily.length > 0 ? oiDaily[0].value : null
  const oiLast = oiDaily.length > 0 ? oiDaily[oiDaily.length - 1].value : null
  const oiChangePct = oiFirst && oiLast && oiFirst > 0 ? ((oiLast - oiFirst) / oiFirst) * 100 : null
  const recentFunding = funding.slice(-21) // ~7 days of 8h settlements
  const fundingAvg =
    recentFunding.length > 0 ? recentFunding.reduce((sum, p) => sum + p.value, 0) / recentFunding.length : null
  let crowdingScore: number | null = null
  if (oiChangePct !== null && fundingAvg !== null) {
    if (fundingAvg > 0.05 && oiChangePct > 8) crowdingScore = -2
    else if (fundingAvg > 0.03 && oiChangePct > 0) crowdingScore = -1
    else if (fundingAvg < -0.05) crowdingScore = 2
    else if (fundingAvg < -0.03) crowdingScore = 1
    else crowdingScore = 0
  }

  // --- factor: margin loan sentiment (extremes are contrarian) ------------
  const loanPercentile = percentileOfLast(loanSeries)
  const loanScore =
    loanPercentile === null
      ? null
      : loanPercentile >= 0.97
        ? -2
        : loanPercentile >= 0.9
          ? -1
          : loanPercentile <= 0.03
            ? 2
            : loanPercentile <= 0.1
              ? 1
              : 0

  // --- factor: options hedging demand -------------------------------------
  const latestPutCall = putCallOi.length > 0 ? putCallOi[putCallOi.length - 1].value : null
  const optionsScore = latestPutCall === null ? null : latestPutCall <= 0.7 ? 1 : latestPutCall >= 1.1 ? -1 : 0

  const factors: Record<keyof typeof FACTOR_WEIGHTS, Factor> = {
    spread: {
      score: spreadScore,
      state: stateOf(spreadScore),
      value: latestSpread,
      detail: {
        topLongPct: spreadSeries.length > 0 ? spreadSeries[spreadSeries.length - 1].topLongPct : null,
        allLongPct: spreadSeries.length > 0 ? spreadSeries[spreadSeries.length - 1].allLongPct : null,
      },
    },
    flow: {
      score: flowScore,
      state: stateOf(flowScore),
      value: flowImbalance !== null ? flowImbalance * 100 : null,
      detail: { buyTotal, sellTotal, ratio: sellTotal > 0 ? buyTotal / sellTotal : null },
    },
    crowding: {
      score: crowdingScore,
      state: stateOf(crowdingScore),
      value: fundingAvg,
      detail: { oiChangePct, latestFunding: funding.length > 0 ? funding[funding.length - 1].value : null },
    },
    loan: {
      score: loanScore,
      state: stateOf(loanScore),
      value: loanSeries.length > 0 ? loanSeries[loanSeries.length - 1].value : null,
      detail: { percentile: loanPercentile },
    },
    options: {
      score: optionsScore,
      state: stateOf(optionsScore),
      value: latestPutCall,
      detail: {},
    },
  }

  let weightSum = 0
  let weighted = 0
  for (const key of Object.keys(FACTOR_WEIGHTS) as (keyof typeof FACTOR_WEIGHTS)[]) {
    const factor = factors[key]
    if (factor.score === null) continue
    weightSum += FACTOR_WEIGHTS[key]
    weighted += FACTOR_WEIGHTS[key] * (factor.score / 2)
  }
  const composite = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : null
  const verdict =
    composite === null
      ? "unknown"
      : composite >= 45
        ? "strongBull"
        : composite >= 15
          ? "bull"
          : composite > -15
            ? "neutral"
            : composite > -45
              ? "bear"
              : "strongBear"

  return NextResponse.json({
    sources: [
      "OKX Rubik contract top-trader/all-account long-short & taker volume",
      "OKX Rubik margin loan-ratio & option put/call open interest",
      "OKX funding-rate-history & contracts open-interest-history",
    ],
    ccy,
    instId,
    range: range.id,
    contractPeriod,
    ccyPeriod,
    requestedDays,
    clampedDays: days,
    note: requestedDays > MAX_DAYS ? "okx-contract-retention" : null,
    composite: { score: composite, verdict, coverage: weightSum },
    factors,
    series: {
      spread: spreadSeries,
      loanRatio: loanSeries,
      putCallOi,
      funding,
    },
    updatedAt: Date.now(),
  })
}
