import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeStartDate } from "@/lib/time-range"

interface FredObservation {
  date: string
  value: string
}

interface FredResponse {
  observations?: FredObservation[]
  error_message?: string
}

export interface FredFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

/**
 * Fetch a FRED series. Requires `FRED_API_KEY` env var.
 * Returns null when:
 *   - FRED_API_KEY is missing
 *   - the network call fails
 *   - the series has no usable observations
 */
export async function fetchFredSeries(
  seriesId: string,
  range: TimeRangeOption,
  revalidate = 600,
): Promise<FredFetchResult | null> {
  const apiKey = process.env.FRED_API_KEY ?? process.env.NEXT_PUBLIC_FRED_API_KEY
  if (!apiKey) return null

  const startDate = getRangeStartDate(range.id).toISOString().slice(0, 10)
  const url = `${FRED_BASE}?series_id=${encodeURIComponent(
    seriesId,
  )}&api_key=${apiKey}&file_type=json&observation_start=${startDate}&sort_order=asc`

  const payload = await fetchJson<FredResponse>(url, { revalidate })
  if (!payload || !payload.observations) return null

  const history: MacroSeriesPoint[] = []
  for (const obs of payload.observations) {
    const numeric = Number(obs.value)
    if (!Number.isFinite(numeric)) continue
    const ts = new Date(`${obs.date}T00:00:00Z`).getTime()
    history.push({ timestamp: ts, date: obs.date, value: numeric })
  }

  if (history.length === 0) return null

  const latest = history[history.length - 1]
  const previous = history[history.length - 2] ?? latest

  return {
    history,
    currentValue: latest.value,
    previousValue: previous.value,
    lastUpdate: latest.timestamp,
  }
}
