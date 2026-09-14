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

/**
 * Pearson correlation of first differences between a series and a reference series on
 * shared timestamps. Differences, not levels: any smoothed price (EMA, VWAP) correlates
 * ~1 with price in levels and says nothing; co-movement of changes is what matters.
 * Returns null when fewer than `minPoints` overlapping changes exist.
 */
export function diffCorrelation(series: OrderableSeries, reference: OrderableSeries, minPoints = 20): number | null {
  const ref = new Map<number, number>()
  for (const p of reference.data) if (p.value !== null && Number.isFinite(p.value)) ref.set(p.time, p.value)
  const xs: number[] = []
  const ys: number[] = []
  let prevS: { time: number; value: number } | null = null
  for (const p of series.data) {
    if (p.value === null || !Number.isFinite(p.value)) continue
    if (prevS && ref.has(p.time) && ref.has(prevS.time)) {
      xs.push(p.value - prevS.value)
      ys.push(ref.get(p.time)! - ref.get(prevS.time)!)
    }
    prevS = { time: p.time, value: p.value }
  }
  const n = xs.length
  if (n < minPoints) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Order groups and series by an arbitrary score (higher first); ties fall back to importance. */
export function orderGroupsByScore<S extends OrderableSeries, G extends OrderableGroup<S>>(groups: G[], score: (series: S) => number | null): G[] {
  const s = (x: S) => { const v = score(x); return v === null ? -Infinity : v }
  const g = (grp: G) => grp.series.reduce((max, x) => Math.max(max, s(x)), -Infinity)
  return [...groups]
    .sort((a, b) => g(b) - g(a) || groupImportance(b) - groupImportance(a))
    .map((group) => ({
      ...group,
      series: [...group.series].sort((a, b) => s(b) - s(a) || seriesImportance(b) - seriesImportance(a)),
    }))
}
