import { BY_ID, SERIES, type Definition, type Point, type SeriesData } from "./catalog.ts"
import { mofCoverage, mofHistory, type MofField } from "./mof.ts"
import { cleanPoints } from "./metrics.ts"
import { loadCsi300, normalizeLpr } from "./equity.ts"

type Row = Record<string, unknown>
type Fetcher = typeof fetch
type Loaded = { points: Point[]; warning?: string; complete: boolean }
const V1 = "https://datacenter-web.eastmoney.com/api/data/v1/get"
const LEGACY = "https://datacenter.eastmoney.com/api/data/get"
const PUBLIC_WEB_TOKEN = "894050c76af8597a853f5b408b759f5d"
const cache = new Map<string, { until: number; data: SeriesData }>()
const inflight = new Map<string, Promise<SeriesData>>()
const reports = new Map<string, { until: number; task: Promise<Row[]> }>()

export function numberValue(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null
  const n = typeof value === "number" ? value : Number(String(value).replaceAll(",", ""))
  return Number.isFinite(n) ? n : null
}
function rowDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const match = /^(\d{4})[-年](\d{1,2})[-月](\d{1,2})/.exec(raw)
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : null
}
export function parseRows(rows: Row[], d: Definition): Point[] {
  return cleanPoints(rows.flatMap(row => {
    const date = rowDate(row[d.dateField ?? "REPORT_DATE"])
    const value = numberValue(row[d.field])
    return date && value !== null ? [{ date, value }] : []
  }))
}
async function json(url: string, fetcher: Fetcher, signal: AbortSignal): Promise<any> {
  const response = await fetcher(url, { signal, redirect: "error", headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0", ...(url.includes("eastmoney.com") ? { Referer: "https://data.eastmoney.com/" } : {}) } })
  if (!response.ok) throw new Error(`上游 HTTP ${response.status}`)
  const declared = Number(response.headers.get("content-length") || 0)
  if (declared > 8_000_000) throw new Error("上游响应超出安全大小")
  const text = await response.text()
  if (text.length > 8_000_000) throw new Error("上游响应超出安全大小")
  return JSON.parse(text)
}
function reportUrl(d: Definition, page: number): string {
  const date = d.dateField ?? "REPORT_DATE"
  const columns = [date, ...new Set(SERIES.filter(s => s.report === d.report).map(s => s.field))].join(",")
  const params = d.legacy ? new URLSearchParams({ type: d.report, sty: "ALL", st: date, sr: "-1", token: PUBLIC_WEB_TOKEN, p: String(page), ps: "1000", pageNo: String(page), pageNum: String(page) }) : new URLSearchParams({ reportName: d.report, columns, sortColumns: date, sortTypes: "-1", pageNumber: String(page), pageSize: "1000", source: "WEB", client: "WEB" })
  return `${d.legacy ? LEGACY : V1}?${params}`
}
export async function eastmoneyRows(d: Definition, fetcher: Fetcher = fetch): Promise<Row[]> {
  const key = d.report
  const existing = fetcher === fetch ? reports.get(key) : undefined
  if (existing && existing.until > Date.now()) return existing.task
  const task = (async () => {
    const signal = AbortSignal.timeout(24000)
    const first = await json(reportUrl(d, 1), fetcher, signal)
    if (first.success === false || !Array.isArray(first.result?.data)) throw new Error("上游字段或权限发生变化")
    const pages = Number(first.result.pages)
    if (!Number.isInteger(pages) || pages < 1 || pages > 64) throw new Error("上游分页元数据异常；拒绝静默截断历史")
    const rows: Row[] = [...first.result.data]
    const declaredCount = numberValue(first.result.count)
    if (declaredCount !== null && (!Number.isInteger(declaredCount) || declaredCount < rows.length)) throw new Error("上游记录总数异常")
    const signatures = new Set([JSON.stringify(first.result.data)])
    for (let page = 2; page <= pages; page += 4) {
      const batch = await Promise.all(Array.from({ length: Math.min(4, pages - page + 1) }, (_, i) => json(reportUrl(d, page + i), fetcher, signal)))
      for (const result of batch) {
        if (result.success === false || !Array.isArray(result.result?.data) || !result.result.data.length) throw new Error("历史分页不完整；请稍后重试")
        if (Number(result.result.pages) !== pages || (declaredCount !== null && numberValue(result.result.count) !== declaredCount)) throw new Error("获取期间分页元数据变化；请稍后重试")
        const signature = JSON.stringify(result.result.data)
        if (signatures.has(signature)) throw new Error("上游重复返回同一页；拒绝伪造完整历史")
        signatures.add(signature)
        rows.push(...result.result.data)
      }
    }
    if (declaredCount !== null && rows.length !== declaredCount) throw new Error("历史条数与上游总数不符；拒绝标记完整")
    return rows
  })()
  if (fetcher === fetch) {
    reports.set(key, { until: Date.now() + 15 * 60000, task })
    task.catch(() => reports.delete(key))
  }
  return task
}
async function load(d: Definition, fetcher: Fetcher): Promise<Loaded> {
  if (d.provider === "mof") {
    const history = await mofHistory(fetcher)
    const coverage = mofCoverage(history.records, history.startYear, d.field as MofField)
    return { complete: history.complete && coverage.complete, warning: [history.warning, coverage.warning].filter(Boolean).join("；") || undefined, points: history.records.flatMap(r => {
      const value = numberValue(r[d.field as MofField])
      return value === null ? [] : [{ date: r.date, value, sourceUrl: r.sourceUrl, publishedAt: r.publishedAt, fetchedAt: r.fetchedAt }]
    }) }
  }
  if (d.provider === "eastmoney") {
    const points = parseRows(await eastmoneyRows(d, fetcher), d)
    return d.id === "lpr" ? { points: normalizeLpr(points), complete: true, warning: "采用2019-08改革后的月度报价，不拼接旧日频制度；同月保留最后披露值。" } : { points, complete: true }
  }
  const signal = AbortSignal.timeout(24000)
  if (d.provider === "worldbank") {
    const base = `https://api.worldbank.org/v2/country/CHN/indicator/${encodeURIComponent(d.report)}?format=json&per_page=1000`
    const first = await json(base, fetcher, signal)
    if (!Array.isArray(first) || !Array.isArray(first[1])) throw new Error("WDI 返回结构变化")
    const pages = Number(first[0]?.pages)
    if (!Number.isInteger(pages) || pages < 1 || pages > 20) throw new Error("WDI 分页异常")
    const rows = [...first[1]]
    const signatures = new Set([JSON.stringify(first[1])])
    const total = numberValue(first[0]?.total)
    for (let page = 2; page <= pages; page++) {
      const next = await json(`${base}&page=${page}`, fetcher, signal)
      if (!Array.isArray(next) || !Array.isArray(next[1]) || !next[1].length || Number(next[0]?.pages) !== pages) throw new Error("WDI 历史不完整")
      const signature = JSON.stringify(next[1])
      if (signatures.has(signature)) throw new Error("WDI 重复返回同一页；历史完整性未确认")
      signatures.add(signature)
      rows.push(...next[1])
    }
    if (total !== null && (!Number.isInteger(total) || rows.length !== total)) throw new Error("WDI 历史条数与总数不符")
    return { complete: true, points: cleanPoints(rows.flatMap((r: Row) => { const value = numberValue(r.value); return /^\d{4}$/.test(String(r.date)) && value !== null ? [{ date: `${r.date}-12-31`, value }] : [] })) }
  }
  if (d.provider === "imf") {
    let result: any
    try { result = await json(`https://www.imf.org/external/datamapper/api/v2/${d.report}/CHN`, fetcher, signal); if (!result.values?.[d.report]?.CHN) throw new Error("IMF v2 schema") } catch { result = await json(`https://www.imf.org/external/datamapper/api/v1/${d.report}/CHN`, fetcher, signal) }
    const values = result.values?.[d.report]?.CHN
    if (!values || typeof values !== "object") throw new Error("IMF 返回结构变化")
    const year = new Date().getUTCFullYear()
    return { complete: true, warning: "IMF年度估算口径；过滤当年及未来年份，不属于官方隐债。", points: cleanPoints(Object.entries(values).flatMap(([y, v]) => { const value = numberValue(v); return /^\d{4}$/.test(y) && Number(y) < year && value !== null ? [{ date: `${y}-12-31`, value }] : [] })) }
  }
  const market = await loadCsi300((url, signal) => json(url, fetcher, signal))
  // An endpoint ending its pagination does not prove it delivered usable daily history.
  const covered = market.points.length >= 1000 && market.points.slice(1).every((p, i) => (Date.parse(p.date) - Date.parse(market.points[i].date)) / 86400000 <= 14)
  return { ...market, complete: market.complete && covered, warning: [market.warning, covered ? null : "日频历史不足1000条或存在超过14天的断档；保留观测，完整性待复核"].filter(Boolean).join("；") }
}
export async function getSeries(id: string, fetcher: Fetcher = fetch): Promise<SeriesData> {
  const d = BY_ID[id]
  if (!d) throw new Error("Unknown series")
  const cached = fetcher === fetch ? cache.get(id) : undefined
  if (cached && cached.until > Date.now()) return cached.data
  if (fetcher === fetch && inflight.has(id)) return inflight.get(id)!
  const task = (async (): Promise<SeriesData> => {
    try {
      const loaded = await load(d, fetcher)
      const today = new Date().toISOString().slice(0, 10)
      const points = cleanPoints(loaded.points).filter(p => p.date <= today)
      if (!points.length) throw new Error("上游未返回有效历史观测；没有使用模拟值填充")
      const data: SeriesData = { id, points, status: loaded.complete ? "ok" : "partial", complete: loaded.complete, latestVerified: !/官网检查失败|新公告未能解析/.test(loaded.warning ?? ""), fetchedAt: points.at(-1)?.fetchedAt ?? new Date().toISOString(), publishedAt: points.at(-1)?.publishedAt ?? null, sourceUrl: points.at(-1)?.sourceUrl ?? d.sourceUrl, warning: loaded.warning ?? null, firstDate: points[0].date, lastDate: points.at(-1)!.date }
      if (fetcher === fetch) cache.set(id, { until: Date.now() + (d.frequency === "annual" ? 86400000 : 900000), data })
      return data
    } catch (error) {
      const warning = error instanceof Error ? error.message.slice(0, 200) : "上游暂不可用"
      if (cached) return { ...cached.data, status: "partial", latestVerified: false, warning: `本次获取失败，保留上次成功数据：${warning}` }
      return { id, points: [], status: "unavailable", complete: false, fetchedAt: null, publishedAt: null, sourceUrl: d.sourceUrl, warning, firstDate: null, lastDate: null }
    } finally { if (fetcher === fetch) inflight.delete(id) }
  })()
  if (fetcher === fetch) inflight.set(id, task)
  return task
}
