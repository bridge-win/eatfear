import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeDays } from "@/lib/time-range"

interface FngEntry {
  value: string
  value_classification?: string
  timestamp: string
  time_until_update?: string
}

interface FngResponse {
  data?: FngEntry[]
}

export interface FngFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
  classification?: string
}

/**
 * Alternative.me Crypto Fear & Greed Index, historical series.
 * Free public endpoint with no rate limiting issues for our usage.
 */
export async function fetchFearGreedHistory(
  range: TimeRangeOption,
  revalidate = 3600,
): Promise<FngFetchResult | null> {
  const limit = Math.min(2000, Math.max(30, getRangeDays(range.id)))
  const url = `https://api.alternative.me/fng/?limit=${limit}`

  const payload = await fetchJson<FngResponse>(url, { revalidate })
  const entries = payload?.data ?? []
  if (entries.length === 0) return null

  const history: MacroSeriesPoint[] = []
  for (const entry of entries.slice().reverse()) {
    const value = Number(entry.value)
    const tsSeconds = Number(entry.timestamp)
    if (!Number.isFinite(value) || !Number.isFinite(tsSeconds)) continue
    const ms = tsSeconds * 1000
    history.push({
      timestamp: ms,
      date: new Date(ms).toISOString().slice(0, 10),
      value,
    })
  }

  if (history.length === 0) return null
  const latest = history[history.length - 1]
  const previous = history[history.length - 2] ?? latest

  return {
    history,
    currentValue: latest.value,
    previousValue: previous.value,
    lastUpdate: latest.timestamp,
    classification: entries[0]?.value_classification,
  }
}
