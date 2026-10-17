import { CN_SECURITIES, type CnSecurity } from "./security-catalog.ts"

export type StatementKind = "income" | "balance" | "cashflow"
type Row = Record<string, unknown>
type StatementRow = { date: string; publishedAt: string | null; values: Row }
export type CnFundamentalMetric = {
  id: "revenue" | "netIncome" | "operatingCashFlow" | "receivables" | "totalAssets" | "totalLiabilities" | "totalEquity"
  label: string
  basis: "year-to-date" | "period-end"
  current: number | null
  previous: number | null
  change: number | null
  yoyPercent: number | null
  unit: "CNY"
  applicability: "standard" | "bank-specific" | "not-applicable"
  note: string
}
export type CnFundamentalsResponse = {
  id: string
  status: "ok" | "partial" | "unavailable"
  reportDate: string | null
  comparisonDate: string | null
  periodLabel: string | null
  bank: boolean
  fetchedAt: string
  source: string
  sourceUrl: string
  officialUrl: string
  publicationDates: Record<StatementKind, string | null>
  comparisonPublicationDates: Record<StatementKind, string | null>
  latestAvailableDates: Record<StatementKind, string | null>
  metrics: CnFundamentalMetric[]
  warnings: string[]
}

const ENDPOINT = "https://datacenter-web.eastmoney.com/api/data/v1/get"
const MAX_BYTES = 1_000_000
const LOOKBACK = 12
const KINDS: StatementKind[] = ["income", "balance", "cashflow"]
const STOCKS = CN_SECURITIES.filter(s => s.kind === "stock")
const DATE_TYPES: Record<string, string> = { "03-31": "003", "06-30": "002", "09-30": "004", "12-31": "001" }
// Verified against the upstream tables and AKShare's maintained stock_report_em.py:
// https://github.com/akfamily/akshare/blob/main/akshare/stock_feature/stock_report_em.py
// These report-period tables contain cumulative income/cash flow, not single-quarter flows.
const REPORTS = {
  income: { name: "RPT_DMSK_FN_INCOME", fields: ["TOTAL_OPERATE_INCOME", "PARENT_NETPROFIT"] },
  balance: { name: "RPT_DMSK_FN_BALANCE", fields: ["ACCOUNTS_RECE", "TOTAL_ASSETS", "TOTAL_LIABILITIES", "TOTAL_EQUITY"] },
  cashflow: { name: "RPT_DMSK_FN_CASHFLOW", fields: ["NETCASH_OPERATE"] },
}
const cache = new Map<string, { until: number; data: CnFundamentalsResponse }>()
const pending = new Map<string, Promise<CnFundamentalsResponse>>()

export function isCnFundamentalsId(id: string): boolean {
  return STOCKS.some(s => s.id === id)
}
const calendarDate = (raw: unknown): string | null => {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|[ T])/.test(raw)) return null
  const day = raw.slice(0, 10)
  const time = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day ? day : null
}
const amount = (raw: unknown): number | null => {
  if (typeof raw !== "number" && (typeof raw !== "string" || !/^-?\d+(?:\.\d+)?$/.test(raw))) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
const blankDates = (): Record<StatementKind, string | null> => ({ income: null, balance: null, cashflow: null })

function statementRows(input: unknown, security: CnSecurity, today: string): Map<string, StatementRow> {
  if (!Array.isArray(input) || input.length > LOOKBACK) throw new Error("财报行数或结构异常")
  const result = new Map<string, StatementRow>()
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("财报行结构异常")
    const row = raw as Row
    if (row.SECURITY_CODE !== security.code) throw new Error("财报证券代码不匹配")
    const date = calendarDate(row.REPORT_DATE), publishedAt = calendarDate(row.NOTICE_DATE)
    if (!date || !DATE_TYPES[date.slice(5)] || row.DATE_TYPE_CODE !== DATE_TYPES[date.slice(5)] || row.REPORT_TYPE_CODE !== "001") throw new Error("财报报告期或报表类型不匹配")
    if (date > today || (publishedAt && publishedAt > today)) continue
    if (publishedAt && publishedAt < date) throw new Error("公告日期早于报告期")
    const previous = result.get(date)
    if (!previous || (publishedAt ?? "") > (previous.publishedAt ?? "")) result.set(date, { date, publishedAt, values: row })
    else if (publishedAt === previous.publishedAt && JSON.stringify(row) !== JSON.stringify(previous.values)) throw new Error("同一期同公告日期出现冲突财报")
  }
  return result
}

/** Match statements on a common period before comparing the exact prior-year period. */
export function assembleCnFundamentals(id: string, tables: Record<StatementKind, unknown>, now = Date.now()): CnFundamentalsResponse {
  const security = STOCKS.find(s => s.id === id)
  if (!security) throw new Error("Unsupported CN stock")
  const bank = security.id === "sh600036"
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10)
  const parsed = Object.fromEntries(KINDS.map(kind => [kind, statementRows(tables[kind], security, today)])) as Record<StatementKind, Map<string, StatementRow>>
  const common = [...parsed.income.keys()].filter(date => KINDS.every(k => parsed[k].has(date))).sort().reverse()
  const reportDate = common[0] ?? null
  const comparisonDate = reportDate ? `${Number(reportDate.slice(0, 4)) - 1}${reportDate.slice(4)}` : null
  const warnings = ["东方财富转引上市公司财报，需回到公司原始报告及附注复核；历史为当前修订版，非当时可知数据。金额单位为人民币元；利润与现金流为年初至报告期末累计，资产负债为期末存量。仅查询最近12个报告记录，不声明完整历史。"]
  const publicationDates = blankDates(), comparisonPublicationDates = blankDates(), latestAvailableDates = blankDates()
  for (const kind of KINDS) {
    latestAvailableDates[kind] = [...parsed[kind].keys()].sort().at(-1) ?? null
    publicationDates[kind] = reportDate ? parsed[kind].get(reportDate)?.publishedAt ?? null : null
    comparisonPublicationDates[kind] = comparisonDate ? parsed[kind].get(comparisonDate)?.publishedAt ?? null : null
  }
  const definitions: { id: CnFundamentalMetric["id"]; label: string; kind: StatementKind; field: string; note: string }[] = [
    { id: "revenue", label: "营业总收入", kind: "income", field: "TOTAL_OPERATE_INCOME", note: bank ? "银行营业收入与工业企业销售收入口径不同。" : "累计收入不等于新增订单或现金到账。" },
    { id: "netIncome", label: "归母净利润", kind: "income", field: "PARENT_NETPROFIT", note: "归属于母公司股东的净利润；不是合并净利润，也不是扣非净利润。" },
    { id: "operatingCashFlow", label: "经营活动现金流净额", kind: "cashflow", field: "NETCASH_OPERATE", note: bank ? "银行受存贷款及同业资金变动影响，不用工业企业现金转化率判断银行盈利质量。" : "按上年同一累计期间比较；仍需排除保理、结算时点、应付和预收变化。" },
    { id: "receivables", label: "应收账款", kind: "balance", field: "ACCOUNTS_RECE", note: bank ? "银行不适用工业企业应收账款框架，应另查不良、逾期和拨备。" : "期末应收账款；不包含全部合同资产，应收下降也可能来自核销或转让。" },
    { id: "totalAssets", label: "总资产", kind: "balance", field: "TOTAL_ASSETS", note: "期末合并总资产，需结合资产质量及减值附注。" },
    { id: "totalLiabilities", label: "总负债", kind: "balance", field: "TOTAL_LIABILITIES", note: bank ? "含客户存款等经营性资金，不能套用工业企业负债率评价。" : "总负债不是有息债务，也不是净债务。" },
    { id: "totalEquity", label: "股东权益合计", kind: "balance", field: "TOTAL_EQUITY", note: "合并权益含少数股东权益；不能直接用来计算归母ROE或每股净资产。" },
  ]
  const metrics = definitions.map((d): CnFundamentalMetric => {
    const notApplicable = bank && d.id === "receivables"
    const current = !notApplicable && reportDate ? amount(parsed[d.kind].get(reportDate)?.values[d.field]) : null
    const previous = !notApplicable && comparisonDate ? amount(parsed[d.kind].get(comparisonDate)?.values[d.field]) : null
    return { id: d.id, label: d.label, basis: d.kind === "balance" ? "period-end" : "year-to-date", current, previous, change: current !== null && previous !== null ? current - previous : null, yoyPercent: current !== null && previous !== null && previous > 0 ? (current / previous - 1) * 100 : null, unit: "CNY", applicability: notApplicable ? "not-applicable" : bank ? "bank-specific" : "standard", note: `${d.note}${previous !== null && previous <= 0 ? " 上年基数非正，仅比较金额差，不输出同比百分比。" : ""}` }
  })
  let status: CnFundamentalsResponse["status"] = "ok"
  if (!reportDate || !metrics.some(m => m.current !== null)) {
    status = "unavailable"
    warnings.push("三张报表没有可核对的共同报告期及有效数据；不跨期拼接，也不填0。")
  } else {
    if (KINDS.some(k => latestAvailableDates[k] !== reportDate)) { status = "partial"; warnings.push("不同报表的最新报告期不同，当前使用三表均有数据的最近共同报告期。") }
    if (metrics.some(m => m.applicability !== "not-applicable" && (m.current === null || m.previous === null))) { status = "partial"; warnings.push("部分字段或上年同期缺失，仅比较可核对的同口径值。") }
    if (KINDS.some(k => publicationDates[k] === null || comparisonPublicationDates[k] === null)) { status = "partial"; warnings.push("部分公告日期缺失，不据此进行当时可知回测。") }
    if ((now - Date.parse(`${reportDate}T00:00:00+08:00`)) / 86400000 > 200) { status = "partial"; warnings.push("共同报告期距今超过200天，数据可能陈旧，需检查公司最新披露。") }
  }
  if (bank) warnings.push("银行采用专门研究口径；本表未接入净息差、不良率、拨备覆盖率及资本充足率，不据此自动评估银行投资价值。")
  const periodLabel = reportDate ? `${reportDate.slice(0, 4)}年${({ "03-31": "1—3月", "06-30": "1—6月", "09-30": "1—9月", "12-31": "全年" } as Record<string, string>)[reportDate.slice(5)]}` : null
  return { id, status, reportDate, comparisonDate, periodLabel, bank, fetchedAt: new Date(now).toISOString(), source: "东方财富 · 上市公司三大报表", sourceUrl: `https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/Index?type=web&code=${id}`, officialUrl: security.officialUrl, publicationDates, comparisonPublicationDates, latestAvailableDates, metrics, warnings }
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`财报上游 HTTP ${response.status}`)
  if (!response.body || Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("财报响应为空或过大")
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BYTES) throw new Error("财报响应过大")
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export async function getCnFundamentals(id: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<CnFundamentalsResponse> {
  const security = STOCKS.find(s => s.id === id)
  if (!security) throw new Error("Unsupported CN stock")
  const cached = fetcher === fetch ? cache.get(id) : undefined
  if (cached && cached.until > now) return cached.data
  if (fetcher === fetch && pending.has(id)) return pending.get(id)!
  const task = (async () => {
    try {
      const signal = AbortSignal.timeout(8000)
      const results = await Promise.all(KINDS.map(async kind => {
        const report = REPORTS[kind]
        const params = new URLSearchParams({ reportName: report.name, columns: ["SECURITY_CODE", "REPORT_DATE", "NOTICE_DATE", "REPORT_TYPE_CODE", "DATE_TYPE_CODE", ...report.fields].join(","), filter: `(SECURITY_CODE="${security.code}")(REPORT_TYPE_CODE="001")`, pageSize: String(LOOKBACK), pageNumber: "1", sortColumns: "REPORT_DATE,NOTICE_DATE", sortTypes: "-1,-1", source: "WEB", client: "WEB" })
        const body = await boundedJson(await fetcher(`${ENDPOINT}?${params}`, { signal, redirect: "error", cache: "no-store", headers: { Accept: "application/json", Referer: "https://data.eastmoney.com/", "User-Agent": "Mozilla/5.0" } })) as { success?: boolean; result?: { data?: unknown } }
        if (!body || body.success !== true || !Array.isArray(body.result?.data)) throw new Error("财报上游字段或权限发生变化")
        return [kind, body.result.data] as const
      }))
      return assembleCnFundamentals(id, Object.fromEntries(results) as Record<StatementKind, unknown>, now)
    } catch (error) {
      const data = assembleCnFundamentals(id, { income: [], balance: [], cashflow: [] }, now)
      const reason = error instanceof Error && /^(财报|同一期|公告日期)/.test(error.message) ? error.message : "财报服务暂不可用"
      data.warnings.push(`${reason}；请通过原始披露复核，未使用模拟财务数据。`)
      return data
    }
  })()
  if (fetcher !== fetch) return task
  pending.set(id, task)
  try {
    const data = await task
    cache.set(id, { until: now + (data.status === "ok" ? 900000 : 60000), data })
    return data
  } finally { pending.delete(id) }
}
