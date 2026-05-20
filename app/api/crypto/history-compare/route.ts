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
  order: number
  paneIndex: number
  color: string
  source: string
  unit: "usd" | "pct" | "ratio" | "raw" | "count" | "cny"
  data: { time: number; value: number | null }[]
}

const DAY_MS = 86_400_000

const CRYPTO_SERIES_SOURCE_BY_KEY: Record<string, string> = {
  btcPrice: "blockchain.info / OKX",
  miningElectricityCost: "mempool.space / blockchain.info",
  miningComprehensiveCost: "mempool.space / blockchain.info",
  ethPrice: "OKX",
  solPrice: "OKX",
  xrpPrice: "OKX",
  bnbPrice: "OKX",
  dogePrice: "OKX",
  btcReturnZ: "OKX / computed",
  btcVolumeZ: "OKX / computed",
  btcVolumeUsd: "OKX",
  basis: "OKX / computed",
  upperWick: "OKX / computed",
  lowerWick: "OKX / computed",
  signalBuyScore: "OKX / computed",
  signalSellScore: "OKX / computed",
  signalRiskScore: "OKX / computed",
  signalDirection: "OKX / computed",
  stablecoinMcap: "DefiLlama",
  defiTvl: "DefiLlama",
  oi: "OKX",
  oiReturnZ: "OKX / computed",
  funding: "OKX",
  ls: "OKX",
  contractLs: "OKX",
  topTraderAccount: "OKX",
  topTraderPosition: "OKX",
  smartBuy: "OKX",
  smartSell: "OKX",
  smartNet: "OKX / computed",
  smartCum: "OKX / computed",
  fng: "alternative.me",
  dvol: "Deribit",
  hashRate: "blockchain.info",
  difficulty: "blockchain.info",
  nTxs: "blockchain.info",
  activeAddrs: "blockchain.info",
  mempool: "blockchain.info",
  txFeesUsd: "blockchain.info",
  avgBlockSize: "blockchain.info",
  dxy: "Yahoo Finance",
  us10y: "Yahoo Finance",
  us2y: "Yahoo Finance",
  vix: "Yahoo Finance",
  sp500: "Yahoo Finance",
  nasdaq: "Yahoo Finance",
  russell: "Yahoo Finance",
  gold: "Yahoo Finance",
  silver: "Yahoo Finance",
  copper: "Yahoo Finance",
  oil: "Yahoo Finance",
  natgas: "Yahoo Finance",
  nikkei: "Yahoo Finance",
  hangseng: "Yahoo Finance",
}

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
  code: string
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

async function okxRubikSeries(path: string): Promise<string[][]> {
  try {
    const res = await fetch(`${OKX}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate },
    })
    if (!res.ok) return []
    const json = (await res.json()) as OkxResponse<string[]>
    if (json.code !== "0") return []
    return (json.data ?? []) as string[][]
  } catch {
    return []
  }
}

async function okxDailyCandles(instId: string, limit: number): Promise<OkxCandlePoint[]> {
  const path = `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=1D&limit=${limit}`
  const rows = await okxRubikSeries(path)
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

async function okxDailyKlines(instId: string, limit: number): Promise<RawPoint[]> {
  return okxDailyCandles(instId, limit).then((candles) =>
    candles.map((candle) => ({ timestamp: candle.timestamp, value: candle.close })),
  )
}

async function okxOiHistory(ccy: string, limit: number): Promise<RawPoint[]> {
  /* OKX rubik daily OI — values returned as [ts, oiCcy, oiUsd]. */
  const rows = await okxRubikSeries(
    `/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=1D&limit=${limit}`,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[2]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxLongShort(ccy: string, limit: number): Promise<RawPoint[]> {
  const rows = await okxRubikSeries(
    `/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1D&limit=${limit}`,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxContractLongShort(instId: string, limit: number): Promise<RawPoint[]> {
  const rows = await okxRubikSeries(
    `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract?instId=${instId}&period=1D&limit=${limit}`,
  )
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
}

async function okxTopTraderPosition(instId: string, limit: number): Promise<{
  account: RawPoint[]
  position: RawPoint[]
}> {
  const rows = await okxRubikSeries(
    `/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${instId}&period=1D&limit=${limit}`,
  )
  return {
    account: rows
      .map((row) => ({ timestamp: Number(row[0]), value: Number(row[1]) }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value)),
    position: rows
      .map((row) => ({ timestamp: Number(row[0]), value: Number(row[2]) }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value)),
  }
}

async function okxTakerNet(ccy: string, limit: number): Promise<{
  buy: RawPoint[]
  sell: RawPoint[]
  net: RawPoint[]
  cumulativeNet: RawPoint[]
}> {
  const [contractRows, spotRows] = await Promise.all([
    okxRubikSeries(`/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=CONTRACTS&period=1D&limit=${limit}`),
    okxRubikSeries(`/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SPOT&period=1D&limit=${limit}`),
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

async function okxFundingHistory(instId: string, limit: number): Promise<RawPoint[]> {
  try {
    const res = await fetch(
      `${OKX}/api/v5/public/funding-rate-history?instId=${encodeURIComponent(instId)}&limit=${limit}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate } },
    )
    if (!res.ok) return []
    const json = (await res.json()) as OkxResponse<{ fundingTime: string; fundingRate: string }>
    return (json.data ?? [])
      .map((row) => ({
        timestamp: Number(row.fundingTime),
        value: Number(row.fundingRate) * 100,
      }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
  } catch {
    return []
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

/* ----------------------------- handler ----------------------------- */

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rangeId = url.searchParams.get("range") ?? DEFAULT_TIME_RANGE
  const range = getTimeRange(rangeId)
  const miningCostParameters = resolveMiningCostParameters(url.searchParams)
  const days = getRangeDays(range.id)
  const ccy = (url.searchParams.get("ccy") ?? "BTC").toUpperCase()
  const instId = `${ccy}-USDT-SWAP`
  const blockchainSpan = getBlockchainTimespan(range.id)
  const okxLimit = Math.max(60, Math.min(300, Math.ceil(days) + 7))

  const now = Date.now()
  let timeline = buildTimeline(days, now)

  /* Fetch every series in parallel — the slowest leg sets total latency. */
  const [
    btcPriceA, // blockchain.info (longer history)
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
    fetchBtcUsdDailyFromBlockchain(blockchainSpan, revalidate).then((r) =>
      (r?.points ?? []).map((p) => ({ timestamp: p.timestamp, value: p.close })),
    ),
    okxDailyCandles(instId, okxLimit),
    okxDailyCandles(`${ccy}-USDT`, okxLimit),
    okxDailyKlines("ETH-USDT", okxLimit),
    okxDailyKlines("SOL-USDT", okxLimit),
    okxDailyKlines("XRP-USDT", okxLimit),
    okxDailyKlines("BNB-USDT", okxLimit),
    okxDailyKlines("DOGE-USDT", okxLimit),
    okxOiHistory(ccy, okxLimit),
    okxFundingHistory(instId, okxLimit),
    okxLongShort(ccy, okxLimit),
    okxContractLongShort(instId, okxLimit),
    okxTopTraderPosition(instId, okxLimit),
    okxTakerNet(ccy, okxLimit),
    fetchFearGreedHistory(range, revalidate).then((r) =>
      (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
    ),
    fetchStablecoinMarketCap(range, revalidate).then((r) =>
      (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
    ),
    fetchDefiTvl(range, revalidate).then((r) =>
      (r?.history ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value })),
    ),
    fetchMempoolHashrateHistory(revalidate),
    blockchainSeries("hash-rate", blockchainSpan),
    blockchainSeries("difficulty", blockchainSpan),
    blockchainSeries("n-transactions", blockchainSpan),
    blockchainSeries("n-unique-addresses", blockchainSpan),
    blockchainSeries("mempool-size", blockchainSpan),
    blockchainSeries("transaction-fees-usd", blockchainSpan),
    blockchainSeries("avg-block-size", blockchainSpan),
    deribitDvolDaily(days),
    yahooPoints("DX-Y.NYB", range),
    yahooPoints("^TNX", range), // US 10Y yield
    yahooPoints("^IRX", range), // Short rate proxy (13W)
    yahooPoints("^VIX", range),
    yahooPoints("^GSPC", range),
    yahooPoints("^IXIC", range),
    yahooPoints("^RUT", range),
    yahooPoints("GC=F", range),
    yahooPoints("SI=F", range),
    yahooPoints("HG=F", range),
    yahooPoints("CL=F", range),
    yahooPoints("NG=F", range),
    yahooPoints("^N225", range),
    yahooPoints("^HSI", range),
  ])

  const btcPriceB = toRawPoints(btcSwapCandles, "close")
  let btcPrice = chooseCompleteCandidate([btcPriceA, btcPriceB], timeline)
  if (range.id === "max" && btcPrice.length > 0) {
    timeline = buildTimelineFromStart(Math.min(...btcPrice.map((point) => point.timestamp)), now)
    btcPrice = chooseCompleteCandidate([btcPriceA, btcPriceB], timeline)
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
  const oiReturnZ = rollingReturnZScore(oi, 30)
  const basis = buildBasis(btcSwapCandles, btcSpotCandles)
  const signalScores = buildDailySignalScores({
    candles: btcSwapCandles,
    oi,
    funding,
    lsRatio,
  })

  /* Build the series specs. paneIndex grouping is curated to keep visually
     comparable units together; the order also drives the on-screen stack. */
  const specsRaw: Array<Omit<SeriesSpec, "data" | "infoI18nKey" | "order" | "source"> & { points: RawPoint[] }> = [
    { key: "btcPrice", i18nKey: "compare.s.price", paneIndex: 0, color: "rgb(99 102 241)", unit: "usd", points: btcPrice },
    { key: "miningElectricityCost", i18nKey: "compare.s.miningElectricityCost", paneIndex: 0, color: "rgb(245 158 11)", unit: "usd", points: miningElectricityCost },
    { key: "miningComprehensiveCost", i18nKey: "compare.s.miningComprehensiveCost", paneIndex: 0, color: "rgb(217 119 6)", unit: "usd", points: miningComprehensiveCost },
    { key: "ethPrice", i18nKey: "compare.s.ethPrice", paneIndex: 0, color: "rgb(168 85 247)", unit: "usd", points: ethPrice },
    { key: "solPrice", i18nKey: "compare.s.solPrice", paneIndex: 0, color: "rgb(20 184 166)", unit: "usd", points: solPrice },
    { key: "xrpPrice", i18nKey: "compare.s.xrpPrice", paneIndex: 0, color: "rgb(59 130 246)", unit: "usd", points: xrpPrice },
    { key: "bnbPrice", i18nKey: "compare.s.bnbPrice", paneIndex: 0, color: "rgb(234 179 8)", unit: "usd", points: bnbPrice },
    { key: "dogePrice", i18nKey: "compare.s.dogePrice", paneIndex: 0, color: "rgb(202 138 4)", unit: "usd", points: dogePrice },
    { key: "btcReturnZ", i18nKey: "compare.s.returnZ", paneIndex: 1, color: "rgb(244 63 94)", unit: "raw", points: btcReturnZ },
    { key: "btcVolumeZ", i18nKey: "compare.s.volumeZ", paneIndex: 1, color: "rgb(245 158 11)", unit: "raw", points: btcVolumeZ },
    { key: "btcVolumeUsd", i18nKey: "compare.s.volumeUsd", paneIndex: 2, color: "rgb(37 99 235)", unit: "usd", points: btcVolumeUsd },
    { key: "basis", i18nKey: "compare.s.basis", paneIndex: 2, color: "rgb(14 165 233)", unit: "pct", points: basis },
    { key: "upperWick", i18nKey: "compare.s.upperWick", paneIndex: 3, color: "rgb(220 38 38)", unit: "pct", points: btcUpperWick },
    { key: "lowerWick", i18nKey: "compare.s.lowerWick", paneIndex: 3, color: "rgb(22 163 74)", unit: "pct", points: btcLowerWick },
    { key: "signalBuyScore", i18nKey: "compare.s.signalBuy", paneIndex: 4, color: "rgb(22 163 74)", unit: "raw", points: signalScores.buyScore },
    { key: "signalSellScore", i18nKey: "compare.s.signalSell", paneIndex: 4, color: "rgb(220 38 38)", unit: "raw", points: signalScores.sellScore },
    { key: "signalRiskScore", i18nKey: "compare.s.signalRisk", paneIndex: 5, color: "rgb(245 158 11)", unit: "raw", points: signalScores.riskScore },
    { key: "signalDirection", i18nKey: "compare.s.signalDirection", paneIndex: 5, color: "rgb(99 102 241)", unit: "raw", points: signalScores.direction },

    { key: "stablecoinMcap", i18nKey: "compare.s.stablecoin", paneIndex: 6, color: "rgb(20 184 166)", unit: "usd", points: stablecoin },
    { key: "defiTvl", i18nKey: "compare.s.defiTvl", paneIndex: 6, color: "rgb(34 197 94)", unit: "usd", points: defiTvl },

    { key: "oi", i18nKey: "compare.s.oi", paneIndex: 7, color: "rgb(59 130 246)", unit: "usd", points: oi },
    { key: "oiReturnZ", i18nKey: "compare.s.oiZ", paneIndex: 7, color: "rgb(14 165 233)", unit: "raw", points: oiReturnZ },
    { key: "funding", i18nKey: "compare.s.funding", paneIndex: 8, color: "rgb(236 72 153)", unit: "pct", points: funding },
    { key: "ls", i18nKey: "compare.s.ls", paneIndex: 9, color: "rgb(168 85 247)", unit: "ratio", points: lsRatio },
    { key: "contractLs", i18nKey: "compare.s.contractLs", paneIndex: 9, color: "rgb(99 102 241)", unit: "ratio", points: contractLsRatio },
    { key: "topTraderAccount", i18nKey: "compare.s.topTraderAccount", paneIndex: 10, color: "rgb(192 132 252)", unit: "ratio", points: topTrader.account },
    { key: "topTraderPosition", i18nKey: "compare.s.topTraderPosition", paneIndex: 10, color: "rgb(217 70 239)", unit: "ratio", points: topTrader.position },

    { key: "smartBuy", i18nKey: "compare.s.smartBuy", paneIndex: 11, color: "rgb(22 163 74)", unit: "raw", points: taker.buy },
    { key: "smartSell", i18nKey: "compare.s.smartSell", paneIndex: 11, color: "rgb(220 38 38)", unit: "raw", points: taker.sell },
    { key: "smartNet", i18nKey: "compare.s.smartNet", paneIndex: 12, color: "rgb(245 158 11)", unit: "raw", points: taker.net },
    { key: "smartCum", i18nKey: "compare.s.smartCum", paneIndex: 12, color: "rgb(59 130 246)", unit: "raw", points: taker.cumulativeNet },

    { key: "fng", i18nKey: "compare.s.fng", paneIndex: 13, color: "rgb(245 158 11)", unit: "raw", points: fng },
    { key: "dvol", i18nKey: "compare.s.dvol", paneIndex: 14, color: "rgb(244 114 182)", unit: "raw", points: dvol },

    { key: "hashRate", i18nKey: "compare.s.hashRate", paneIndex: 15, color: "rgb(20 184 166)", unit: "raw", points: hashRateEH },
    { key: "difficulty", i18nKey: "compare.s.difficulty", paneIndex: 15, color: "rgb(168 85 247)", unit: "raw", points: difficultyT },

    { key: "nTxs", i18nKey: "compare.s.nTxs", paneIndex: 16, color: "rgb(59 130 246)", unit: "count", points: nTxs },
    { key: "activeAddrs", i18nKey: "compare.s.activeAddrs", paneIndex: 16, color: "rgb(99 102 241)", unit: "count", points: activeAddrs },

    { key: "mempool", i18nKey: "compare.s.mempool", paneIndex: 17, color: "rgb(245 158 11)", unit: "raw", points: mempoolMB },
    { key: "txFeesUsd", i18nKey: "compare.s.txFeesUsd", paneIndex: 17, color: "rgb(220 38 38)", unit: "usd", points: txFeesUsd },
    { key: "avgBlockSize", i18nKey: "compare.s.avgBlockSize", paneIndex: 17, color: "rgb(34 197 94)", unit: "raw", points: avgBlockSizeMB },

    { key: "dxy", i18nKey: "compare.s.dxy", paneIndex: 18, color: "rgb(99 102 241)", unit: "raw", points: dxy },
    { key: "us10y", i18nKey: "compare.s.us10y", paneIndex: 19, color: "rgb(245 158 11)", unit: "pct", points: us10y },
    { key: "us2y", i18nKey: "compare.s.us2y", paneIndex: 19, color: "rgb(236 72 153)", unit: "pct", points: us2y },

    { key: "vix", i18nKey: "compare.s.vix", paneIndex: 20, color: "rgb(220 38 38)", unit: "raw", points: vix },
    { key: "sp500", i18nKey: "compare.s.sp500", paneIndex: 21, color: "rgb(99 102 241)", unit: "raw", points: sp500 },
    { key: "nasdaq", i18nKey: "compare.s.nasdaq", paneIndex: 21, color: "rgb(168 85 247)", unit: "raw", points: nasdaq },
    { key: "russell", i18nKey: "compare.s.russell", paneIndex: 21, color: "rgb(20 184 166)", unit: "raw", points: russell2k },

    { key: "gold", i18nKey: "compare.s.gold", paneIndex: 22, color: "rgb(245 158 11)", unit: "usd", points: gold },
    { key: "silver", i18nKey: "compare.s.silver", paneIndex: 22, color: "rgb(148 163 184)", unit: "usd", points: silver },
    { key: "copper", i18nKey: "compare.s.copper", paneIndex: 22, color: "rgb(217 119 6)", unit: "usd", points: copper },
    { key: "oil", i18nKey: "compare.s.oil", paneIndex: 23, color: "rgb(34 197 94)", unit: "usd", points: oil },
    { key: "natgas", i18nKey: "compare.s.natgas", paneIndex: 23, color: "rgb(59 130 246)", unit: "usd", points: natgas },

    { key: "nikkei", i18nKey: "compare.s.nikkei", paneIndex: 24, color: "rgb(220 38 38)", unit: "raw", points: nikkei },
    { key: "hangseng", i18nKey: "compare.s.hangseng", paneIndex: 24, color: "rgb(245 158 11)", unit: "raw", points: hangseng },
  ]

  const series: SeriesSpec[] = specsRaw
    .flatMap((spec) => {
      /* Strip out-of-bounds samples up front; alignDaily then maps real source
         observations onto the selected timeline. Keep partial but usable lines
         so realtime crypto metrics are also visible in the history tab. */
      const safe = dropOutOfRange(spec.points)
      const aligned = alignDaily(safe, timeline)
      if (!hasUsableCoverage(aligned)) return []
      return [{
        key: spec.key,
        i18nKey: spec.i18nKey,
        infoI18nKey: `compare.info.${spec.key}`,
        order: 0,
        paneIndex: spec.paneIndex,
        color: spec.color,
        source: CRYPTO_SERIES_SOURCE_BY_KEY[spec.key] ?? "Public market APIs",
        unit: spec.unit,
        data: timeline.map((t, i) => ({ time: t, value: aligned[i] })),
      }]
    })
    .map((spec, index) => ({ ...spec, order: index + 1 }))

  return NextResponse.json({
    range: range.id,
    days,
    ccy,
    timeline,
    series,
    paneCount: Math.max(0, ...series.map((s) => s.paneIndex)) + 1,
    updatedAt: Date.now(),
  })
}
