import { formatValue as formatSeriesValue, type SeriesChartUnit } from "@/components/series-chart"
import type { TimeRangeId } from "@/lib/time-range"
import type { MacroIndicator } from "@/lib/types"

/**
 * Shape returned by `GET /api/macro`. Used by dashboards that pull macro KPI rows.
 */
export interface MacroApiResponse {
  updatedAt: number
  range: TimeRangeId
  interval: string
  fredEnabled?: boolean
  indicators: MacroIndicator[]
  requested?: number
  returned?: number
  error?: string
}

const SYMBOL_PREFIX_PATTERN = /^(FRED|BLOCKCHAIN|DEFILLAMA|ALTERNATIVE):/

/** Strip the `SOURCE:` prefix from a registry symbol so we display the raw series id. */
export const stripSymbolPrefix = (symbol: string): string => symbol.replace(SYMBOL_PREFIX_PATTERN, "")

/** Map a numeric change to a KPI delta tone. */
export const getDeltaTone = (change: number): "up" | "down" | "neutral" => {
  if (change > 0) return "up"
  if (change < 0) return "down"
  return "neutral"
}

/** Signed percent: `+1.23%` / `-0.45%`. */
export const formatPercentDelta = (changePercent: number, fractionDigits = 2): string => {
  const sign = changePercent >= 0 ? "+" : ""
  return `${sign}${changePercent.toFixed(fractionDigits)}%`
}

/** Signed `+value (+pct%)` change string in the indicator's native unit. */
export const formatChangeWithPercent = (indicator: MacroIndicator): string => {
  const sign = indicator.change >= 0 ? "+" : ""
  return `${sign}${formatSeriesValue(indicator.change, indicator.unit as SeriesChartUnit)} (${sign}${indicator.changePercent.toFixed(
    2,
  )}%)`
}

/** Build a consistent `<InfoTooltip>` source string ("FRED · Daily") without trailing separator. */
export const buildInfoSource = (indicator: MacroIndicator): string => {
  if (indicator.frequency) return `${indicator.source} · ${indicator.frequency}`
  return indicator.source
}

/** Props for the shared InfoTooltip when fed from a macro indicator. */
export interface IndicatorInfoProps {
  title: string
  description: string
  source: string
}

export const buildIndicatorInfo = (indicator: MacroIndicator): IndicatorInfoProps | undefined => {
  if (!indicator.description) return undefined
  return {
    title: indicator.name,
    description: indicator.description,
    source: buildInfoSource(indicator),
  }
}
