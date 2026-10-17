import { CN_SECURITIES, type CnSecurity, type CnSecurityQuote, type CnSecuritiesResponse } from "./security-catalog.ts"
export { CN_SECURITIES } from "./security-catalog.ts"
export type { CnSecurity, CnSecurityQuote, CnSecuritiesResponse } from "./security-catalog.ts"

type Fetcher = typeof fetch
const SOURCE_URL = "https://gu.qq.com/"
const QUOTE_URL = `https://qt.gtimg.cn/q=${CN_SECURITIES.map(s => s.id).join(",")}`
const MAX_BYTES = 100_000
const DAY = 86_400_000
let cached: { until: number; data: CnSecuritiesResponse } | undefined
let inflight: Promise<CnSecuritiesResponse> | undefined

function numeric(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^-?\d+(?:\.\d+)?$/.test(raw)) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}
function positive(raw: unknown): number | null {
  const value = numeric(raw)
  return value !== null && value > 0 ? value : null
}
function nonnegative(raw: unknown): number | null {
  const value = numeric(raw)
  return value !== null && value >= 0 ? value : null
}
function quoteTime(raw: string, now: number): string {
  if (!/^\d{14}$/.test(raw)) throw new Error("报价时间格式异常")
  const local = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`
  const timestamp = Date.parse(`${local}+08:00`)
  if (!Number.isFinite(timestamp) || new Date(timestamp + 8 * 3600000).toISOString().slice(0, 19) !== local || timestamp > now + 5 * 60000 || timestamp < Date.UTC(2000, 0, 1)) throw new Error("报价时间不可信")
  return `${local}+08:00`
}

/** Parse data only: the upstream response is JavaScript-shaped text and is never executed. */
export function parseTencentSecurityQuote(raw: string, security: CnSecurity, now = Date.now()): CnSecurityQuote {
  if (!CN_SECURITIES.some(s => s.id === security.id && s.code === security.code && s.kind === security.kind && s.exchange === security.exchange)) throw new Error("不支持的证券")
  const fields = raw.split("~")
  if (fields.length < 62 || fields[2] !== security.code || fields[0] !== (security.exchange === "SSE" ? "1" : "51")) throw new Error("证券代码或报价结构不匹配")
  if (fields[61].trim() !== (security.kind === "stock" ? "GP-A" : "ETF")) throw new Error("证券类别与报价结构不匹配")
  const price = positive(fields[3]), previousClose = positive(fields[4])
  const changePercent = numeric(fields[32])
  if (price === null || previousClose === null || changePercent === null || Math.abs((price / previousClose - 1) * 100 - changePercent) > 0.025) throw new Error("报价或涨跌幅校验失败")
  const quotedAt = quoteTime(fields[30], now)
  const lots = nonnegative(fields[36])
  const detail = fields[35].split("/")
  const turnover = detail.length === 3 && positive(detail[0]) === price && nonnegative(detail[1]) === lots ? nonnegative(detail[2]) : null
  return {
    price, previousClose, changePercent, quotedAt, currency: "CNY",
    // Tencent's own quote adapter labels field 39 only as `syl`, whereas 52/53
    // explicitly name dynamic/LYR ratios. Do not assert an unverified TTM basis.
    peTtm: null,
    // Official Tencent web quote adapter maps PB (sjl) to field 46. ETF PB is
    // not a portfolio valuation and is deliberately unavailable here.
    pb: security.kind === "stock" ? positive(fields[46]) : null,
    volumeShares: lots === null ? null : lots * 100,
    turnoverCny: turnover,
    freshness: now - Date.parse(quotedAt) <= 3 * DAY ? "recent" : "stale",
  }
}

export function parseTencentSecurityBatch(text: string, now = Date.now()): CnSecuritiesResponse["items"] {
  if (text.length > MAX_BYTES) throw new Error("上游报价响应过大")
  const rows = new Map<string, string>()
  const duplicates = new Set<string>()
  for (const match of text.matchAll(/(?:^|\n)\s*v_((?:sh|sz)\d{6})="([^"\r\n]*)";?/g)) {
    if (rows.has(match[1])) duplicates.add(match[1])
    rows.set(match[1], match[2])
  }
  return CN_SECURITIES.map(security => {
    try {
      if (duplicates.has(security.id)) throw new Error("上游重复证券记录")
      const row = rows.get(security.id)
      if (!row) throw new Error("上游未返回该证券报价")
      return { security, quote: parseTencentSecurityQuote(row, security, now) }
    } catch (error) {
      return { security, quote: null, error: error instanceof Error ? error.message : "报价暂不可用" }
    }
  })
}

async function boundedText(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("上游报价响应过大")
  if (!response.body) throw new Error("上游报价响应为空")
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) throw new Error("上游报价响应过大")
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  const result = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder("gb18030").decode(result)
}

export async function getCnSecurities(fetcher: Fetcher = fetch, now = Date.now()): Promise<CnSecuritiesResponse> {
  if (fetcher === fetch && cached && cached.until > now) return cached.data
  if (fetcher === fetch && inflight) return inflight
  const task = (async (): Promise<CnSecuritiesResponse> => {
    let items: CnSecuritiesResponse["items"]
    try {
      // One whitelist-only batch, one request in flight, bounded body, fixed deadline.
      const response = await fetcher(QUOTE_URL, { signal: AbortSignal.timeout(8000), redirect: "error", cache: "no-store", headers: { Referer: SOURCE_URL, "User-Agent": "Mozilla/5.0" } })
      if (!response.ok) throw new Error(`行情上游 HTTP ${response.status}`)
      items = parseTencentSecurityBatch(await boundedText(response), now)
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "报价请求超时" : error instanceof Error && error.message.startsWith("行情上游 HTTP") ? error.message : "行情服务暂不可用；请通过官方资料继续研究"
      items = CN_SECURITIES.map(security => ({ security, quote: null, error: reason }))
    }
    const available = items.filter(item => item.quote).length
    return {
      status: available === items.length && items.every(item => item.quote?.freshness === "recent") ? "ok" : available ? "partial" : "unavailable",
      fetchedAt: new Date(now).toISOString(), source: "腾讯财经公开延迟行情", sourceUrl: SOURCE_URL,
      warning: "研究样本由官方资料核验身份，专题映射是待验证假设。报价来自腾讯，可能延迟；近3个自然日内标为近期（含周末），未核验节假日交易日历，超过3日标为陈旧。报价时间不是财报发布日期。PE(TTM)口径未独立核验，留空；PB仅展示个股供应商值，需与最新财报交叉核对。4只样本股票财报可在详情核对；ETF估值、净值、折溢价及持仓尚未自动接入。",
      items,
    }
  })()
  if (fetcher !== fetch) return task
  inflight = task
  try {
    const data = await task
    cached = { until: now + (data.status === "ok" ? 60000 : 15000), data }
    return data
  } finally { inflight = undefined }
}
