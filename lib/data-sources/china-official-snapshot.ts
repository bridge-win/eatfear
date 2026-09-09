import snapshot from "@/lib/data/china-official-snapshot.json"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeStartDate } from "@/lib/time-range"

/**
 * Hand-verified annual NBS 统计公报 values, PBoC 货币政策执行报告 mortgage rates and the
 * BIS residential property index, copied from bridge-win/house. These are versioned
 * snapshots refreshed by a script, not live API pulls, so they never fail at request
 * time and carry a source link per observation.
 */
interface SnapshotObservation {
  date: string
  value: number
  source?: string
  title?: string
  quality?: string
}

interface SnapshotSeries {
  name: string
  unit: string
  publisher: string
  frequency: string
  source?: string
  title?: string
  observations: SnapshotObservation[]
}

interface SnapshotFile {
  asOf: string
  lastFullYear: number
  origin: string
  annual: Record<string, SnapshotSeries>
  mortgage_rate: SnapshotSeries
  hpi: Record<string, SnapshotSeries>
}

const SNAPSHOT = snapshot as SnapshotFile

export const CHINA_SNAPSHOT_AS_OF = SNAPSHOT.asOf
export const CHINA_SNAPSHOT_LAST_FULL_YEAR = SNAPSHOT.lastFullYear

/** Provider symbol format: `CN:annual:<key>` | `CN:mortgage_rate` | `CN:hpi:<CC>`. */
export function resolveSnapshotSeries(providerSymbol: string): SnapshotSeries | null {
  const parts = providerSymbol.split(":")
  if (parts[0] !== "CN") return null
  if (parts[1] === "annual" && parts[2]) return SNAPSHOT.annual[parts[2]] ?? null
  if (parts[1] === "mortgage_rate") return SNAPSHOT.mortgage_rate
  if (parts[1] === "hpi" && parts[2]) return SNAPSHOT.hpi[parts[2]] ?? null
  return null
}

export interface SnapshotFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

export function fetchChinaSnapshotSeries(providerSymbol: string, range: TimeRangeOption): SnapshotFetchResult | null {
  const series = resolveSnapshotSeries(providerSymbol)
  if (!series) return null

  const startMs = getRangeStartDate(range.id).getTime()
  const history: MacroSeriesPoint[] = []
  for (const obs of series.observations) {
    const timestamp = new Date(`${obs.date}T00:00:00Z`).getTime()
    if (!Number.isFinite(timestamp) || !Number.isFinite(obs.value)) continue
    history.push({ timestamp, date: obs.date, value: obs.value })
  }
  history.sort((a, b) => a.timestamp - b.timestamp)

  // Annual series would vanish on short ranges; always keep the last two points so the card still renders.
  const inRange = history.filter((point) => point.timestamp >= startMs)
  const visible = inRange.length >= 2 ? inRange : history.slice(-2)
  if (visible.length === 0) return null

  const latest = visible[visible.length - 1]
  const previous = visible[visible.length - 2] ?? latest
  return { history: visible, currentValue: latest.value, previousValue: previous.value, lastUpdate: latest.timestamp }
}

export interface SnapshotProvenance {
  publisher: string
  frequency: string
  latestSource?: string
  latestTitle?: string
}

export function getSnapshotProvenance(providerSymbol: string): SnapshotProvenance | null {
  const series = resolveSnapshotSeries(providerSymbol)
  if (!series) return null
  const latest = series.observations.at(-1)
  return {
    publisher: series.publisher,
    frequency: series.frequency,
    latestSource: latest?.source ?? series.source,
    latestTitle: latest?.title ?? series.title,
  }
}
