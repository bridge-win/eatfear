import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getBlockchainTimespan, getRangeStartDate } from "@/lib/time-range"

interface BlockchainChartResponse {
  values?: Array<{ x: number; y: number }>
}

export interface BlockchainFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

const BLOCKCHAIN_BASE = "https://api.blockchain.info/charts"

/**
 * Blockchain.com Charts API.  Returns null on network failure or empty series.
 * Supports chart names like:
 *   - hash-rate
 *   - difficulty
 *   - n-unique-addresses
 *   - n-transactions
 *   - estimated-transaction-volume-usd
 *   - market-cap
 */
export async function fetchBlockchainSeries(
  chartName: string,
  range: TimeRangeOption,
  revalidate = 1800,
): Promise<BlockchainFetchResult | null> {
  const timespan = getBlockchainTimespan(range.id)
  const url = `${BLOCKCHAIN_BASE}/${chartName}?timespan=${timespan}&format=json&cors=true`

  const payload = await fetchJson<BlockchainChartResponse>(url, { revalidate })
  if (!payload?.values || payload.values.length === 0) return null

  const startCutoff = getRangeStartDate(range.id).getTime()
  const history: MacroSeriesPoint[] = []
  for (const entry of payload.values) {
    if (!Number.isFinite(entry.y)) continue
    const ms = entry.x * 1000
    if (ms < startCutoff) continue
    history.push({
      timestamp: ms,
      date: new Date(ms).toISOString().slice(0, 10),
      value: entry.y,
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
  }
}
