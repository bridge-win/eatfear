const OKX = "https://www.okx.com"
const DAY_MS = 86_400_000
const OKX_PAGE_LIMIT = 100
const OKX_MAX_PAGES = 80

interface OkxResponse<T> {
  code: string | number
  data?: T[]
}

export interface OkxDailyCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
}

export interface OkxPoint {
  timestamp: number
  value: number
}

async function fetchOkxRows(path: string, revalidateSeconds: number): Promise<string[][]> {
  try {
    const res = await fetch(`${OKX}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      next: { revalidate: revalidateSeconds },
    })
    if (!res.ok) return []
    const json = (await res.json()) as OkxResponse<string[]>
    if (String(json.code) !== "0") return []
    return (json.data ?? []) as string[][]
  } catch {
    return []
  }
}

export async function fetchOkxDailyCandleRows({
  instId,
  daysWanted,
  revalidateSeconds,
}: {
  instId: string
  daysWanted: number
  revalidateSeconds: number
}): Promise<string[][]> {
  const desired = Math.max(60, Math.ceil(daysWanted) + 7)
  const collected = new Map<number, string[]>()
  let after: string | null = null

  for (let page = 0; page < OKX_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      instId,
      bar: "1D",
      limit: String(OKX_PAGE_LIMIT),
    })
    if (after) params.set("after", after)

    const rows = await fetchOkxRows(`/api/v5/market/history-candles?${params.toString()}`, revalidateSeconds)
    if (rows.length === 0) break

    let oldestTs = Number.POSITIVE_INFINITY
    let added = 0
    for (const row of rows) {
      const timestamp = Number(row[0])
      if (!Number.isFinite(timestamp)) continue
      if (!collected.has(timestamp)) {
        collected.set(timestamp, row)
        added += 1
      }
      if (timestamp < oldestTs) oldestTs = timestamp
    }

    if (added === 0 || collected.size >= desired || !Number.isFinite(oldestTs)) break
    after = String(oldestTs)
  }

  return Array.from(collected.values()).sort((a, b) => Number(b[0]) - Number(a[0]))
}

export async function fetchOkxDailyCandles({
  instId,
  daysWanted,
  revalidateSeconds,
}: {
  instId: string
  daysWanted: number
  revalidateSeconds: number
}): Promise<OkxDailyCandle[]> {
  const rows = await fetchOkxDailyCandleRows({ instId, daysWanted, revalidateSeconds })
  return rows
    .map((row) => {
      const timestamp = Number(row[0])
      const open = Number(row[1])
      const high = Number(row[2])
      const low = Number(row[3])
      const close = Number(row[4])
      const volume = Number(row[5])
      const quoteVolume = Number(row[7]) || volume * close
      return { timestamp, open, high, low, close, volume, quoteVolume }
    })
    .filter(
      (candle) =>
        Number.isFinite(candle.timestamp) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close),
    )
    .sort((a, b) => a.timestamp - b.timestamp)
}

export async function fetchOkxDailyCloses(options: {
  instId: string
  daysWanted: number
  revalidateSeconds: number
}): Promise<number[]> {
  const candles = await fetchOkxDailyCandles(options)
  return candles.map((candle) => candle.close)
}

export async function fetchOkxOpenInterestUsd({
  instId,
  daysWanted,
  revalidateSeconds,
}: {
  instId: string
  daysWanted: number
  revalidateSeconds: number
}): Promise<OkxPoint[]> {
  const desired = Math.max(60, Math.ceil(daysWanted) + 7)
  const collected = new Map<number, number>()
  let end = Date.now()

  for (let page = 0; page < OKX_MAX_PAGES; page += 1) {
    const begin = end - (OKX_PAGE_LIMIT + 2) * DAY_MS
    const params = new URLSearchParams({
      instId,
      period: "1D",
      begin: String(Math.max(0, begin)),
      end: String(end),
      limit: String(OKX_PAGE_LIMIT),
    })
    const rows = await fetchOkxRows(`/api/v5/rubik/stat/contracts/open-interest-history?${params.toString()}`, revalidateSeconds)
    if (rows.length === 0) break

    let oldestTs = Number.POSITIVE_INFINITY
    let added = 0
    for (const row of rows) {
      const timestamp = Number(row[0])
      const value = Number(row[3])
      if (!Number.isFinite(timestamp) || !Number.isFinite(value)) continue
      if (!collected.has(timestamp)) {
        collected.set(timestamp, value)
        added += 1
      }
      if (timestamp < oldestTs) oldestTs = timestamp
    }

    if (added === 0 || collected.size >= desired || !Number.isFinite(oldestTs)) break
    end = oldestTs - 1
  }

  return Array.from(collected.entries())
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => a.timestamp - b.timestamp)
}
