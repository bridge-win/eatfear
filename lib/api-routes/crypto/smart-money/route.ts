import { NextResponse } from "next/server"
import { DEFAULT_TIME_RANGE, getTimeRange } from "@/lib/time-range"

export const revalidate = 60

/**
 * Smart Money tracker.
 *
 * Uses OKX Rubik *taker-volume* — aggressive market-order flow split into
 * buy-side and sell-side notional. We re-bucket the points to the selected
 * range and surface the cumulative + per-bucket totals. Taker imbalance over
 * longer horizons is a reasonable proxy for institutional / large-trader
 * positioning ("smart money"), since passive flow tends to net out.
 */

const OKX = "https://www.okx.com"

interface OkxResponse<T> {
  code: string
  msg?: string
  data?: T[]
}

const okxFetchSafe = async <T>(path: string): Promise<T[]> => {
  try {
    const response = await fetch(`${OKX}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate },
    })
    if (!response.ok) return []
    const payload = (await response.json()) as OkxResponse<T>
    if (payload.code !== "0") return []
    return payload.data ?? []
  } catch {
    return []
  }
}

const RUBIK_PERIODS = new Set(["5m", "15m", "30m", "1H", "4H", "1D"])

const sanitizeCcy = (raw: string | null) => {
  if (!raw) return "BTC"
  const cleaned = raw.toUpperCase().trim()
  if (!/^[A-Z0-9]+$/.test(cleaned)) return "BTC"
  return cleaned
}

interface SmartMoneyBucket {
  time: number
  buy: number
  sell: number
  net: number
  cumulativeNet: number
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = sanitizeCcy(url.searchParams.get("ccy"))
  const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
  const rubikPeriod = RUBIK_PERIODS.has(range.okxBar) ? range.okxBar : "1D"
  const limit = Math.max(60, Math.min(720, range.okxLimit))

  const [swapRows, spotRows] = await Promise.all([
    okxFetchSafe<string[]>(
      `/api/v5/rubik/stat/taker-volume?ccy=${encodeURIComponent(ccy)}&instType=SWAP&period=${rubikPeriod}&limit=${limit}`,
    ),
    okxFetchSafe<string[]>(
      `/api/v5/rubik/stat/taker-volume?ccy=${encodeURIComponent(ccy)}&instType=SPOT&period=${rubikPeriod}&limit=${limit}`,
    ),
  ])

  const normalize = (rows: string[][]) =>
    rows
      .map((row) => ({
        time: Number(row[0]),
        sell: Number(row[1]),
        buy: Number(row[2]),
      }))
      .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.buy) && Number.isFinite(row.sell))
      .reverse()

  const swap = normalize(swapRows)
  const spot = normalize(spotRows)

  // Merge by time bucket — sum SWAP + SPOT
  const merged = new Map<number, { buy: number; sell: number }>()
  for (const row of swap) {
    const entry = merged.get(row.time) ?? { buy: 0, sell: 0 }
    entry.buy += row.buy
    entry.sell += row.sell
    merged.set(row.time, entry)
  }
  for (const row of spot) {
    const entry = merged.get(row.time) ?? { buy: 0, sell: 0 }
    entry.buy += row.buy
    entry.sell += row.sell
    merged.set(row.time, entry)
  }

  const buckets: SmartMoneyBucket[] = Array.from(merged.entries())
    .sort((a, b) => a[0] - b[0])
    .reduce<SmartMoneyBucket[]>((acc, [time, value]) => {
      const net = value.buy - value.sell
      const prevCum = acc.length > 0 ? acc[acc.length - 1].cumulativeNet : 0
      acc.push({ time, buy: value.buy, sell: value.sell, net, cumulativeNet: prevCum + net })
      return acc
    }, [])

  const buyTotal = buckets.reduce((s, b) => s + b.buy, 0)
  const sellTotal = buckets.reduce((s, b) => s + b.sell, 0)
  const netTotal = buyTotal - sellTotal

  return NextResponse.json({
    source: "OKX Rubik taker-volume (SWAP + SPOT)",
    ccy,
    range: range.id,
    period: rubikPeriod,
    buckets,
    totals: {
      buy: buyTotal,
      sell: sellTotal,
      net: netTotal,
      ratio: sellTotal > 0 ? buyTotal / sellTotal : null,
    },
    updatedAt: Date.now(),
  })
}
