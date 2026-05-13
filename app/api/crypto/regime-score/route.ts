import { NextResponse } from "next/server"

import { computeRegimeScore } from "@/lib/crypto-regime-score"
import { fetchBtcUsdDailyFromBlockchain } from "@/lib/data-sources/blockchain-info-charts"
import {
  fetchBitcoinEtfFlowHistory,
  fetchExchangeBalanceWeightedPct7d,
  type EtfFlowsSummary,
} from "@/lib/data-sources/coinglass"
import { fetchBtcOptionPutCallRatio7d } from "@/lib/data-sources/deribit-options-flow"
import { fetchJson } from "@/lib/data-sources/_fetch"
import { fetchStablecoinMarketCap } from "@/lib/data-sources/defillama"
import { fetchBtcNetworkHashrateRatioTail } from "@/lib/data-sources/mempool-hashrate"
import { getTimeRange } from "@/lib/time-range"

export const revalidate = 60

const REV = 60
const OKX = "https://www.okx.com"
const BTC_INST = "BTC-USDT-SWAP"

interface OkxResponse<T> {
  code: string
  msg?: string
  data?: T[]
}

interface OkxBook {
  bids?: string[][]
  asks?: string[][]
  ts?: string
}

async function okxPublic<T>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${OKX}${path}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      next: { revalidate: REV },
    })
    if (!response.ok) return []
    const payload = (await response.json()) as OkxResponse<T>
    if (payload.code !== "0") return []
    return payload.data ?? []
  } catch {
    return []
  }
}

const normalizeDepthLevels = (rows: string[][] = []) =>
  rows.map((row) => {
    const price = Number(row[0])
    const quantity = Number(row[1])
    return { price, quantity, notional: price * quantity }
  })

const bookMetrics = (book?: OkxBook) => {
  const bids = normalizeDepthLevels(book?.bids)
  const asks = normalizeDepthLevels(book?.asks)
  const bidDepth = bids.reduce((s, level) => s + level.notional, 0)
  const askDepth = asks.reduce((s, level) => s + level.notional, 0)
  const imbalance = bidDepth + askDepth > 0 ? ((bidDepth - askDepth) / (bidDepth + askDepth)) * 100 : 0
  return { imbalance }
}

const parseTwoCol = (rows: string[][]) =>
  rows
    .map((row) => ({ t: Number(row[0]), v: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .reverse()

interface CoinGeckoCoinLite {
  market_data?: {
    ath_change_percentage?: { usd?: number } | number
  }
}

async function fetchCoinGeckoBitcoinAth(): Promise<CoinGeckoCoinLite | null> {
  const key = process.env.COINGECKO_API_KEY?.trim()
  const base =
    typeof key === "string" && key.length > 0 ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3"

  const path =
    `/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false` as const

  return fetchJson<CoinGeckoCoinLite>(`${base}${path}`, {
    revalidate: REV,
    headers:
      typeof key === "string" && key.length > 0 ? { Accept: "application/json", "x-cg-pro-api-key": key } : { Accept: "application/json" },
  })
}

async function fetchDvolClose(): Promise<number | null> {
  const end = Date.now()
  const start = end - 22 * 86_400_000
  const payload = await fetchJson<{ result?: { data?: [number, number, number, number, number][] } }>(
    `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=1D&start_timestamp=${start}&end_timestamp=${end}`,
    { revalidate: REV },
  )
  const rows = payload?.result?.data
  if (!rows?.length) return null
  const last = rows[rows.length - 1]
  const close = last[4]
  return Number.isFinite(close) ? close : null
}

function combineUsdStablePct(usdtPct: number | null, usdcPct: number | null): number | null {
  const pts = [usdtPct, usdcPct].filter((x): x is number => x !== null && Number.isFinite(x))
  if (pts.length === 0) return null
  return pts.reduce((a, b) => a + b, 0) / pts.length
}

export async function GET() {
  const rangeMo = getTimeRange("1mo")
  const cgKey = process.env.COINGLASS_API_KEY?.trim() ?? ""

  const [
    tickerRows,
    fundingRows,
    bookRows,
    oiVolRows,
    lsRows,
    takerRows,
    klineRows,
    stableRaw,
    blockchainBtc,
    cgBtc,
    dvol,
    hashPack,
    putCallRatio,
    etfJob,
    exUsdt,
    exUsdc,
    exBtcPct,
  ] = await Promise.all([
    okxPublic<{ last?: string; open24h?: string; volCcy24h?: string; ts?: string }>(
      `/api/v5/market/ticker?instId=${BTC_INST}`,
    ),
    okxPublic<{ fundingRate?: string; fundingTime?: string }>(`/api/v5/public/funding-rate?instId=${BTC_INST}`),
    okxPublic<OkxBook>(`/api/v5/market/books?instId=${BTC_INST}&sz=20`),
    okxPublic<string[]>(`/api/v5/rubik/stat/contracts/open-interest-volume?ccy=BTC&period=1H`),
    okxPublic<string[]>(`/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=1H`),
    okxPublic<string[]>(`/api/v5/rubik/stat/taker-volume?ccy=BTC&instType=SWAP&period=1H`),
    okxPublic<string[]>(`/api/v5/market/candles?instId=${BTC_INST}&bar=4H&limit=36`),
    fetchStablecoinMarketCap(rangeMo, 1800),
    fetchBtcUsdDailyFromBlockchain("2years", REV),
    fetchCoinGeckoBitcoinAth(),
    fetchDvolClose(),
    fetchBtcNetworkHashrateRatioTail(REV),
    fetchBtcOptionPutCallRatio7d(REV + 120),
    cgKey ? fetchBitcoinEtfFlowHistory(cgKey, REV + 180) : Promise.resolve(null),
    cgKey ? fetchExchangeBalanceWeightedPct7d(cgKey, "USDT(ETH)", REV + 180) : Promise.resolve(null),
    cgKey ? fetchExchangeBalanceWeightedPct7d(cgKey, "USDC", REV + 180) : Promise.resolve(null),
    cgKey ? fetchExchangeBalanceWeightedPct7d(cgKey, "BTC", REV + 180) : Promise.resolve(null),
  ])

  let etfSummary: EtfFlowsSummary | null = null
  let coinGlassEtfError: string | null = null

  if (cgKey && etfJob) {
    if ("error" in etfJob && typeof etfJob.error === "string") coinGlassEtfError = etfJob.error
    else if ("sortedDaysAsc" in etfJob) etfSummary = etfJob as EtfFlowsSummary
  }

  const ticker = tickerRows[0]

  let fundingRatePct: number | null = null
  const fr = fundingRows[0]?.fundingRate
  if (fr !== undefined) {
    const n = Number(fr) * 100
    fundingRatePct = Number.isFinite(n) ? n : null
  }

  const tickerChange =
    ticker?.last && ticker.open24h
      ? Number(ticker.last) === 0
        ? null
        : ((Number(ticker.last) - Number(ticker.open24h)) / Number(ticker.open24h)) * 100
      : null

  const imb = bookMetrics(bookRows[0]).imbalance

  const oiSeries = parseTwoCol(oiVolRows).map((p) => p.v)
  let longShortRatio: number | null = null
  const lsParsed = parseTwoCol(lsRows)
  const lastLs = lsParsed[lsParsed.length - 1]
  if (lastLs?.v !== undefined) longShortRatio = lastLs.v

  const tParsed = takerRows
    .map((row) => ({ buy: Number(row[2]), sell: Number(row[1]) }))
    .filter((p) => Number.isFinite(p.buy) && Number.isFinite(p.sell))
    .reverse()
    .slice(-18)

  let takerNetRecent: number | null = null
  if (tParsed.length >= 8) {
    let sumNet = 0
    let sumVol = 0
    for (const row of tParsed) {
      sumNet += row.buy - row.sell
      sumVol += row.buy + row.sell
    }
    const denom = sumVol > 0 ? sumVol / tParsed.length : 0
    takerNetRecent = denom > 0 ? sumNet / denom : sumNet === 0 ? 0 : null
  }

  const candles = klineRows
    .map((row) => ({ vol: Number(row[5]), close: Number(row[4]) }))
    .filter((c) => Number.isFinite(c.vol))
    .reverse()

  let volumeSpikeRatio: number | null = null
  if (candles.length >= 14) {
    const last = candles[candles.length - 1]
    const prev = candles.slice(0, -1)
    const mean = prev.reduce((s, c) => s + c.vol, 0) / prev.length
    volumeSpikeRatio = mean > 0 ? last.vol / mean : null
  }

  let stablecoinPct7d: number | null = null
  if (stableRaw && stableRaw.history.length >= 8) {
    const h = stableRaw.history
    const oldV = h[h.length - 8].value
    const newV = h[h.length - 1].value
    if (oldV > 0) stablecoinPct7d = ((newV - oldV) / oldV) * 100
  }

  let priceVsSma200GapPct: number | null = null
  const btcPts = blockchainBtc?.points
  if (btcPts && btcPts.length >= 200) {
    const slice = btcPts.slice(-200)
    const sma = slice.reduce((s, p) => s + p.close, 0) / slice.length
    const px = btcPts[btcPts.length - 1]?.close
    if (px !== undefined && sma > 0) priceVsSma200GapPct = ((px - sma) / sma) * 100
  }

  const athRaw = cgBtc?.market_data?.ath_change_percentage
  let athDistancePct: number | null = null
  if (typeof athRaw === "number" && Number.isFinite(athRaw)) athDistancePct = athRaw
  else if (athRaw && typeof athRaw === "object" && "usd" in athRaw && athRaw.usd !== undefined) {
    athDistancePct = athRaw.usd
  }

  const raw: import("@/lib/crypto-regime-score").RawRegimeMetrics = {
    stablecoinPct7d,
    etfAvgDailyUsdLast5: etfSummary?.avgDailyUsdLast5 ?? null,
    etfDailyDeltaVsPriorWeekUsd: etfSummary?.dailyDeltaVsPriorWeekUsd ?? null,
    exchangeStablePct7d: combineUsdStablePct(exUsdt, exUsdc),
    exchangeBtcPct7d: exBtcPct,
    fundingRatePct,
    oiUsdSeries: oiSeries,
    longShortRatio,
    takerNetRecent,
    orderBookImbalancePct: Number.isFinite(imb) ? imb : null,
    priceChange24hPct: tickerChange,
    volumeSpikeRatio,
    priceVsSma200GapPct,
    athDistancePct,
    dvolClose: dvol,
    hashrateRatioTail: hashPack?.ratioLastVsMeanTail ?? null,
    optionPutCallRatio7d: putCallRatio,
  }

  const scored = computeRegimeScore(raw)

  const factorPayload = scored.factors.map((f) => ({
    id: f.id,
    label: f.label,
    score: Math.round(f.score * 10) / 10,
    weighted: Math.round(f.weighted * 100) / 100,
    lines: f.detailLines,
  }))

  return NextResponse.json({
    updatedAt: Date.now(),
    refreshSuggestionSec: 60,
    summary: {
      total: Math.round(scored.total * 10) / 10,
      rawWeighted: Math.round(scored.rawWeighted * 10) / 10,
      band: scored.signalBand,
      signalZh: scored.signalLabelZh,
    },
    penaltiesZh: scored.penaltiesZh,
    boostsZh: scored.boostsZh,
    upstream: {
      coinGlass: {
        configured: Boolean(cgKey),
        etfFetchError: cgKey ? coinGlassEtfError : null,
        hint: cgKey === "" ? "Set COINGLASS_API_KEY for CoinGlass ETF net flows & CEX balance metrics." : null,
      },
      okxRubik: "OKX /api/v5/rubik + market",
      btcIndexSma: "Blockchain Charts market-price · daily",
      hashrate: "mempool.space /api/v1/mining/hashrate/total",
      options: "Deribit DVOL + get_trade_volumes (BTC)",
    },
    weights: {
      capitalFlows: "25%",
      leverage: "25%",
      onchainCycle: "20%",
      marketStructure: "15%",
      options: "15%",
    },
    factors: factorPayload,
  })
}
