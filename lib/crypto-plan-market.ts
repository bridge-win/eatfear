import { cleanTradeBars, HORIZONS, type Horizon, type TradeBar } from "./crypto-trade-plan.ts"

export interface PlanMarketData { bars: TradeBar[]; source: string; market: string; warnings: string[] }

async function json(url: string, timeoutMs = 8_000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), next: { revalidate: 30 }, headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`upstream_http_${response.status}`)
  return response.json()
}

export function parseBinanceBars(rows: unknown): TradeBar[] {
  if (!Array.isArray(rows)) throw new Error("invalid_binance_response")
  return rows.filter(Array.isArray).map((r) => ({ time: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]), quoteVolume: Number(r[7]), takerBuyQuote: r[10] === undefined || r[10] === null || r[10] === "" ? null : Number(r[10]) }))
}

export async function fetchPlanMarket(ccy: string, horizon: Horizon, asOf: number): Promise<PlanMarketData> {
  const cfg = HORIZONS[horizon]
  const warnings: string[] = []
  try {
    const source = `https://data-api.binance.vision/api/v3/klines?symbol=${ccy}USDT&interval=${cfg.interval}&limit=500`
    const bars = cleanTradeBars(parseBinanceBars(await json(source, 25_000)), cfg.stepMs, asOf)
    if (bars.length < 220) throw new Error("insufficient_binance_history")
    return { bars, source, market: `Binance ${ccy}/USDT spot`, warnings }
  } catch { warnings.push("binance_unavailable") }
  const rows: string[][] = []
  const bar = horizon === "2d" ? "1H" : horizon === "2w" ? "4H" : "1Dutc"
  let after = asOf + 1
  const source = "https://www.okx.com/api/v5/market/history-candles"
  for (let page = 0; page < 3; page++) {
    const response = await json(`${source}?instId=${ccy}-USDT&bar=${bar}&limit=100&after=${after}`) as { code?: string; data?: string[][] }
    if (response.code !== "0" || !Array.isArray(response.data) || response.data.length === 0) break
    rows.push(...response.data)
    const oldest = Math.min(...response.data.map((r) => Number(r[0])))
    if (!Number.isFinite(oldest) || oldest >= after) break
    after = oldest
  }
  const bars = cleanTradeBars(rows.filter((r) => r[8] === "1").map((r) => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], quoteVolume: +r[7], takerBuyQuote: null })), cfg.stepMs, asOf)
  if (bars.length < 220) throw new Error("market_history_unavailable")
  return { bars, source, market: `OKX ${ccy}/USDT spot`, warnings: [...warnings, "aggressor_flow_missing"] }
}
