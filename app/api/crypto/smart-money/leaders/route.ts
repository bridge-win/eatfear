import { NextResponse } from "next/server"

export const revalidate = 60

/**
 * Copy-trading leaderboard, multi-venue.
 *
 * Every source here reports exchange-settled performance (PnL, ROI, win
 * ratio, AUM, copier counts) — settled from real fills, so unlike social
 * leaderboards the numbers cannot be self-reported.
 *
 * - OKX: official public copy-trading API. Stable, supports per-trader
 *   drill-down (stats / pnl curve / current positions).
 * - Binance: public lead-trading portfolio list used by the copy-trading
 *   web UI. Best-effort (undocumented) — normalized into the same shape and
 *   degraded gracefully to an empty list if the endpoint changes or blocks.
 *
 * Each adapter fails closed to `[]`, so one venue being down never breaks the
 * page.
 */

const OKX = "https://www.okx.com"
const BINANCE_WEB = "https://www.binance.com"

const SOURCES = new Set(["okx", "binance"])
const OKX_SORT_TYPES = new Set(["overview", "pnl", "aum", "win_ratio", "pnl_ratio"])

interface NormalizedTrader {
  uniqueCode: string
  source: "okx" | "binance"
  nickName: string
  avatar: string | null
  pnl: number | null
  pnlRatio: number | null
  winRatio: number | null
  aum: number | null
  leadDays: number | null
  copyTraderNum: number | null
  maxCopyTraderNum: number | null
  instruments: string[]
  pnlSparkline: { time: number; value: number }[]
  hasDetail: boolean
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// --- OKX adapter -----------------------------------------------------------

interface OkxLeaderRank {
  uniqueCode?: string
  nickName?: string
  portLink?: string
  pnl?: string
  pnlRatio?: string
  winRatio?: string
  aum?: string
  leadDays?: string
  copyTraderNum?: string
  maxCopyTraderNum?: string
  traderInsts?: string[]
  pnlRatios?: { beginTs?: string; pnlRatio?: string }[]
}

interface OkxLeadersPayload {
  code?: string
  data?: { totalPage?: string; ranks?: OkxLeaderRank[] }[]
}

const fetchOkx = async (sort: string, page: number): Promise<{ traders: NormalizedTrader[]; totalPage: number }> => {
  const sortType = OKX_SORT_TYPES.has(sort) ? sort : "pnl"
  try {
    const response = await fetch(
      `${OKX}/api/v5/copytrading/public-lead-traders?instType=SWAP&sortType=${sortType}&page=${page}&limit=20`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, next: { revalidate } },
    )
    if (!response.ok) return { traders: [], totalPage: 0 }
    const payload = (await response.json()) as OkxLeadersPayload
    if (payload.code !== "0" || !Array.isArray(payload.data) || payload.data.length === 0) {
      return { traders: [], totalPage: 0 }
    }
    const entry = payload.data[0]
    const traders = (entry.ranks ?? [])
      .filter((rank) => typeof rank.uniqueCode === "string" && rank.uniqueCode.length > 0)
      .map<NormalizedTrader>((rank) => ({
        uniqueCode: rank.uniqueCode as string,
        source: "okx",
        nickName: rank.nickName ?? "—",
        avatar: rank.portLink ?? null,
        pnl: num(rank.pnl),
        pnlRatio: num(rank.pnlRatio),
        winRatio: num(rank.winRatio),
        aum: num(rank.aum),
        leadDays: num(rank.leadDays),
        copyTraderNum: num(rank.copyTraderNum),
        maxCopyTraderNum: num(rank.maxCopyTraderNum),
        instruments: Array.isArray(rank.traderInsts) ? rank.traderInsts.slice(0, 6) : [],
        pnlSparkline: (rank.pnlRatios ?? [])
          .map((point) => ({ time: num(point.beginTs), value: num(point.pnlRatio) }))
          .filter((point): point is { time: number; value: number } => point.time !== null && point.value !== null)
          .sort((a, b) => a.time - b.time),
        hasDetail: true,
      }))
    return { traders, totalPage: num(entry.totalPage) ?? 1 }
  } catch {
    return { traders: [], totalPage: 0 }
  }
}

// --- Binance adapter (best-effort, undocumented) ---------------------------

const BINANCE_SORT: Record<string, string> = {
  overview: "PNL",
  pnl: "PNL",
  pnl_ratio: "ROI",
  win_ratio: "PNL",
  aum: "AUM",
}

interface BinanceLeadItem {
  leadPortfolioId?: string | number
  nickname?: string
  avatarUrl?: string
  roi?: string | number
  pnl?: string | number
  aumAmount?: string | number
  currentCopyCount?: string | number
  maxCopyCount?: string | number
  favoriteCount?: string | number
}

interface BinanceLeadPayload {
  code?: string
  data?: { list?: BinanceLeadItem[]; total?: number }
}

const fetchBinance = async (sort: string): Promise<{ traders: NormalizedTrader[]; totalPage: number }> => {
  try {
    const response = await fetch(
      `${BINANCE_WEB}/bapi/futures/v1/friendly/future/copy-trade/home-page/query-list`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        body: JSON.stringify({
          dataType: "ROI",
          favoriteFilter: false,
          hideFull: false,
          nickname: "",
          order: "DESC",
          pageNumber: 1,
          pageSize: 20,
          periodType: "90D",
          portfolioType: "PORTFOLIO_TYPE_ALL",
          sortType: BINANCE_SORT[sort] ?? "PNL",
          timeRange: "90D",
        }),
        cache: "no-store",
      },
    )
    if (!response.ok) return { traders: [], totalPage: 0 }
    const payload = (await response.json()) as BinanceLeadPayload
    const list = payload.data?.list
    if (!Array.isArray(list) || list.length === 0) return { traders: [], totalPage: 0 }
    const traders = list
      .filter((item) => item.leadPortfolioId !== undefined && item.leadPortfolioId !== null)
      .map<NormalizedTrader>((item) => ({
        uniqueCode: String(item.leadPortfolioId),
        source: "binance",
        nickName: item.nickname ?? "—",
        avatar: item.avatarUrl ?? null,
        pnl: num(item.pnl),
        pnlRatio: num(item.roi),
        winRatio: null,
        aum: num(item.aumAmount),
        leadDays: null,
        copyTraderNum: num(item.currentCopyCount),
        maxCopyTraderNum: num(item.maxCopyCount),
        instruments: [],
        pnlSparkline: [],
        hasDetail: false,
      }))
    return { traders, totalPage: 1 }
  } catch {
    return { traders: [], totalPage: 0 }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const sourceRaw = url.searchParams.get("source") ?? "okx"
  const source = SOURCES.has(sourceRaw) ? (sourceRaw as "okx" | "binance") : "okx"
  const sort = url.searchParams.get("sort") ?? "pnl"
  const pageRaw = Number(url.searchParams.get("page") ?? "1")
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 50 ? pageRaw : 1

  const result = source === "binance" ? await fetchBinance(sort) : await fetchOkx(sort, page)

  if (result.traders.length === 0) {
    return NextResponse.json(
      { error: `${source} copy-trading leaderboard unavailable`, source, sort, page, totalPage: 0, traders: [] },
      { status: 502 },
    )
  }

  return NextResponse.json({
    source,
    sort,
    page,
    totalPage: result.totalPage,
    traders: result.traders,
    updatedAt: Date.now(),
  })
}
