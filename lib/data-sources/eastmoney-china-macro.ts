import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeStartDate } from "@/lib/time-range"

/**
 * Eastmoney 数据中心 (data.eastmoney.com/cjsj) exposes the same PBoC / NBS / 海关 /
 * 中债 monthly releases that akshare wraps, as keyless JSON. Two endpoint
 * generations coexist upstream; both return `{ result: { data, pages } }`.
 */
type EastmoneyEndpoint = "v1" | "legacy"

interface EastmoneyReportSpec {
  endpoint: EastmoneyEndpoint
  reportName: string
  /** Column list the v1 endpoint requires; "ALL" for legacy reports. */
  columns: string
  dateField: string
  sortColumns: string
  pageSize: number
  /** Monthly reports fit in one page; daily reports (LPR, yields) need pagination. */
  paginate: boolean
  /** Eastmoney filter expression, e.g. `(MUTUAL_TYPE="005")`. */
  filter?: string
}

export const EASTMONEY_REPORTS = {
  CURRENCY_SUPPLY: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_CURRENCY_SUPPLY",
    columns:
      "REPORT_DATE,TIME,BASIC_CURRENCY,BASIC_CURRENCY_SAME,BASIC_CURRENCY_SEQUENTIAL,CURRENCY,CURRENCY_SAME,CURRENCY_SEQUENTIAL,FREE_CASH,FREE_CASH_SAME,FREE_CASH_SEQUENTIAL",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  RMB_LOAN: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_RMB_LOAN",
    columns: "REPORT_DATE,TIME,RMB_LOAN,RMB_LOAN_SAME,RMB_LOAN_SEQUENTIAL,RMB_LOAN_ACCUMULATE,LOAN_ACCUMULATE_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  GOLD_CURRENCY: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_GOLD_CURRENCY",
    columns: "REPORT_DATE,TIME,GOLD_RESERVES,GOLD_RESERVES_SAME,GOLD_RESERVES_SEQUENTIAL,FOREX,FOREX_SAME,FOREX_SEQUENTIAL",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 1000,
    paginate: false,
  },
  FOREX_DEPOSIT: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_FOREX_DEPOSIT",
    columns: "REPORT_DATE,TIME,BASE,BASE_SAME,BASE_SEQUENTIAL,BASE_ACCUMULATE",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  FOREX_LOAN: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_FOREX_LOAN",
    columns: "REPORT_DATE,TIME,BASE,BASE_SAME,BASE_SEQUENTIAL,BASE_ACCUMULATE",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  CPI: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_CPI",
    columns:
      "REPORT_DATE,TIME,NATIONAL_SAME,NATIONAL_BASE,NATIONAL_SEQUENTIAL,NATIONAL_ACCUMULATE,CITY_SAME,CITY_BASE,CITY_SEQUENTIAL,CITY_ACCUMULATE,RURAL_SAME,RURAL_BASE,RURAL_SEQUENTIAL,RURAL_ACCUMULATE",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  PPI: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_PPI",
    columns: "REPORT_DATE,TIME,BASE,BASE_SAME,BASE_ACCUMULATE",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  PMI: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_PMI",
    columns: "REPORT_DATE,TIME,MAKE_INDEX,MAKE_SAME,NMAKE_INDEX,NMAKE_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  GDP: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_GDP",
    columns:
      "REPORT_DATE,TIME,DOMESTICL_PRODUCT_BASE,FIRST_PRODUCT_BASE,SECOND_PRODUCT_BASE,THIRD_PRODUCT_BASE,SUM_SAME,FIRST_SAME,SECOND_SAME,THIRD_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  CUSTOMS: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_CUSTOMS",
    columns:
      "REPORT_DATE,TIME,EXIT_BASE,IMPORT_BASE,EXIT_BASE_SAME,IMPORT_BASE_SAME,EXIT_BASE_SEQUENTIAL,IMPORT_BASE_SEQUENTIAL,EXIT_ACCUMULATE,IMPORT_ACCUMULATE,EXIT_ACCUMULATE_SAME,IMPORT_ACCUMULATE_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  ASSET_INVEST: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_ASSET_INVEST",
    columns: "REPORT_DATE,TIME,BASE,BASE_SAME,BASE_SEQUENTIAL,BASE_ACCUMULATE",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  TOTAL_RETAIL: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_TOTAL_RETAIL",
    columns: "REPORT_DATE,TIME,RETAIL_TOTAL,RETAIL_TOTAL_SAME,RETAIL_TOTAL_SEQUENTIAL,RETAIL_TOTAL_ACCUMULATE,RETAIL_ACCUMULATE_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 1000,
    paginate: false,
  },
  INDUS_GROW: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_INDUS_GROW",
    columns: "REPORT_DATE,TIME,BASE_SAME,BASE_ACCUMULATE",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  FAITH_INDEX: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_FAITH_INDEX",
    columns:
      "REPORT_DATE,TIME,CONSUMERS_FAITH_INDEX,FAITH_INDEX_SAME,FAITH_INDEX_SEQUENTIAL,CONSUMERS_ASTIS_INDEX,ASTIS_INDEX_SAME,ASTIS_INDEX_SEQUENTIAL,CONSUMERS_EXPECT_INDEX,EXPECT_INDEX_SAME,EXPECT_INDEX_SEQUENTIAL",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  FISCAL_INCOME: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_INCOME",
    columns: "REPORT_DATE,TIME,BASE,BASE_SAME,BASE_SEQUENTIAL,BASE_ACCUMULATE,ACCUMULATE_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  FDI: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_FDI",
    columns:
      "REPORT_DATE,TIME,ACTUAL_FOREIGN,ACTUAL_FOREIGN_SAME,ACTUAL_FOREIGN_SEQUENTIAL,ACTUAL_FOREIGN_ACCUMULATE,FOREIGN_ACCUMULATE_SAME",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 2000,
    paginate: false,
  },
  MUTUAL_DEAL_NORTH: {
    endpoint: "v1",
    reportName: "RPT_MUTUAL_DEAL_HISTORY",
    columns: "ALL",
    dateField: "TRADE_DATE",
    sortColumns: "TRADE_DATE",
    pageSize: 1000,
    paginate: true,
    filter: '(MUTUAL_TYPE="005")',
  },
  MUTUAL_DEAL_SOUTH: {
    endpoint: "v1",
    reportName: "RPT_MUTUAL_DEAL_HISTORY",
    columns: "ALL",
    dateField: "TRADE_DATE",
    sortColumns: "TRADE_DATE",
    pageSize: 1000,
    paginate: true,
    filter: '(MUTUAL_TYPE="006")',
  },
  MARGIN_DAILY: {
    endpoint: "v1",
    reportName: "RPTA_WEB_MARGIN_DAILYTRADE",
    columns: "ALL",
    dateField: "STATISTICS_DATE",
    sortColumns: "STATISTICS_DATE",
    pageSize: 500,
    paginate: true,
  },
  STOCK_STATISTICS: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_STOCK_STATISTICS",
    columns:
      "REPORT_DATE,TIME,TOTAL_SHARES_SH,TOTAL_MARKE_SH,DEAL_AMOUNT_SH,VOLUME_SH,HIGH_INDEX_SH,LOW_INDEX_SH,TOTAL_SZARES_SZ,TOTAL_MARKE_SZ,DEAL_AMOUNT_SZ,VOLUME_SZ,HIGH_INDEX_SZ,LOW_INDEX_SZ",
    dateField: "REPORT_DATE",
    sortColumns: "REPORT_DATE",
    pageSize: 1000,
    paginate: false,
  },
  DEPOSIT_RESERVE: {
    endpoint: "v1",
    reportName: "RPT_ECONOMY_DEPOSIT_RESERVE",
    columns:
      "REPORT_DATE,PUBLISH_DATE,TRADE_DATE,INTEREST_RATE_BB,INTEREST_RATE_BA,CHANGE_RATE_B,INTEREST_RATE_SB,INTEREST_RATE_SA,CHANGE_RATE_S,NEXT_SH_RATE,NEXT_SZ_RATE,REMARK",
    dateField: "TRADE_DATE",
    sortColumns: "PUBLISH_DATE,TRADE_DATE",
    pageSize: 2000,
    paginate: false,
  },
  LPR: {
    endpoint: "v1",
    reportName: "RPTA_WEB_RATE",
    columns: "ALL",
    dateField: "TRADE_DATE",
    sortColumns: "TRADE_DATE",
    pageSize: 500,
    paginate: true,
  },
  TREASURY_YIELD: {
    endpoint: "legacy",
    reportName: "RPTA_WEB_TREASURYYIELD",
    columns: "ALL",
    dateField: "SOLAR_DATE",
    sortColumns: "SOLAR_DATE",
    pageSize: 500,
    paginate: true,
  },
} as const satisfies Record<string, EastmoneyReportSpec>

export type EastmoneyReportId = keyof typeof EASTMONEY_REPORTS

type EastmoneyRow = Record<string, string | number | null | undefined>

interface EastmoneyPayload {
  result?: { data?: EastmoneyRow[]; pages?: number } | null
  success?: boolean
}

export interface EastmoneyFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

const V1_BASE = "https://datacenter-web.eastmoney.com/api/data/v1/get"
const LEGACY_BASE = "https://datacenter.eastmoney.com/api/data/get"
// Public token embedded in Eastmoney's own web pages for the legacy endpoint; not a secret.
const LEGACY_TOKEN = "894050c76af8597a853f5b408b759f5d"
const MAX_PAGES = 20
const REVALIDATE_SECONDS = 3600
const BROWSER_HEADERS = { "User-Agent": "Mozilla/5.0", Referer: "https://data.eastmoney.com/" }

function buildPageUrl(spec: EastmoneyReportSpec, page: number): string {
  if (spec.endpoint === "legacy") {
    const params = new URLSearchParams({
      type: spec.reportName,
      sty: "ALL",
      st: spec.sortColumns,
      sr: "-1",
      token: LEGACY_TOKEN,
      p: String(page),
      ps: String(spec.pageSize),
      pageNo: String(page),
      pageNum: String(page),
    })
    return `${LEGACY_BASE}?${params.toString()}`
  }
  const params = new URLSearchParams({
    reportName: spec.reportName,
    columns: spec.columns,
    sortColumns: spec.sortColumns,
    sortTypes: spec.sortColumns.includes(",") ? "-1,-1" : "-1",
    pageNumber: String(page),
    pageSize: String(spec.pageSize),
    source: "WEB",
    client: "WEB",
  })
  if (spec.columns === "ALL") params.set("token", LEGACY_TOKEN)
  if (spec.filter) params.set("filter", spec.filter)
  return `${V1_BASE}?${params.toString()}`
}

function parseRowDate(raw: unknown): { timestamp: number; date: string } | null {
  if (typeof raw !== "string" || raw.length < 10) return null
  const date = raw.slice(0, 10)
  const timestamp = new Date(`${date}T00:00:00Z`).getTime()
  return Number.isFinite(timestamp) ? { timestamp, date } : null
}

const inFlight = new Map<string, Promise<EastmoneyRow[]>>()

/**
 * Pull every page of a report until the oldest row predates `startDate`.
 * Rows come back newest-first from upstream; callers re-sort ascending.
 */
async function fetchReportRows(reportId: EastmoneyReportId, startDate: Date): Promise<EastmoneyRow[]> {
  const spec: EastmoneyReportSpec = EASTMONEY_REPORTS[reportId]
  const key = `${reportId}:${startDate.toISOString().slice(0, 7)}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const task = (async () => {
    const rows: EastmoneyRow[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages && page <= MAX_PAGES) {
      const payload = await fetchJson<EastmoneyPayload>(buildPageUrl(spec, page), {
        revalidate: REVALIDATE_SECONDS,
        headers: BROWSER_HEADERS,
      })
      const data = payload?.result?.data
      if (!data || data.length === 0) break
      rows.push(...data)
      if (!spec.paginate) break
      totalPages = payload.result?.pages ?? 1
      const oldest = parseRowDate(data.at(-1)?.[spec.dateField])
      if (oldest && oldest.timestamp < startDate.getTime()) break
      page += 1
    }
    return rows
  })()

  inFlight.set(key, task)
  try {
    return await task
  } finally {
    inFlight.delete(key)
  }
}

export interface EastmoneySeriesSpec {
  report: EastmoneyReportId
  field: string
  /** Optional second field subtracted from `field` (e.g. exports - imports, US10Y - CN10Y). */
  minusField?: string
  /** Optional second field added to `field` (e.g. SH + SZ market cap). */
  plusField?: string
  /** Multiplier applied to the raw upstream number (亿元 → 元 etc.). */
  scale?: number
}

/** Provider symbol format: `EM:<REPORT>:<FIELD>[+FIELD2|-FIELD2][*scale]`. */
export function parseEastmoneySymbol(providerSymbol: string): EastmoneySeriesSpec | null {
  const match = /^EM:([A-Z_]+):([A-Z0-9_]+)(?:([+-])([A-Z0-9_]+))?(?:\*([0-9.e+-]+))?$/.exec(providerSymbol)
  if (!match) return null
  const [, report, field, op, secondField, scaleText] = match
  if (!(report in EASTMONEY_REPORTS)) return null
  const scale = scaleText ? Number(scaleText) : undefined
  return {
    report: report as EastmoneyReportId,
    field,
    minusField: op === "-" ? secondField : undefined,
    plusField: op === "+" ? secondField : undefined,
    scale: scale !== undefined && Number.isFinite(scale) ? scale : undefined,
  }
}

function readNumber(row: EastmoneyRow, field: string): number | null {
  const raw = row[field]
  if (raw === null || raw === undefined || raw === "") return null
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : null
}

export async function fetchEastmoneySeries(
  providerSymbol: string,
  range: TimeRangeOption,
): Promise<EastmoneyFetchResult | null> {
  const spec = parseEastmoneySymbol(providerSymbol)
  if (!spec) return null

  const startDate = getRangeStartDate(range.id)
  const rows = await fetchReportRows(spec.report, startDate)
  if (rows.length === 0) return null

  const dateField = EASTMONEY_REPORTS[spec.report].dateField
  const byDate = new Map<string, MacroSeriesPoint>()
  for (const row of rows) {
    const parsed = parseRowDate(row[dateField])
    if (!parsed || parsed.timestamp < startDate.getTime()) continue
    const base = readNumber(row, spec.field)
    if (base === null) continue
    let value = base
    if (spec.minusField) {
      const other = readNumber(row, spec.minusField)
      if (other === null) continue
      value = base - other
    } else if (spec.plusField) {
      const other = readNumber(row, spec.plusField)
      if (other === null) continue
      value = base + other
    }
    if (spec.scale !== undefined) value *= spec.scale
    // Reports like DEPOSIT_RESERVE can list several rows per effective date; keep the first (newest publish).
    if (!byDate.has(parsed.date)) byDate.set(parsed.date, { timestamp: parsed.timestamp, date: parsed.date, value })
  }

  const history = Array.from(byDate.values()).sort((a, b) => a.timestamp - b.timestamp)
  if (history.length === 0) return null

  const latest = history[history.length - 1]
  const previous = history[history.length - 2] ?? latest
  return { history, currentValue: latest.value, previousValue: previous.value, lastUpdate: latest.timestamp }
}
