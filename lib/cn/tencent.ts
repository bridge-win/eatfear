import type { Point } from "./catalog.ts"
import { cleanPoints } from "./metrics.ts"

type RequestJson = (url: string, signal: AbortSignal) => Promise<any>
const SOURCE = "https://gu.qq.com/sh000300/zs"
const differenceDays = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 86400000
export function parseTencentKlines(rows: unknown): Point[] {
  if (!Array.isArray(rows)) throw new Error("腾讯历史字段变化")
  return cleanPoints(rows.flatMap(row => {
    if (!Array.isArray(row) || typeof row[0] !== "string" || !["number", "string"].includes(typeof row[2]) || String(row[2]).trim() === "") return []
    const value = Number(row[2])
    return Number.isFinite(value) && value > 0 ? [{ date: row[0], value, sourceUrl: SOURCE }] : []
  }))
}
export async function loadTencentCsi(request: RequestJson, today = new Date().toISOString().slice(0, 10), signal = AbortSignal.timeout(12000)) {
  // Discover provider coverage instead of inventing an index inception date.
  const meta = await request("https://web.ifzq.gtimg.cn/other/klineweb/klineWeb/weekTrends?code=sh000300&type=qfq", signal)
  const earliest = meta.data?.[0]?.[0]
  if (typeof earliest !== "string" || !cleanPoints([{ date: earliest, value: 1 }]).length || earliest > today || earliest < "1990-01-01") throw new Error("腾讯历史起点不可验证")
  const firstYear = Number(earliest.slice(0, 4)), lastYear = Number(today.slice(0, 4))
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)
  const all: Point[] = []
  // A calendar-year page has at most 366 days, below the 640-row endpoint limit.
  for (let offset = 0; offset < years.length; offset += 4) {
    const pages = await Promise.all(years.slice(offset, offset + 4).map(async year => {
      const start = year === firstYear ? earliest : `${year}-01-01`
      const end = year === lastYear ? today : `${year}-12-31`
      const params = new URLSearchParams({ param: `sh000300,day,${start},${end},640,qfq` })
      const body = await request(`https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?${params}`, signal)
      const item = body.data?.sh000300
      const points = parseTencentKlines(item?.day ?? item?.qfqday)
      if (points.some(p => p.date < start || p.date > end)) throw new Error("腾讯未遵守历史日期范围")
      if (!points.length || points.length >= 640 || differenceDays(points[0].date, start) > 14 || differenceDays(end, points.at(-1)!.date) > 14 || points.slice(1).some((p, i) => differenceDays(p.date, points[i].date) > 14)) throw new Error("腾讯年度历史完整性未通过检查")
      return points
    }))
    for (const page of pages) all.push(...page)
  }
  return { points: cleanPoints(all), complete: true, warning: "腾讯CSI300日终/延迟价格历史；按年分页并验证首尾与缺口，不含分红。" }
}
