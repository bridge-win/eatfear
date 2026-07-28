import { NextResponse } from "next/server"

export const revalidate = 300

/**
 * Capital-authenticity verification.
 *
 * The positioning / flow signals on this page can, in principle, be gamed to
 * bait retail. This route cross-checks them against independent, hard-to-fake
 * data so a user can tell real conviction from an inducement trap:
 *
 * - Funding rate (OKX): a real recurring cost. Extreme funding on the crowded
 *   side flags a squeeze / trap rather than durable positioning.
 * - Open interest (OKX Rubik): rising OI = fresh capital committed; falling OI
 *   under a "bullish" signal = unwind / hollow move.
 * - Cross-venue consistency: OKX vs Binance retail long% — two independent
 *   venues agreeing is far harder to fake than one.
 * - On-chain anchor: Hyperliquid positions (tracked below) are settled
 *   on-chain and provide an independent public-state cross-check. Address
 *   ownership, intent, and external hedges remain outside this evidence.
 *
 * Every upstream fails closed, so partial data still yields a useful verdict.
 */

const OKX = "https://www.okx.com"
const BINANCE_FAPI = "https://fapi.binance.com"

const SUPPORTED_CCY = /^[A-Z0-9]{2,10}$/
const FUNDING_EXTREME = 0.0005 // 0.05% per interval — crowded / squeeze territory
const CONSISTENT_SPREAD_PP = 8

type CheckStatus = "pass" | "warn" | "fail" | "info"

const sanitizeCcy = (raw: string | null) => {
  if (!raw) return "BTC"
  const cleaned = raw.toUpperCase().trim()
  return SUPPORTED_CCY.test(cleaned) ? cleaned : "BTC"
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const fetchJsonSafe = async <T>(url: string, init?: RequestInit): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate },
      ...init,
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

interface OkxFundingResponse {
  code?: string
  data?: { fundingRate?: string; fundingTime?: string }[]
}

interface OkxOiResponse {
  code?: string
  data?: [string, string, string][]
}

interface OkxRatioResponse {
  code?: string
  data?: [string, string][]
}

interface BinanceRatioRow {
  longAccount?: string
  longShortRatio?: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const instId = `${ccy}-USDT-SWAP`

  const [funding, oi, okxRatio, binanceRatio] = await Promise.all([
    fetchJsonSafe<OkxFundingResponse>(
      `${OKX}/api/v5/public/funding-rate-history?instId=${instId}&limit=100`,
    ),
    fetchJsonSafe<OkxOiResponse>(
      `${OKX}/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=1D&limit=60`,
    ),
    fetchJsonSafe<OkxRatioResponse>(
      `${OKX}/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1D&limit=1`,
    ),
    fetchJsonSafe<BinanceRatioRow[]>(
      `${BINANCE_FAPI}/futures/data/globalLongShortAccountRatio?symbol=${ccy}USDT&period=1d&limit=1`,
    ),
  ])

  // --- Funding -------------------------------------------------------------
  const fundingHistory = (funding?.code === "0" ? funding.data ?? [] : [])
    .map((row) => ({ time: num(row.fundingTime), rate: num(row.fundingRate) }))
    .filter((row): row is { time: number; rate: number } => row.time !== null && row.rate !== null)
    .sort((a, b) => a.time - b.time)
  const fundingCurrent = fundingHistory.length > 0 ? fundingHistory[fundingHistory.length - 1].rate : null
  const fundingAvg =
    fundingHistory.length > 0
      ? fundingHistory.reduce((sum, row) => sum + row.rate, 0) / fundingHistory.length
      : null
  const fundingExtreme = fundingCurrent !== null && Math.abs(fundingCurrent) > FUNDING_EXTREME

  // --- Open interest -------------------------------------------------------
  const oiHistory = (oi?.code === "0" ? oi.data ?? [] : [])
    .map((row) => ({ time: num(row[0]), oi: num(row[1]), vol: num(row[2]) }))
    .filter((row): row is { time: number; oi: number; vol: number } => row.time !== null && row.oi !== null)
    .sort((a, b) => a.time - b.time)
  const oiFirst = oiHistory.length > 0 ? oiHistory[0].oi : null
  const oiLatest = oiHistory.length > 0 ? oiHistory[oiHistory.length - 1].oi : null
  const oiChangePct = oiFirst && oiFirst !== 0 && oiLatest !== null ? (oiLatest / oiFirst - 1) * 100 : null

  // --- Cross-venue consistency --------------------------------------------
  const okxRatioValue = okxRatio?.code === "0" && okxRatio.data?.[0] ? num(okxRatio.data[0][1]) : null
  const okxLongPct = okxRatioValue !== null && okxRatioValue >= 0 ? (okxRatioValue / (1 + okxRatioValue)) * 100 : null
  const binanceRow = Array.isArray(binanceRatio) && binanceRatio.length > 0 ? binanceRatio[0] : null
  const binanceLong = binanceRow ? num(binanceRow.longAccount) : null
  const binanceRatioVal = binanceRow ? num(binanceRow.longShortRatio) : null
  const binanceLongPct =
    binanceLong !== null && binanceLong > 0 && binanceLong < 1
      ? binanceLong * 100
      : binanceRatioVal !== null && binanceRatioVal >= 0
        ? (binanceRatioVal / (1 + binanceRatioVal)) * 100
        : null
  const crossSpread = okxLongPct !== null && binanceLongPct !== null ? Math.abs(okxLongPct - binanceLongPct) : null

  // --- Checks --------------------------------------------------------------
  const crossStatus: CheckStatus =
    crossSpread === null ? "warn" : crossSpread <= CONSISTENT_SPREAD_PP ? "pass" : crossSpread <= 15 ? "warn" : "fail"
  const fundingStatus: CheckStatus = fundingCurrent === null ? "warn" : fundingExtreme ? "warn" : "pass"
  const oiStatus: CheckStatus =
    oiChangePct === null ? "warn" : oiChangePct >= 2 ? "pass" : oiChangePct <= -5 ? "warn" : "info"

  const checks: { id: string; status: CheckStatus }[] = [
    { id: "crossVenue", status: crossStatus },
    { id: "funding", status: fundingStatus },
    { id: "openInterest", status: oiStatus },
    { id: "onchain", status: "info" },
  ]

  return NextResponse.json({
    sources: [
      "OKX funding-rate-history",
      "OKX Rubik open-interest-volume",
      "OKX / Binance retail long-short account ratio",
    ],
    ccy,
    instId,
    funding: {
      current: fundingCurrent,
      avg: fundingAvg,
      extreme: fundingExtreme,
      history: fundingHistory,
    },
    openInterest: {
      latest: oiLatest,
      changePct: oiChangePct,
      history: oiHistory,
    },
    crossVenue: {
      okxLongPct,
      binanceLongPct,
      spread: crossSpread,
      consistent: crossStatus === "pass",
    },
    checks,
    updatedAt: Date.now(),
  })
}
