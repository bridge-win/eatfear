import seed from "../../public/cn/mof-history.json" with { type: "json" }
import { parsePolicyList } from "./research.ts"
export type MofRecord = {
  date: string; issuance: number | null; refinance: number | null; newDebt: number | null
  balance: number | null; rate: number | null; sourceUrl: string; publishedAt: string | null; fetchedAt: string
}
export type MofField = "issuance" | "refinance" | "newDebt" | "balance" | "rate"
export type MofArchive = { records: MofRecord[]; errors: string[]; startYear: number }
type MofHistory = { records: MofRecord[]; complete: boolean; warning: string | null; startYear: number }
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
const monthLabel = (index: number) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`
// A successful crawl is not evidence that every month or every field was captured.
export function mofCoverage(records: MofRecord[], startYear: number, field?: MofField) {
  const months = new Set(records.filter(r => !field || (r[field] !== null && Number.isFinite(r[field]))).map(r => monthIndex(r.date)))
  const last = Math.max(...records.map(r => monthIndex(r.date)))
  if (!months.size || !Number.isFinite(last)) return { complete: false, warning: "没有有效财政部历史观测" }
  const missing: string[] = []
  for (let month = startYear * 12; month <= last; month++) if (!months.has(month)) missing.push(monthLabel(month))
  return { complete: missing.length === 0, warning: missing.length ? `自${startYear}年起的采集范围缺少${missing.length}个月${field ? "该字段" : "公告"}（${missing.slice(0, 3).join("、")}${missing.length > 3 ? "等" : ""}）；未披露与未采集不填0` : null }
}
export const ARCHIVES = ["https://zwgls.mof.gov.cn/tjsj/", "https://yss.mof.gov.cn/zhuantilanmu/dfzgl/sjtj/"]
export function parseMofArticle(html: string, title: string, url: string, fetchedAt = new Date().toISOString()): MofRecord | null {
  const period = /(20\d{2})年(\d{1,2})月/.exec(title.replace(/\s/g, ""))
  if (!period || Number(period[2]) < 1 || Number(period[2]) > 12) return null
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/g, "").replace(/[\s,，]/g, "")
  const firstSection = text.split(/(?:（二）|\(二\))/)[0]
  const amount = (regex: RegExp, part = firstSection) => { const m = regex.exec(part); if (!m) return null; const value = Number(m[1]) * (m[2] === "万亿元" ? 10000 : 1); return Number.isFinite(value) ? value : null }
  const issuance = amount(/全国发行(?:地方政府)?债券(?:合计)?([\d.]+)(万?亿元)/)
  const refinance = amount(/全国发行再融资(?:地方政府)?债券([\d.]+)(万?亿元)/)
  const newDebt = amount(/全国发行新增(?:地方政府)?债券([\d.]+)(万?亿元)/)
  const balance = amount(/全国地方政府债务余额(?:为)?([\d.]+)(万?亿元)/, text)
  const rate = amount(/地方政府债券平均发行利率([\d.]+)%/)
  if (issuance === null && balance === null) return null
  if (issuance !== null && newDebt !== null && refinance !== null && Math.abs(issuance - newDebt - refinance) > 2) return null
  const pub = /发布日期[:：]?(20\d{2})年(\d{1,2})月(\d{1,2})日/.exec(text)
  return { date: new Date(Date.UTC(Number(period[1]), Number(period[2]), 0)).toISOString().slice(0, 10), issuance, refinance, newDebt, balance, rate, sourceUrl: url, publishedAt: pub ? `${pub[1]}-${pub[2].padStart(2, "0")}-${pub[3].padStart(2, "0")}` : null, fetchedAt }
}
export async function officialHtml(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  const parsed = new URL(url)
  if (parsed.protocol !== "https:" || !["zwgls.mof.gov.cn", "yss.mof.gov.cn", "www.mof.gov.cn"].includes(parsed.hostname)) throw new Error("Non-allowlisted official source")
  const r = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(9000) })
  if (!r.ok) throw new Error(`MOF HTTP ${r.status}`)
  const bytes = await r.arrayBuffer()
  if (bytes.byteLength > 2_000_000) throw new Error("MOF response too large")
  const utf = new TextDecoder().decode(bytes)
  return /charset\s*=\s*["']?gb/i.test(utf) ? new TextDecoder("gb18030").decode(bytes) : utf
}
export async function refreshMofHistory(archive: MofArchive, retrieve: (url: string) => Promise<string> = officialHtml): Promise<MofHistory> {
  const records = new Map<string, MofRecord>(archive.records.map(r => [r.date, r]))
  const warnings: string[] = []
  try {
    const html = await retrieve(ARCHIVES[0])
    const newest = parsePolicyList(html, ARCHIVES[0]).filter(p => /\d{4}年\d{1,2}月地方政府债券发行/.test(p.title)).slice(0, 2)
    if (!newest.length) throw new Error("MOF directory structure changed")
    const outcomes = await Promise.allSettled(newest.map(async p => {
      const record = parseMofArticle(await retrieve(p.url), p.title, p.url)
      if (!record) throw new Error("MOF article schema changed")
      const previous = records.get(record.date)
      if (!previous || (record.publishedAt ?? "") >= (previous.publishedAt ?? "")) records.set(record.date, record)
    }))
    if (outcomes.some(r => r.status === "rejected")) warnings.push("部分新公告未能解析，保留已归档历史")
  } catch { warnings.push("本次官网检查失败，保留已归档历史") }
  if (archive.errors.length) warnings.push(`历史采集存在${archive.errors.length}个失败项，完整性未确认`)
  const sorted = [...records.values()].sort((a, b) => a.date.localeCompare(b.date))
  const coverage = mofCoverage(sorted, archive.startYear)
  if (coverage.warning) warnings.push(coverage.warning)
  return { records: sorted, complete: warnings.length === 0 && coverage.complete, warning: warnings.length ? warnings.join("；") : null, startYear: archive.startYear }
}
let pending: { until: number; promise: Promise<MofHistory> } | undefined
export function mofHistory(fetcher: typeof fetch = fetch) {
  if (fetcher === fetch && pending && pending.until > Date.now()) return pending.promise
  const promise = refreshMofHistory(seed as MofArchive, url => officialHtml(url, fetcher))
  if (fetcher === fetch) pending = { until: Date.now() + 900000, promise }
  return promise
}
