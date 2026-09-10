import { fetchJson } from "@/lib/data-sources/_fetch"
import type { MacroSeriesPoint } from "@/lib/types"
import type { TimeRangeOption } from "@/lib/time-range"
import { getRangeStartDate } from "@/lib/time-range"

/**
 * CFETS RMB exchange-rate indices from 中国外汇交易中心.
 *
 * `/ags/ms/cm-u-bk-fx/RmbIdxHis` is the JSON sibling of the Excel export the
 * pedquant R package uses, and returns all three baskets in one response. It is
 * the index the PBoC actually manages against: a flat index while USD/CNY moves
 * means the dollar moved, not the renminbi.
 *
 * The endpoint requires an explicit date window and pages, so a long range is
 * fetched year by year, newest first, until the requested start is covered.
 */

const BASE_URL = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-fx/RmbIdxHis"
const REVALIDATE_SECONDS = 6 * 3_600
const PAGE_TIMEOUT_MS = 4_000
// Same reasoning as the Eastmoney fetcher: /api/macro has a 10s budget to share.
const BUDGET_MS = 6_000
const PAGE_SIZE = 300
const MAX_WINDOWS = 12
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Referer: "https://www.chinamoney.com.cn/chinese/bkrmbidx/",
}

interface RmbIdxRecord {
  showDate?: string
  cfetsIndexRate?: number | string | null
  bisIndexRate?: number | string | null
  sdrIndexRate?: number | string | null
}

interface RmbIdxPayload {
  head?: { rep_code?: string }
  records?: RmbIdxRecord[]
}

const FIELD_BY_BASKET = {
  cfets: "cfetsIndexRate",
  bis: "bisIndexRate",
  sdr: "sdrIndexRate",
} as const

export type CfetsBasket = keyof typeof FIELD_BY_BASKET

/** Provider symbol format: `CFETS:<basket>`. */
export function parseCfetsSymbol(providerSymbol: string): CfetsBasket | null {
  const match = /^CFETS:(cfets|bis|sdr)$/.exec(providerSymbol)
  return match ? (match[1] as CfetsBasket) : null
}

export interface CfetsFetchResult {
  history: MacroSeriesPoint[]
  currentValue: number
  previousValue: number
  lastUpdate: number
}

const iso = (date: Date): string => date.toISOString().slice(0, 10)

const buildUrl = (start: string, end: string): string =>
  `${BASE_URL}?lang=CN&startDate=${start}&endDate=${end}&pageNum=1&pageSize=${PAGE_SIZE}`

const cache = new Map<string, { expires: number; promise: Promise<RmbIdxRecord[]> }>()
const CACHE_TTL_MS = 30 * 60_000

async function fetchWindows(startDate: Date): Promise<RmbIdxRecord[]> {
  const records: RmbIdxRecord[] = []
  const deadline = Date.now() + BUDGET_MS
  let windowEnd = new Date()

  for (let index = 0; index < MAX_WINDOWS; index += 1) {
    const windowStart = new Date(windowEnd)
    windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1)
    const from = windowStart < startDate ? startDate : windowStart

    const payload = await fetchJson<RmbIdxPayload>(buildUrl(iso(from), iso(windowEnd)), {
      revalidate: REVALIDATE_SECONDS,
      timeoutMs: PAGE_TIMEOUT_MS,
      headers: HEADERS,
    })
    const batch = payload?.records
    if (!batch || batch.length === 0) break
    records.push(...batch)

    if (from.getTime() <= startDate.getTime()) break
    // Out of budget: keep what we have — windows run newest-first, so the recent
    // end of the series is already covered.
    if (Date.now() >= deadline) break
    windowEnd = new Date(from)
    windowEnd.setUTCDate(windowEnd.getUTCDate() - 1)
  }

  return records
}

function getRecords(startDate: Date): Promise<RmbIdxRecord[]> {
  const key = iso(startDate).slice(0, 7)
  const cached = cache.get(key)
  const now = Date.now()
  if (cached && cached.expires > now) return cached.promise
  const promise = fetchWindows(startDate).catch(() => [])
  cache.set(key, { expires: now + CACHE_TTL_MS, promise })
  return promise
}

export async function fetchCfetsIndexSeries(
  providerSymbol: string,
  range: TimeRangeOption,
): Promise<CfetsFetchResult | null> {
  const basket = parseCfetsSymbol(providerSymbol)
  if (!basket) return null

  // The index series starts at its 2014-12-31 base; "max" should not ask for more.
  const requestedStart = range.id === "max" ? new Date("2014-12-31T00:00:00Z") : getRangeStartDate(range.id)
  const startDate = requestedStart < new Date("2014-12-31T00:00:00Z") ? new Date("2014-12-31T00:00:00Z") : requestedStart

  const records = await getRecords(startDate)
  if (records.length === 0) return null

  const field = FIELD_BY_BASKET[basket]
  const byDate = new Map<string, MacroSeriesPoint>()
  for (const record of records) {
    const date = typeof record.showDate === "string" ? record.showDate.slice(0, 10) : null
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const value = Number(record[field])
    if (!Number.isFinite(value)) continue
    if (!byDate.has(date)) byDate.set(date, { timestamp: new Date(`${date}T00:00:00Z`).getTime(), date, value })
  }

  const history = Array.from(byDate.values()).sort((a, b) => a.timestamp - b.timestamp)
  if (history.length === 0) return null

  const latest = history[history.length - 1]
  const previous = history[history.length - 2] ?? latest
  return { history, currentValue: latest.value, previousValue: previous.value, lastUpdate: latest.timestamp }
}
