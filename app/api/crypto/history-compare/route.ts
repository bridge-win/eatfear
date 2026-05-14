import { NextResponse } from "next/server"

import { fetchFearGreedHistory } from "@/lib/data-sources/alternative"
import {
  fetchBlockchainInfoSeries,
  fetchBtcUsdDailyFromBlockchain,
} from "@/lib/data-sources/blockchain-info-charts"
import { fetchStablecoinMarketCap, fetchDefiTvl } from "@/lib/data-sources/defillama"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { fetchJson } from "@/lib/data-sources/_fetch"
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

interface SeriesSpec {
  key: string
  i18nKey: string
  paneIndex: number
  color: string
  unit: "usd" | "pct" | "ratio" | "raw" | "count"
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

async function okxDailyKlines(instId: string, limit: number): Promise<RawPoint[]> {
  const path = `/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=1D&limit=${limit}`
  const rows = await okxRubikSeries(path)
  return rows
    .map((row) => ({ timestamp: Number(row[0]), value: Number(row[4]) }))
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value))
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

async function okxTakerNet(ccy: string, limit: number): Promise<{
  buy: RawPoint[]
  sell: RawPoint[]
  cumulativeNet: RawPoint[]
}> {
  const rows = await okxRubikSeries(
    `/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=CONTRACTS&period=1D&limit=${limit}`,
  )
  const ordered = [...rows].reverse() // oldest first
  let cum = 0
  const buy: RawPoint[] = []
  const sell: RawPoint[] = []
  const cumulative: RawPoint[] = []
  for (const row of ordered) {
    const t = Number(row[0])
    const s = Number(row[1])
    const b = Number(row[2])
    if (!Number.isFinite(t) || !Number.isFinite(s) || !Number.isFinite(b)) continue
    cum += b - s
    buy.push({ timestamp: t, value: b })
    sell.push({ timestamp: t, value: s })
    cumulative.push({ timestamp: t, value: cum })
  }
  return { buy, sell, cumulativeNet: cumulative }
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
    btcPriceB, // OKX daily (fallback / verification)
    ethPrice,
    oi,
    funding,
    lsRatio,
    taker,
    fng,
    stablecoin,
    defiTvl,
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
    okxDailyKlines(instId, okxLimit),
    okxDailyKlines("ETH-USDT", okxLimit),
    okxOiHistory(ccy, okxLimit),
    okxFundingHistory(instId, okxLimit),
    okxLongShort(ccy, okxLimit),
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

  let btcPrice = chooseCompleteCandidate([btcPriceA, btcPriceB], timeline)
  if (range.id === "max" && btcPrice.length > 0) {
    timeline = buildTimelineFromStart(Math.min(...btcPrice.map((point) => point.timestamp)), now)
    btcPrice = chooseCompleteCandidate([btcPriceA, btcPriceB], timeline)
  }

  /* Mining-cost proxy reuses the same model as /api/crypto/mining-cost so the
     two views agree numerically. (Computed BEFORE scaling hashRate down to
     EH/s, so we still divide by the full H/s magnitude here.) */
  const efficiencyJPerTh = 21
  const electricityUsdPerKwh = 0.05
  const btcPerDay = 144 * 3.125
  const miningCost: RawPoint[] = hashRate.map((row) => {
    const networkKwhPerDay = (row.value * 86_400 * efficiencyJPerTh) / 3.6e6
    return { timestamp: row.timestamp, value: (networkKwhPerDay * electricityUsdPerKwh) / btcPerDay }
  })

  /* Scale to chart-friendly units. Storing the divisor next to the series
     keeps the i18n label honest (e.g. "Hashrate (EH/s)" — the user sees the
     unit baked into the legend instead of guessing). */
  const hashRateEH = scale(hashRate, 1e18) // H/s → EH/s
  const difficultyT = scale(difficulty, 1e12) // raw → T
  const mempoolMB = scale(mempool, 1e6) // bytes → MB
  const avgBlockSizeMB = scale(avgBlockSize, 1) // already MB

  /* Build the series specs. paneIndex grouping is curated to keep visually
     comparable units together; the order also drives the on-screen stack. */
  const specsRaw: Array<Omit<SeriesSpec, "data"> & { points: RawPoint[] }> = [
    { key: "btcPrice", i18nKey: "compare.s.price", paneIndex: 0, color: "rgb(99 102 241)", unit: "usd", points: btcPrice },
    { key: "miningCost", i18nKey: "compare.s.miningCost", paneIndex: 0, color: "rgb(245 158 11)", unit: "usd", points: miningCost },
    { key: "ethPrice", i18nKey: "compare.s.ethPrice", paneIndex: 0, color: "rgb(168 85 247)", unit: "usd", points: ethPrice },

    { key: "stablecoinMcap", i18nKey: "compare.s.stablecoin", paneIndex: 1, color: "rgb(20 184 166)", unit: "usd", points: stablecoin },
    { key: "defiTvl", i18nKey: "compare.s.defiTvl", paneIndex: 1, color: "rgb(34 197 94)", unit: "usd", points: defiTvl },

    { key: "oi", i18nKey: "compare.s.oi", paneIndex: 2, color: "rgb(59 130 246)", unit: "usd", points: oi },
    { key: "funding", i18nKey: "compare.s.funding", paneIndex: 3, color: "rgb(236 72 153)", unit: "pct", points: funding },
    { key: "ls", i18nKey: "compare.s.ls", paneIndex: 4, color: "rgb(168 85 247)", unit: "ratio", points: lsRatio },

    { key: "smartBuy", i18nKey: "compare.s.smartBuy", paneIndex: 5, color: "rgb(22 163 74)", unit: "raw", points: taker.buy },
    { key: "smartSell", i18nKey: "compare.s.smartSell", paneIndex: 5, color: "rgb(220 38 38)", unit: "raw", points: taker.sell },
    { key: "smartCum", i18nKey: "compare.s.smartCum", paneIndex: 6, color: "rgb(59 130 246)", unit: "raw", points: taker.cumulativeNet },

    { key: "fng", i18nKey: "compare.s.fng", paneIndex: 7, color: "rgb(245 158 11)", unit: "raw", points: fng },
    { key: "dvol", i18nKey: "compare.s.dvol", paneIndex: 8, color: "rgb(244 114 182)", unit: "raw", points: dvol },

    { key: "hashRate", i18nKey: "compare.s.hashRate", paneIndex: 9, color: "rgb(20 184 166)", unit: "raw", points: hashRateEH },
    { key: "difficulty", i18nKey: "compare.s.difficulty", paneIndex: 9, color: "rgb(168 85 247)", unit: "raw", points: difficultyT },

    { key: "nTxs", i18nKey: "compare.s.nTxs", paneIndex: 10, color: "rgb(59 130 246)", unit: "count", points: nTxs },
    { key: "activeAddrs", i18nKey: "compare.s.activeAddrs", paneIndex: 10, color: "rgb(99 102 241)", unit: "count", points: activeAddrs },

    { key: "mempool", i18nKey: "compare.s.mempool", paneIndex: 11, color: "rgb(245 158 11)", unit: "raw", points: mempoolMB },
    { key: "txFeesUsd", i18nKey: "compare.s.txFeesUsd", paneIndex: 11, color: "rgb(220 38 38)", unit: "usd", points: txFeesUsd },
    { key: "avgBlockSize", i18nKey: "compare.s.avgBlockSize", paneIndex: 11, color: "rgb(34 197 94)", unit: "raw", points: avgBlockSizeMB },

    { key: "dxy", i18nKey: "compare.s.dxy", paneIndex: 12, color: "rgb(99 102 241)", unit: "raw", points: dxy },
    { key: "us10y", i18nKey: "compare.s.us10y", paneIndex: 13, color: "rgb(245 158 11)", unit: "pct", points: us10y },
    { key: "us2y", i18nKey: "compare.s.us2y", paneIndex: 13, color: "rgb(236 72 153)", unit: "pct", points: us2y },

    { key: "vix", i18nKey: "compare.s.vix", paneIndex: 14, color: "rgb(220 38 38)", unit: "raw", points: vix },
    { key: "sp500", i18nKey: "compare.s.sp500", paneIndex: 15, color: "rgb(99 102 241)", unit: "raw", points: sp500 },
    { key: "nasdaq", i18nKey: "compare.s.nasdaq", paneIndex: 15, color: "rgb(168 85 247)", unit: "raw", points: nasdaq },
    { key: "russell", i18nKey: "compare.s.russell", paneIndex: 15, color: "rgb(20 184 166)", unit: "raw", points: russell2k },

    { key: "gold", i18nKey: "compare.s.gold", paneIndex: 16, color: "rgb(245 158 11)", unit: "usd", points: gold },
    { key: "silver", i18nKey: "compare.s.silver", paneIndex: 16, color: "rgb(148 163 184)", unit: "usd", points: silver },
    { key: "copper", i18nKey: "compare.s.copper", paneIndex: 16, color: "rgb(217 119 6)", unit: "usd", points: copper },
    { key: "oil", i18nKey: "compare.s.oil", paneIndex: 17, color: "rgb(34 197 94)", unit: "usd", points: oil },
    { key: "natgas", i18nKey: "compare.s.natgas", paneIndex: 17, color: "rgb(59 130 246)", unit: "usd", points: natgas },

    { key: "nikkei", i18nKey: "compare.s.nikkei", paneIndex: 18, color: "rgb(220 38 38)", unit: "raw", points: nikkei },
    { key: "hangseng", i18nKey: "compare.s.hangseng", paneIndex: 18, color: "rgb(245 158 11)", unit: "raw", points: hangseng },
  ]

  const series: SeriesSpec[] = specsRaw
    .flatMap((spec) => {
      /* Strip out-of-bounds samples up front; alignDaily then maps real source
         observations onto the selected timeline. If the selected period is not
         fully covered, do not return the line for that period. */
      const safe = dropOutOfRange(spec.points)
      const aligned = alignDaily(safe, timeline)
      if (!hasCompleteCoverage(aligned)) return []
      return [{
        key: spec.key,
        i18nKey: spec.i18nKey,
        paneIndex: spec.paneIndex,
        color: spec.color,
        unit: spec.unit,
        data: timeline.map((t, i) => ({ time: t, value: aligned[i] })),
      }]
    })

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
