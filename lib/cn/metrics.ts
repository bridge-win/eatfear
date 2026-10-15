import type { Definition, Point, SeriesData } from "./catalog.ts"

export function cleanPoints(input: Point[]): Point[] {
  const unique = new Map<string, Point>()
  for (const p of input) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !Number.isFinite(p.value)) continue
    const time = Date.parse(p.date + "T00:00:00Z")
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== p.date) continue
    unique.set(p.date, p)
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date))
}
export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export function deviation(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
export function percentile(value: number, sample: number[]): number | null {
  if (!sample.length || !Number.isFinite(value)) return null
  return 100 * (sample.filter(x => x < value).length + sample.filter(x => x === value).length / 2) / sample.length
}
export type Evaluation = {
  value: number | null; delta: number | null; momentum: number | null; percentile: number | null
  z: number | null; robustZ: number | null; samples: number; stale: boolean
  label: string; explanation: string; drawdown: number | null; volatility: number | null
}
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7))
const ageDays = (a: string, b: string) => (Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000
export function evaluate(d: Definition, data?: SeriesData, now = new Date()): Evaluation {
  const empty: Evaluation = { value: null, delta: null, momentum: null, percentile: null, z: null, robustZ: null, samples: 0, stale: false, label: "等待数据", explanation: "没有足够证据，不填0、不生成结论。", drawdown: null, volatility: null }
  const points = cleanPoints(data?.points ?? []).filter(p => p.date <= now.toISOString().slice(0, 10))
  const last = points.at(-1)
  if (!last) return empty
  const age = (now.getTime() - Date.parse(last.date + "T00:00:00Z")) / 86400000
  const stale = age > (d.frequency === "daily" ? 10 : d.frequency === "annual" ? 900 : 100)
  let prior = points.slice(0, -1)
  if (d.seasonal) prior = prior.filter(p => p.date.slice(5, 7) === last.date.slice(5, 7) && Number(last.date.slice(0, 4)) - Number(p.date.slice(0, 4)) <= 10)
  else prior = prior.slice(-(d.frequency === "daily" ? 756 : d.frequency === "annual" ? 20 : 60))
  const sample = prior.map(p => p.value)
  const n = sample.length
  const minimum = d.seasonal ? 5 : d.frequency === "annual" ? 10 : 24
  // A complete cached history can still be unverified after a failed refresh.
  const verified = data?.status === "ok" && data.complete && !stale
  const ready = n >= minimum && verified && !d.estimated && !d.noScore
  const pct = ready ? percentile(last.value, sample) : null
  const sd = n > 1 ? deviation(sample) : 0
  const med = n ? median(sample) : 0
  const mad = n ? median(sample.map(x => Math.abs(x - med))) : 0
  // Price levels are non-stationary; their position is not an outlier test.
  const z = ready && !d.price && n >= 24 && sd > 1e-12 ? (last.value - mean(sample)) / sd : null
  const robustZ = ready && !d.price && n >= 24 && mad > 1e-12 ? 0.6745 * (last.value - med) / mad : null
  const previous = points.at(-2)
  const recentMonths = points.slice(-4)
  const continuousMonths = recentMonths.length === 4 && recentMonths.slice(1).every((p, i) => monthIndex(p.date) - monthIndex(recentMonths[i].date) === 1)
  const momentum = !d.seasonal && d.frequency === "monthly" && continuousMonths ? last.value - recentMonths[0].value : null
  let label = pct === null ? "样本不足" : pct >= 90 ? "历史高位" : pct <= 10 ? "历史低位" : "常态区间"
  if (d.noScore) label = "存量不评分"
  if (d.estimated) label = "年度估算"
  if (data?.complete === false) label = "历史不完整"
  else if (data?.status !== "ok") label = "获取待复核"
  if (stale) label = "数据陈旧"
  if (robustZ !== null && Math.abs(robustZ) > 3.5) label = "潜在异常"
  let explanation = pct === null ? "样本不足、历史不完整、刷新未验证或估算口径，不输出当前异常判断。" : pct >= 60 ? d.high : pct <= 40 ? d.low : "当前值处于历史中间区间；继续观察变化方向，并核对其他传导证据。"
  if (stale) explanation = "统计期距今较久，只能用于历史观察，不作为当前风向。"
  const pricePoints = points.slice(-253)
  const prices = pricePoints.map(p => p.value)
  const continuousPrices = pricePoints.slice(1).every((p, i) => ageDays(p.date, pricePoints[i].date) <= 14)
  const returns = prices.slice(1).map((p, i) => p > 0 && prices[i] > 0 ? Math.log(p / prices[i]) : NaN)
  const comparablePrevious = previous && (d.frequency !== "monthly" || monthIndex(last.date) - monthIndex(previous.date) === 1)
  return {
    value: last.value, delta: comparablePrevious && !d.seasonal ? last.value - previous!.value : null, momentum,
    percentile: pct, z, robustZ, samples: n, stale, label, explanation,
    drawdown: d.price && verified && prices.length >= 2 && prices.every(p => p > 0) ? 100 * (last.value / Math.max(...prices.slice(-252)) - 1) : null,
    volatility: d.price && verified && continuousPrices && returns.length >= 60 && returns.every(Number.isFinite) ? deviation(returns) * Math.sqrt(252) * 100 : null,
  }
}
export function difference(a: Point[], b: Point[], scale = 1): Point[] {
  const right = new Map(cleanPoints(b).map(p => [p.date, p.value]))
  return cleanPoints(cleanPoints(a).flatMap(p => right.has(p.date) ? [{ date: p.date, value: (p.value - right.get(p.date)!) * scale }] : []))
}
export function rangePoints(points: Point[], years: number | null): Point[] {
  if (years === null || !points.length) return points
  const last = new Date(points[points.length - 1].date + "T00:00:00Z")
  last.setUTCFullYear(last.getUTCFullYear() - years)
  return points.filter(p => p.date >= last.toISOString().slice(0, 10))
}
export function eventStudy(input: Point[], date: string, periods = 120) {
  if (!Number.isInteger(periods) || periods < 1 || !Number.isFinite(Date.parse(date))) return null
  const points = cleanPoints(input)
  const index = points.findIndex(p => p.date >= date)
  if (index <= 0 || index + periods >= points.length || points[index].value <= 0 || (Date.parse(points[index].date) - Date.parse(date)) / 86400000 > 10) return null
  const window = points.slice(index, index + periods + 1)
  if (window.some(p => p.value <= 0) || window.slice(1).some((p, i) => ageDays(p.date, window[i].date) > 14)) return null
  let peak = window[0].value, drawdown = 0
  for (const p of window) { peak = Math.max(peak, p.value); drawdown = Math.min(drawdown, p.value / peak - 1) }
  return { start: window[0].date, end: window.at(-1)!.date, change: 100 * (window.at(-1)!.value / window[0].value - 1), drawdown: drawdown * 100 }
}
export function interestSaving(principal: number, oldRate: number, newRate: number, days: number): number {
  if (![principal, oldRate, newRate, days].every(Number.isFinite) || principal < 0 || days < 0 || days > 365) throw new Error("Invalid scenario")
  return principal * (oldRate - newRate) / 100 * days / 365
}
export function csv(d: Definition, data: SeriesData): string {
  const esc = (v: unknown) => '"' + String(v ?? "").replaceAll('"', '""') + '"'
  return '\ufeff' + ["period,value,unit,source,fetched_at,published_at", ...data.points.map(p => [p.date, p.value, d.unit, p.sourceUrl ?? data.sourceUrl, p.fetchedAt ?? data.fetchedAt, p.publishedAt ?? data.publishedAt].map(esc).join(","))].join("\n")
}
