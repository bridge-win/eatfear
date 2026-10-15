import type { Point } from "./catalog.ts"
import { cleanPoints } from "./metrics.ts"

type JsonRequest = (url: string, signal: AbortSignal) => Promise<any>
type Result = { points: Point[]; complete: boolean; warning?: string }
const YAHOO_SOURCE = "https://finance.yahoo.com/quote/000300.SS/"
const EASTMONEY_SOURCE = "https://quote.eastmoney.com/zs000300.html"
const price = (v: unknown): number | null => {
  if ((typeof v !== "number" && typeof v !== "string") || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}
export function normalizeLpr(points: Point[]): Point[] {
  return [...new Map(cleanPoints(points).filter(p => p.date >= "2019-08-20").map(p => [p.date.slice(0, 7), p])).values()]
}
export function parseKlines(lines: unknown): Point[] {
  if (!Array.isArray(lines)) throw new Error("行情历史字段变化")
  return cleanPoints(lines.flatMap(line => {
    if (typeof line !== "string") return []
    const [date, , close] = line.split(",")
    const value = price(close)
    return value === null ? [] : [{ date, value, sourceUrl: EASTMONEY_SOURCE }]
  }))
}
export async function loadCsi300(request: JsonRequest, today = new Date().toISOString().slice(0, 10)): Promise<Result> {
  const signal = AbortSignal.timeout(24000)
  let fallback: Point[] = []
  const errors: string[] = []
  try {
    const body = await request("https://query1.finance.yahoo.com/v8/finance/chart/000300.SS?range=max&interval=1d&events=history", signal)
    const chart = body.chart?.result?.[0]
    if (!Array.isArray(chart?.timestamp) || !Array.isArray(chart?.indicators?.quote?.[0]?.close)) throw new Error("Yahoo历史字段缺失")
    fallback = cleanPoints(chart.timestamp.flatMap((t: number, i: number) => {
      const value = price(chart.indicators.quote[0].close[i])
      return Number.isFinite(t) && value !== null ? [{ date: new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }), value, sourceUrl: YAHOO_SOURCE }] : []
    })).filter(p => p.date <= today)
    const firstTrade = chart.meta?.firstTradeDate
    const firstDate = Number.isFinite(firstTrade) ? new Date(firstTrade * 1000).toISOString().slice(0, 10) : null
    if (fallback.length >= 1000 && firstDate && (Date.parse(fallback[0].date) - Date.parse(firstDate)) / 86400000 <= 10) return { points: fallback, complete: true, warning: "Yahoo日终/延迟价格历史，不含分红；全历史请求已核对起点。" }
    errors.push("Yahoo未返回可验证的完整历史")
  } catch { errors.push("Yahoo历史暂不可用") }
  let history: Point[] = []
  let end = today.replaceAll("-", "")
  try {
    for (let page = 0; page < 64; page++) {
      const params = new URLSearchParams({ secid: "1.000300", klt: "101", fqt: "0", beg: "19900101", end, lmt: "1000", fields1: "f1,f2,f3,f4,f5,f6", fields2: "f51,f52,f53,f54,f55,f56" })
      const body = await request(`https://push2his.eastmoney.com/api/qt/stock/kline/get?${params}`, signal)
      if (body.rc !== 0) throw new Error("东方财富行情接口拒绝请求")
      const pagePoints = body.data === null ? [] : parseKlines(body.data?.klines)
      if (!pagePoints.length) {
        if (!history.length) throw new Error("东方财富未返回历史")
        return { points: cleanPoints(history), complete: true, warning: "已切换东方财富CSI300价格历史；向前分页至源端无更早记录，不含分红。" }
      }
      if (history.length && pagePoints[0].date >= history[0].date) throw new Error("上游没有向更早日期分页")
      if (pagePoints.some(p => p.date.replaceAll("-", "") > end)) throw new Error("上游忽略历史截止日期")
      history = cleanPoints([...pagePoints, ...history])
      const previous = new Date(Date.parse(pagePoints[0].date + "T00:00:00Z") - 86400000)
      end = previous.toISOString().slice(0, 10).replaceAll("-", "")
      if (end < "19900101") return { points: history, complete: true, warning: "东方财富价格历史，未包含分红。" }
    }
    throw new Error("分页上限达到，完整性未确认")
  } catch (error) { errors.push(error instanceof Error ? error.message : "东方财富历史获取失败") }
  const points = history.length > fallback.length ? history : fallback
  if (!points.length) throw new Error(errors.join("；"))
  return { points, complete: false, warning: `仅取得部分历史或报价，不作为完整历史：${errors.join("；")}` }
}
