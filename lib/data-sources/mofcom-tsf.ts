import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeStartDate } from "@/lib/time-range"

/**
 * 社会融资规模增量 (Total Social Financing flow). PBoC publishes it only as
 * monthly press releases; 商务部数据中心 mirrors the table as a keyless JSON POST.
 * The endpoint returns an array of row objects whose *key order* is stable but
 * whose key names are opaque, so rows are read positionally — the same contract
 * akshare's `macro_china_shrzgm` has relied on since 2021.
 *
 * Positional layout (all 亿元 except the month label):
 *   0 月份 (YYYYMM) · 1 未贴现银行承兑汇票 · 2 委托贷款 · 3 外币贷款(折人民币)
 *   4 人民币贷款 · 5 企业债券 · 6 社会融资规模增量 · 7 非金融企业境内股票融资 · 8 信托贷款
 */

const TSF_URL = "https://data.mofcom.gov.cn/datamofcom/front/gnmy/shrzgmQuery"
const REVALIDATE_SECONDS = 6 * 3_600
// Kept under the route's 10s budget; see the note in eastmoney-china-macro.ts.
const TIMEOUT_MS = 4_000

export const MOFCOM_TSF_FIELDS = {
  TSF_TOTAL: 6,
  TSF_RMB_LOANS: 4,
  TSF_CORP_BONDS: 5,
  TSF_EQUITY: 7,
  TSF_TRUST_LOANS: 8,
  TSF_ENTRUSTED_LOANS: 2,
  TSF_UNDISCOUNTED_BA: 1,
  TSF_FX_LOANS: 3,
} as const

export type MofcomTsfField = keyof typeof MOFCOM_TSF_FIELDS

export interface MofcomTsfFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

type RawRow = Record<string, unknown>

let cached: { expires: number; promise: Promise<RawRow[] | null> } | null = null

async function fetchRows(): Promise<RawRow[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(TSF_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        Referer: "https://data.mofcom.gov.cn/gnmy/shrzgm.shtml",
        Accept: "application/json, text/plain, */*",
      },
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as unknown
    const rows = Array.isArray(payload) ? payload : (payload as { data?: unknown })?.data
    return Array.isArray(rows) ? (rows as RawRow[]) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function getRows(): Promise<RawRow[] | null> {
  const now = Date.now()
  if (cached && cached.expires > now) return cached.promise
  const promise = fetchRows().catch(() => null)
  cached = { expires: now + 10 * 60_000, promise }
  return promise
}

const parseMonth = (raw: unknown): string | null => {
  const text = String(raw ?? "").replace(/[^0-9]/g, "")
  if (text.length < 6) return null
  const year = Number(text.slice(0, 4))
  const month = Number(text.slice(4, 6))
  if (!(year >= 2000 && month >= 1 && month <= 12)) return null
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

export function parseMofcomTsfSymbol(providerSymbol: string): MofcomTsfField | null {
  const match = /^MOFCOM:(TSF_[A-Z_]+)$/.exec(providerSymbol)
  if (!match) return null
  return match[1] in MOFCOM_TSF_FIELDS ? (match[1] as MofcomTsfField) : null
}

export async function fetchMofcomTsfSeries(
  providerSymbol: string,
  range: TimeRangeOption,
): Promise<MofcomTsfFetchResult | null> {
  const field = parseMofcomTsfSymbol(providerSymbol)
  if (!field) return null
  const rows = await getRows()
  if (!rows || rows.length === 0) return null

  const position = MOFCOM_TSF_FIELDS[field]
  const startMs = getRangeStartDate(range.id).getTime()
  const byDate = new Map<string, MacroSeriesPoint>()
  for (const row of rows) {
    const values = Object.values(row)
    if (values.length < 9) continue
    const date = parseMonth(values[0])
    if (!date) continue
    const value = Number(values[position])
    if (!Number.isFinite(value)) continue
    const timestamp = new Date(`${date}T00:00:00Z`).getTime()
    if (!byDate.has(date)) byDate.set(date, { timestamp, date, value: value * 100_000_000 })
  }

  const history = Array.from(byDate.values()).sort((a, b) => a.timestamp - b.timestamp)
  if (history.length === 0) return null

  const inRange = history.filter((point) => point.timestamp >= startMs)
  const visible = inRange.length >= 2 ? inRange : history.slice(-2)
  const latest = visible[visible.length - 1]
  const previous = visible[visible.length - 2] ?? latest
  return { history: visible, currentValue: latest.value, previousValue: previous.value, lastUpdate: latest.timestamp }
}
