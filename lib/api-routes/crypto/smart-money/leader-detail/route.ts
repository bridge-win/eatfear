import { NextResponse } from "next/server"
import { ratioToPercentagePoints } from "@/lib/smart-money/normalize"

export const revalidate = 300

/**
 * Drill-down for a single OKX lead trader: 30-day stats, 90-day daily PnL
 * ratio curve, and the positions currently held for copiers. All public
 * copy-trading endpoints, no auth.
 */

const OKX = "https://www.okx.com"

const UNIQUE_CODE = /^[A-Z0-9]{1,32}$/

// OKX public-stats / public-pnl accept a lastDays bucket, not an arbitrary
// window — map the dashboard range to the nearest supported bucket.
const resolveLastDays = (range: string | null): { lastDays: string; days: number } => {
  switch (range) {
    case "1d":
    case "5d":
      return { lastDays: "1", days: 7 }
    case "1mo":
      return { lastDays: "2", days: 30 }
    default:
      return { lastDays: "3", days: 90 }
  }
}

interface OkxEnvelope<T> {
  code?: string
  data?: T[]
}

const okxFetchSafe = async <T>(path: string): Promise<T[]> => {
  try {
    const response = await fetch(`${OKX}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate },
    })
    if (!response.ok) return []
    const payload = (await response.json()) as OkxEnvelope<T>
    if (payload.code !== "0" || !Array.isArray(payload.data)) return []
    return payload.data
  } catch {
    return []
  }
}

const num = (value: string | undefined): number | null => {
  // Number("") coerces to 0 — treat absent upstream values as null
  if (value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

interface OkxStatsRow {
  ccy?: string
  winRatio?: string
  profitDays?: string
  lossDays?: string
  curCopyTraderPnl?: string
  investAmt?: string
  avgSubPosNotional?: string
}

interface OkxPnlRow {
  beginTs?: string
  pnl?: string
  pnlRatio?: string
}

interface OkxSubPositionRow {
  instId?: string
  posSide?: string
  lever?: string
  openAvgPx?: string
  markPx?: string
  margin?: string
  upl?: string
  uplRatio?: string
  openTime?: string
  ccy?: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const uniqueCodeRaw = (url.searchParams.get("uniqueCode") ?? "").toUpperCase().trim()
  if (!UNIQUE_CODE.test(uniqueCodeRaw)) {
    return NextResponse.json({ error: "invalid uniqueCode" }, { status: 400 })
  }
  const code = encodeURIComponent(uniqueCodeRaw)
  const { lastDays, days } = resolveLastDays(url.searchParams.get("range"))

  const [statsRows, pnlRows, positionRows] = await Promise.all([
    okxFetchSafe<OkxStatsRow>(`/api/v5/copytrading/public-stats?instType=SWAP&uniqueCode=${code}&lastDays=${lastDays}`),
    okxFetchSafe<OkxPnlRow>(`/api/v5/copytrading/public-pnl?instType=SWAP&uniqueCode=${code}&lastDays=${lastDays}`),
    okxFetchSafe<OkxSubPositionRow>(
      `/api/v5/copytrading/public-current-subpositions?instType=SWAP&uniqueCode=${code}&limit=10`,
    ),
  ])

  const statsRow = statsRows[0]
  const stats = statsRow
    ? {
        ccy: statsRow.ccy ?? "USDT",
        winRatio: ratioToPercentagePoints(statsRow.winRatio),
        profitDays: num(statsRow.profitDays),
        lossDays: num(statsRow.lossDays),
        copierPnl: num(statsRow.curCopyTraderPnl),
        investAmount: num(statsRow.investAmt),
        avgPositionNotional: num(statsRow.avgSubPosNotional),
      }
    : null

  const pnlSeries = pnlRows
    .map((row) => ({ time: num(row.beginTs), pnl: num(row.pnl), pnlRatio: ratioToPercentagePoints(row.pnlRatio) }))
    .filter((row): row is { time: number; pnl: number | null; pnlRatio: number | null } => row.time !== null)
    .sort((a, b) => a.time - b.time)

  const positions = positionRows
    .filter((row) => typeof row.instId === "string" && row.instId.length > 0)
    .map((row) => ({
      instId: row.instId as string,
      posSide: row.posSide === "short" ? "short" : "long",
      leverage: num(row.lever),
      openAvgPx: num(row.openAvgPx),
      markPx: num(row.markPx),
      margin: num(row.margin),
      upl: num(row.upl),
      uplRatio: ratioToPercentagePoints(row.uplRatio),
      openTime: num(row.openTime),
      ccy: row.ccy ?? "USDT",
    }))

  return NextResponse.json({
    source: "OKX Copy Trading public stats / pnl / subpositions",
    uniqueCode: uniqueCodeRaw,
    windowDays: days,
    stats,
    pnlSeries,
    positions,
    updatedAt: Date.now(),
  })
}
