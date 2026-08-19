import { NextResponse } from "next/server"

import { buildOrderBookDepthSnapshot } from "@/lib/crypto-quant-features"
import { createAdminClient } from "@/lib/supabase/admin"

export const revalidate = 0

const OKX_BASE_URL = "https://www.okx.com"
const DEFAULT_INST_ID = "BTC-USDT-SWAP"
const COLLECTOR_BARS = ["5m", "1H", "1D"] as const

interface OkxResponse<T> {
  code: string | number
  msg?: string
  data?: T[]
}

interface OkxOrderBook {
  bids?: string[][]
  asks?: string[][]
  ts?: string
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

interface CandleRow {
  inst_id: string
  bar: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  quote_volume: number
  source: string
}

interface MarketSnapshotRow {
  inst_id: string
  timestamp: string
  best_bid: number
  best_ask: number
  spread_pct: number
  bid_depth_01_usd: number
  ask_depth_01_usd: number
  bid_depth_05_usd: number
  ask_depth_05_usd: number
  bid_depth_1_usd: number
  ask_depth_1_usd: number
  orderbook_imbalance_pct: number
  open_interest_usd: number | null
  funding_rate_pct: number | null
  buy_volume: number | null
  sell_volume: number | null
  volume_delta: number | null
  long_liquidation_usd: number | null
  short_liquidation_usd: number | null
  source: string
}

interface OkxLiquidationGroup {
  instId: string
  details?: Array<{
    posSide: "long" | "short"
    bkPx: string
    sz: string
    ts: string
  }>
}

const SWAP_CT_VAL_BY_BASE: Readonly<Record<string, number>> = {
  BTC: 0.01,
  ETH: 0.01,
  SOL: 0.1,
  XRP: 100,
  BNB: 0.01,
  DOGE: 1000,
}

function sanitizeInstId(raw: string | null): string {
  if (!raw) return DEFAULT_INST_ID
  const cleaned = raw.toUpperCase().trim()
  return /^[A-Z0-9]+-USDT-SWAP$/.test(cleaned) ? cleaned : DEFAULT_INST_ID
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRYPTO_COLLECTOR_SECRET ?? process.env.CRON_SECRET
  if (!secret && process.env.NODE_ENV !== "production") return true
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

async function okxFetch<T>(path: string): Promise<T[]> {
  const response = await fetch(`${OKX_BASE_URL}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) return []
  const payload = (await response.json()) as OkxResponse<T>
  if (String(payload.code) !== "0") return []
  return payload.data ?? []
}

function normalizeDepth(levels: string[][] | undefined): Array<{ price: number; quantity: number }> {
  return (levels ?? [])
    .map((row) => ({ price: Number(row[0]), quantity: Number(row[1]) }))
    .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.quantity) && row.price > 0 && row.quantity >= 0)
}

function normalizeCandleRows(instId: string, bar: string, rows: string[][]): CandleRow[] {
  return rows
    .map((row) => {
      const timestamp = Number(row[0])
      const open = Number(row[1])
      const high = Number(row[2])
      const low = Number(row[3])
      const close = Number(row[4])
      const volume = Number(row[5])
      const quoteVolume = Number(row[7]) || volume * close
      return {
        inst_id: instId,
        bar,
        timestamp: new Date(timestamp).toISOString(),
        open,
        high,
        low,
        close,
        volume,
        quote_volume: quoteVolume,
        source: "OKX",
      }
    })
    .filter((row) => Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close))
}

function liquidationTotals(instId: string, groups: OkxLiquidationGroup[]): { long: number; short: number } {
  const base = instId.split("-")[0] ?? "BTC"
  const ctVal = SWAP_CT_VAL_BY_BASE[base] ?? 0.01
  const cutoffMs = Date.now() - 10 * 60_000
  let long = 0
  let short = 0
  for (const group of groups) {
    for (const detail of group.details ?? []) {
      const timestamp = Number(detail.ts)
      const price = Number(detail.bkPx)
      const size = Number(detail.sz)
      if (!Number.isFinite(timestamp) || timestamp < cutoffMs || !Number.isFinite(price) || !Number.isFinite(size)) continue
      const notional = price * size * ctVal
      if (detail.posSide === "long") {
        long += notional
      } else {
        short += notional
      }
    }
  }
  return { long, short }
}

async function collect(instId: string): Promise<{ candles: number; snapshot: boolean }> {
  const supabase = createAdminClient()
  if (!supabase) return { candles: 0, snapshot: false }

  const ccy = instId.split("-")[0] ?? "BTC"
  const [bookRows, openInterestRows, fundingRows, takerRows, liquidationRows, ...candleGroups] = await Promise.all([
    okxFetch<OkxOrderBook>(`/api/v5/market/books?instId=${instId}&sz=400`),
    okxFetch<OkxOpenInterest>(`/api/v5/public/open-interest?instType=SWAP&instId=${instId}`),
    okxFetch<OkxFundingRate>(`/api/v5/public/funding-rate?instId=${instId}`),
    okxFetch<string[]>(`/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SWAP&period=5m&limit=2`),
    okxFetch<OkxLiquidationGroup>(`/api/v5/public/liquidation-orders?instType=SWAP&instId=${instId}&state=filled&limit=100`),
    ...COLLECTOR_BARS.map((bar) => okxFetch<string[]>(`/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=3`)),
  ])

  const candles = candleGroups.flatMap((rows, index) => normalizeCandleRows(instId, COLLECTOR_BARS[index], rows))
  if (candles.length > 0) {
    await supabase.from("crypto_candles").upsert(candles, { onConflict: "inst_id,bar,timestamp" })
  }

  const book = bookRows[0]
  const bookSnapshot = buildOrderBookDepthSnapshot({
    timestamp: Number(book?.ts) || Date.now(),
    bids: normalizeDepth(book?.bids),
    asks: normalizeDepth(book?.asks),
  })
  if (!bookSnapshot) return { candles: candles.length, snapshot: false }

  const taker = takerRows[0]
  const sellVolume = taker ? Number(taker[1]) : null
  const buyVolume = taker ? Number(taker[2]) : null
  const liquidations = liquidationTotals(instId, liquidationRows)
  const snapshot: MarketSnapshotRow = {
    inst_id: instId,
    timestamp: new Date(bookSnapshot.spread.timestamp).toISOString(),
    best_bid: bookSnapshot.bestBid.value,
    best_ask: bookSnapshot.bestAsk.value,
    spread_pct: bookSnapshot.spread.value,
    bid_depth_01_usd: bookSnapshot.bidDepth01.value,
    ask_depth_01_usd: bookSnapshot.askDepth01.value,
    bid_depth_05_usd: bookSnapshot.bidDepth05.value,
    ask_depth_05_usd: bookSnapshot.askDepth05.value,
    bid_depth_1_usd: bookSnapshot.bidDepth1.value,
    ask_depth_1_usd: bookSnapshot.askDepth1.value,
    orderbook_imbalance_pct: bookSnapshot.orderbookImbalance.value,
    open_interest_usd: Number(openInterestRows[0]?.oiUsd ?? Number.NaN) || null,
    funding_rate_pct: Number(fundingRows[0]?.fundingRate ?? Number.NaN) * 100 || null,
    buy_volume: buyVolume,
    sell_volume: sellVolume,
    volume_delta: buyVolume !== null && sellVolume !== null ? buyVolume - sellVolume : null,
    long_liquidation_usd: liquidations.long,
    short_liquidation_usd: liquidations.short,
    source: "OKX",
  }

  const { error } = await supabase.from("crypto_market_snapshots").upsert(snapshot, { onConflict: "inst_id,timestamp" })
  return { candles: candles.length, snapshot: !error }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  const instId = sanitizeInstId(url.searchParams.get("instId"))
  const result = await collect(instId)
  return NextResponse.json({ source: "OKX", instId, ...result, updatedAt: Date.now() })
}

export async function POST(request: Request) {
  return GET(request)
}
