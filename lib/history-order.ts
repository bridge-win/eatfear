/**
 * Importance ordering for the aligned history view. Pure so it can be unit-tested
 * without a DOM: groups sort by their most important series, series by importance
 * with core tier winning ties, then by declared order.
 */
export interface OrderableSeries {
  key: string
  order?: number
  importance?: number
  tier?: "core" | "secondary"
  data: { time: number; value: number | null }[]
}
export interface OrderableGroup<S extends OrderableSeries = OrderableSeries> {
  key: string
  label?: string
  series: S[]
}

export function seriesImportance(series: OrderableSeries): number {
  return (series.importance ?? 0) + (series.tier === "core" ? 0.5 : 0)
}

export function groupImportance(group: OrderableGroup): number {
  return group.series.reduce((max, series) => Math.max(max, seriesImportance(series)), -Infinity)
}

export function orderGroupsByImportance<S extends OrderableSeries, G extends OrderableGroup<S>>(groups: G[]): G[] {
  return [...groups]
    .sort((a, b) => groupImportance(b) - groupImportance(a))
    .map((group) => ({
      ...group,
      series: [...group.series].sort((a, b) => seriesImportance(b) - seriesImportance(a) || (a.order ?? 0) - (b.order ?? 0)),
    }))
}
