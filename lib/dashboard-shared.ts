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
  refreshMs?: number
  fredEnabled?: boolean
  indicators: MacroIndicator[]
  requested?: number
  returned?: number
  error?: string
}

const SYMBOL_PREFIX_PATTERN = /^FRED:/

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
  const parts = [indicator.source, indicator.frequency, indicator.sourceNote].filter((part): part is string =>
    Boolean(part),
  )
  return parts.join(" · ")
}

/** Props for the shared InfoTooltip when fed from a macro indicator. */
export interface IndicatorInfoProps {
  title: string
  description: string
  source: string
}

export const buildIndicatorInfo = (indicator: MacroIndicator): IndicatorInfoProps | undefined => {
  if (!indicator.description && !indicator.meaning && !indicator.impact) return undefined
  const meaning = indicator.meaning ?? indicator.description
  const impact =
    indicator.impact ?? "扩展指标，影响方向需结合指标说明、历史趋势和同组指标一起判断。"
  const descriptionParts = [
    meaning ? `意义：${meaning}` : null,
    `影响方向：${impact}`,
    indicator.meaning && indicator.description ? `说明：${indicator.description}` : null,
    "使用解读：先看该指标自身趋势和最新变化，再和同组指标、价格趋势、波动率、信用/美元/流动性一起确认。",
    "失效场景：数据滞后、修订、单一市场噪音或与价格趋势强烈背离时，不能把它当作独立交易触发器。",
  ].filter((part): part is string => Boolean(part))

  return {
    title: indicator.name,
    description: descriptionParts.join("\n"),
    source: buildInfoSource(indicator),
  }
}
