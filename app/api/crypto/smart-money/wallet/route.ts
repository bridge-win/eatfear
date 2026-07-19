import { NextResponse } from "next/server"

/**
 * Hyperliquid on-chain wallet tracker.
 *
 * The public /info endpoint exposes any wallet's live perp positions
 * (clearinghouseState) and PnL history (portfolio) — the same data the
 * well-known smart-money trackers read. POST requests bypass the Next data
 * cache, which is what we want for live positions.
 */

const HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info"

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

const hlFetch = async <T>(body: Record<string, string>): Promise<T | null> => {
  try {
    const response = await fetch(HYPERLIQUID_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

const num = (value: unknown): number | null => {
  // Number(null) and Number("") coerce to 0 — treat absent upstream values as null
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

interface HlPosition {
  coin?: string
  szi?: string
  entryPx?: string
  positionValue?: string
  unrealizedPnl?: string
  returnOnEquity?: string
  liquidationPx?: string | null
  marginUsed?: string
  leverage?: { type?: string; value?: number }
}

interface HlClearinghouseState {
  assetPositions?: { position?: HlPosition }[]
  marginSummary?: { accountValue?: string; totalNtlPos?: string; totalMarginUsed?: string }
  withdrawable?: string
  time?: number
}

interface HlPortfolioBucket {
  accountValueHistory?: [number, string][]
  pnlHistory?: [number, string][]
  vlm?: string
}

type HlPortfolio = [string, HlPortfolioBucket][]

const PNL_PERIODS = ["day", "week", "month", "allTime"] as const

export async function GET(request: Request) {
  const url = new URL(request.url)
  const address = (url.searchParams.get("address") ?? "").trim()
  if (!ADDRESS.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 })
  }

  const [state, portfolio] = await Promise.all([
    hlFetch<HlClearinghouseState>({ type: "clearinghouseState", user: address }),
    hlFetch<HlPortfolio>({ type: "portfolio", user: address }),
  ])

  if (!state) {
    return NextResponse.json({ error: "Hyperliquid API unavailable" }, { status: 502 })
  }

  const positions = (state.assetPositions ?? [])
    .map((entry) => entry.position)
    .filter((position): position is HlPosition => Boolean(position?.coin))
    .map((position) => {
      const size = num(position.szi) ?? 0
      return {
        coin: position.coin as string,
        side: size >= 0 ? "long" : "short",
        size: Math.abs(size),
        entryPx: num(position.entryPx),
        notional: num(position.positionValue),
        unrealizedPnl: num(position.unrealizedPnl),
        returnOnEquity: num(position.returnOnEquity),
        liquidationPx: num(position.liquidationPx),
        marginUsed: num(position.marginUsed),
        leverage: num(position.leverage?.value),
        leverageType: position.leverage?.type ?? null,
      }
    })

  const pnl: Record<string, { pnl: number | null; volume: number | null }> = {}
  if (Array.isArray(portfolio)) {
    for (const [period, bucket] of portfolio) {
      if (!(PNL_PERIODS as readonly string[]).includes(period)) continue
      const history = Array.isArray(bucket?.pnlHistory) ? bucket.pnlHistory : []
      const last = history.length > 0 ? history[history.length - 1] : null
      pnl[period] = { pnl: last ? num(last[1]) : null, volume: num(bucket?.vlm) }
    }
  }

  return NextResponse.json({
    source: "Hyperliquid /info clearinghouseState + portfolio",
    address,
    equity: num(state.marginSummary?.accountValue),
    notional: num(state.marginSummary?.totalNtlPos),
    marginUsed: num(state.marginSummary?.totalMarginUsed),
    withdrawable: num(state.withdrawable),
    pnl,
    positions,
    updatedAt: Date.now(),
  })
}
