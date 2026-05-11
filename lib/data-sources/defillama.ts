import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeStartDate } from "@/lib/time-range"

export interface DefiLlamaFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

interface StablecoinChartEntry {
  date: string | number
  totalCirculatingUSD?:
    | {
        peggedUSD?: number
      }
    | number
}

interface DefiTvlEntry {
  date: number
  tvl?: number
  totalLiquidityUSD?: number
}

const STABLECOIN_URL = "https://stablecoins.llama.fi/stablecoincharts/all"
const TVL_URL = "https://api.llama.fi/v2/historicalChainTvl"

const buildResult = (history: MacroSeriesPoint[]): DefiLlamaFetchResult | null => {
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

/**
 * Total stablecoin market cap (USD) over time.
 * DefiLlama is rate-limit friendly and does not require an API key.
 */
export async function fetchStablecoinMarketCap(
  range: TimeRangeOption,
  revalidate = 3600,
): Promise<DefiLlamaFetchResult | null> {
  const payload = await fetchJson<StablecoinChartEntry[]>(STABLECOIN_URL, { revalidate })
  if (!payload) return null

  const startCutoff = getRangeStartDate(range.id).getTime()
  const history: MacroSeriesPoint[] = []

  for (const entry of payload) {
    const tsSeconds = typeof entry.date === "string" ? Number(entry.date) : entry.date
    if (!Number.isFinite(tsSeconds)) continue
    const ms = Number(tsSeconds) * 1000
    if (ms < startCutoff) continue

    let value = 0
    if (typeof entry.totalCirculatingUSD === "number") {
      value = entry.totalCirculatingUSD
    } else if (entry.totalCirculatingUSD && typeof entry.totalCirculatingUSD === "object") {
      value = entry.totalCirculatingUSD.peggedUSD ?? 0
    }
    if (!Number.isFinite(value) || value <= 0) continue

    history.push({
      timestamp: ms,
      date: new Date(ms).toISOString().slice(0, 10),
      value,
    })
  }

  return buildResult(history)
}

/**
 * Total DeFi TVL (all chains, USD) over time.
 */
export async function fetchDefiTvl(range: TimeRangeOption, revalidate = 3600): Promise<DefiLlamaFetchResult | null> {
  const payload = await fetchJson<DefiTvlEntry[]>(TVL_URL, { revalidate })
  if (!payload) return null

  const startCutoff = getRangeStartDate(range.id).getTime()
  const history: MacroSeriesPoint[] = []

  for (const entry of payload) {
    const value = entry.tvl ?? entry.totalLiquidityUSD
    if (!Number.isFinite(entry.date) || !Number.isFinite(value)) continue
    const ms = entry.date * 1000
    if (ms < startCutoff) continue
    history.push({
      timestamp: ms,
      date: new Date(ms).toISOString().slice(0, 10),
      value: value as number,
    })
  }

  return buildResult(history)
}
