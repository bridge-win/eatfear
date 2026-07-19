import { NextResponse } from "next/server"

export const revalidate = 60

/**
 * OKX Copy Trading public lead-trader leaderboard.
 *
 * Exchange-audited performance (PnL, win ratio, AUM, copier counts) — unlike
 * social leaderboards these numbers come from settled trades and cannot be
 * self-reported. Public endpoint, no auth. Page size is capped at 20 by OKX.
 */

const OKX = "https://www.okx.com"

const SORT_TYPES = new Set(["overview", "pnl", "aum", "win_ratio", "pnl_ratio"])

interface OkxLeaderRank {
  uniqueCode?: string
  nickName?: string
  portLink?: string
  ccy?: string
  pnl?: string
  pnlRatio?: string
  winRatio?: string
  aum?: string
  leadDays?: string
  copyTraderNum?: string
  maxCopyTraderNum?: string
  accCopyTraderNum?: string
  copyState?: string
  traderInsts?: string[]
  pnlRatios?: { beginTs?: string; pnlRatio?: string }[]
}

interface OkxLeadersPayload {
  code?: string
  data?: { dataVer?: string; totalPage?: string; ranks?: OkxLeaderRank[] }[]
}

const num = (value: string | undefined): number | null => {
  // Number("") coerces to 0 — treat absent upstream values as null
  if (value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sortRaw = url.searchParams.get("sort") ?? "pnl"
  const sortType = SORT_TYPES.has(sortRaw) ? sortRaw : "pnl"
  const pageRaw = Number(url.searchParams.get("page") ?? "1")
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 50 ? pageRaw : 1

  let payload: OkxLeadersPayload | null = null
  try {
    const response = await fetch(
      `${OKX}/api/v5/copytrading/public-lead-traders?instType=SWAP&sortType=${sortType}&page=${page}&limit=20`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        next: { revalidate },
      },
    )
    if (response.ok) payload = (await response.json()) as OkxLeadersPayload
  } catch {
    payload = null
  }

  if (!payload || payload.code !== "0" || !Array.isArray(payload.data) || payload.data.length === 0) {
    return NextResponse.json(
      { error: "OKX copy-trading leaderboard unavailable", traders: [], totalPage: 0 },
      { status: 502 },
    )
  }

  const entry = payload.data[0]
  const traders = (entry.ranks ?? [])
    .filter((rank) => typeof rank.uniqueCode === "string" && rank.uniqueCode.length > 0)
    .map((rank) => ({
      uniqueCode: rank.uniqueCode as string,
      nickName: rank.nickName ?? "—",
      avatar: rank.portLink ?? null,
      ccy: rank.ccy ?? "USDT",
      pnl: num(rank.pnl),
      pnlRatio: num(rank.pnlRatio),
      winRatio: num(rank.winRatio),
      aum: num(rank.aum),
      leadDays: num(rank.leadDays),
      copyTraderNum: num(rank.copyTraderNum),
      maxCopyTraderNum: num(rank.maxCopyTraderNum),
      accCopyTraderNum: num(rank.accCopyTraderNum),
      instruments: Array.isArray(rank.traderInsts) ? rank.traderInsts.slice(0, 6) : [],
      pnlSparkline: (rank.pnlRatios ?? [])
        .map((point) => ({ time: num(point.beginTs), value: num(point.pnlRatio) }))
        .filter((point): point is { time: number; value: number } => point.time !== null && point.value !== null)
        .sort((a, b) => a.time - b.time),
    }))

  return NextResponse.json({
    source: "OKX Copy Trading public lead traders",
    sort: sortType,
    page,
    totalPage: num(entry.totalPage) ?? 1,
    traders,
    updatedAt: Date.now(),
  })
}
