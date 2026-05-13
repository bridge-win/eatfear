const BASE = process.env.COINGLASS_BASE_URL?.trim() || "https://open-api-v4.coinglass.com"

export interface CoinGlassEtfFlowDay {
  timestamp: number
  flow_usd: number
  price_usd?: number
  etf_flows?: { etf_ticker: string; flow_usd: number }[]
}

interface CoinGlassListResponse<T> {
  code?: string | number
  msg?: string
  data?: T
}

interface ExchangeBalanceRow {
  exchange_name: string
  total_balance: number
  balance_change_percent_7d?: number
}

/** CoinGlass aggregated exchange balance breakdown (weighted by holdings). */
export function weightedAvgPercent7d(entries: ExchangeBalanceRow[]): number | null {
  if (entries.length === 0) return null
  let weighted = 0
  let den = 0
  for (const row of entries) {
    const w = Number(row.total_balance)
    const pct = row.balance_change_percent_7d
    if (!Number.isFinite(w) || w <= 0 || pct === undefined || !Number.isFinite(pct)) continue
    weighted += w * pct
    den += w
  }
  return den > 0 ? weighted / den : null
}

async function cgGet<T>(
  path: string,
  apiKey: string,
  revalidate = 120,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = apiKey.trim()
  if (!key) return { ok: false, error: "COINGLASS_API_KEY_missing" }

  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "CG-API-KEY": key,
      },
      next: { revalidate },
    })
    const raw = await response.json()
    const payload = raw as CoinGlassListResponse<T>
    if ((payload.code === "0" || payload.code === 0) && payload.data !== undefined) {
      return { ok: true, data: payload.data }
    }
    const msg = typeof payload.msg === "string" ? payload.msg : `http_${response.status}`
    return { ok: false, error: msg }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "CoinGlass_fetch_error" }
  }
}

/** Daily Bitcoin spot ETF aggregated USD flows (all US-listed products in CoinGlass aggregation). */
export async function fetchBitcoinEtfFlowHistory(
  apiKey: string,
  revalidate = 120,
): Promise<EtfFlowsSummary | { error: string }> {
  const res = await cgGet<CoinGlassEtfFlowDay[]>(`/api/etf/bitcoin/flow-history`, apiKey, revalidate)
  if (!res.ok) return { error: res.error }

  const rows = [...(res.data ?? [])].sort((a, b) => a.timestamp - b.timestamp)

  /** Last N calendar rows (sparse on weekends/holidays — CoinGlass aligns to trading dates). */
  const last5 = rows.slice(-5)
  const last7 = rows.slice(-7)
  const prev7 = rows.length >= 14 ? rows.slice(-14, -7) : []
  const sum5d = last5.reduce((s, row) => s + Number(row.flow_usd ?? 0), 0)
  const avg5dDaily = last5.length > 0 ? sum5d / last5.length : null
  const avgLast7 =
    last7.length > 0 ? last7.reduce((s, r) => s + Number(r.flow_usd ?? 0), 0) / last7.length : null
  const avgPrev7 =
    prev7.length > 0 ? prev7.reduce((s, r) => s + Number(r.flow_usd ?? 0), 0) / prev7.length : null

  return {
    lastUpdatedMs: rows[rows.length - 1]?.timestamp ?? Date.now(),
    sumNetUsd5Sessions: Number.isFinite(sum5d) ? sum5d : null,
    avgDailyUsdLast5: avg5dDaily,
    avgDailyUsdLast7: avgLast7,
    avgDailyUsdPrev7: avgPrev7,
    dailyDeltaVsPriorWeekUsd:
      avgLast7 !== null && avgPrev7 !== null ? avgLast7 - avgPrev7 : null,
    sortedDaysAsc: rows,
  }
}

export interface EtfFlowsSummary {
  lastUpdatedMs: number
  sumNetUsd5Sessions: number | null
  avgDailyUsdLast5: number | null
  avgDailyUsdLast7: number | null
  avgDailyUsdPrev7: number | null
  dailyDeltaVsPriorWeekUsd: number | null
  sortedDaysAsc: CoinGlassEtfFlowDay[]
}

export async function fetchExchangeBalanceWeightedPct7d(
  apiKey: string,
  symbol: string,
  revalidate = 120,
): Promise<number | null> {
  const res = await cgGet<ExchangeBalanceRow[]>(`/api/exchange/balance/list?symbol=${encodeURIComponent(symbol)}`, apiKey, revalidate)
  if (!res.ok) return null
  return weightedAvgPercent7d(res.data ?? [])
}
