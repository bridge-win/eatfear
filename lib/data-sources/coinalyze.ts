/**
 * Coinalyze — free derivatives history (api.coinalyze.net/v1).
 *
 * Why it is here: the only no-cost source of multi-year, exchange-reported
 * liquidation and open-interest history across venues. CoinGlass liquidation maps
 * are modelled; Binance's public liquidation snapshots for USDT-M stopped in
 * 2024-03; OKX keeps ~90 days. Coinalyze aggregates the exchanges' own feeds.
 *
 * Limits: a free API key (COINALYZE_API_KEY), 40 calls/minute, and every symbol in
 * a request counts as one call — so we discover the coin's perpetual symbols once,
 * cap them, and cache results for an hour.
 */

const BASE = process.env.COINALYZE_BASE_URL?.trim() || "https://api.coinalyze.net/v1"

export type CoinalyzeInterval = "1min" | "5min" | "15min" | "30min" | "1hour" | "2hour" | "4hour" | "6hour" | "12hour" | "daily"

export function toCoinalyzeInterval(intervalId: string): CoinalyzeInterval {
  switch (intervalId) {
    case "5m": return "5min"
    case "15m": return "15min"
    case "30m": return "30min"
    case "1h": return "1hour"
    case "4h": return "4hour"
    default: return "daily"          // 1d, 1w and anything else
  }
}

interface FutureMarket {
  symbol: string
  exchange: string
  base_asset: string
  quote_asset: string
  is_perpetual: boolean
}

async function get<T>(path: string, apiKey: string, revalidateSeconds: number): Promise<T> {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { next: { revalidate: revalidateSeconds }, headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`coinalyze_http_${res.status}`)
  return (await res.json()) as T
}

/** Perpetual symbols for a coin quoted in USD/USDT/USDC, capped so one request stays within budget. */
export async function discoverPerpSymbols(apiKey: string, ccy: string, max = 12): Promise<string[]> {
  const markets = await get<FutureMarket[]>("/future-markets", apiKey, 86_400)
  const quotes = new Set(["USDT", "USD", "USDC"])
  return markets
    .filter((m) => m.is_perpetual && m.base_asset === ccy && quotes.has(m.quote_asset))
    .map((m) => m.symbol)
    .slice(0, max)
}

export interface LiquidationBar { timestamp: number; longUsd: number; shortUsd: number }

/** Aggregated long/short liquidations (USD) per bar across the discovered venues. */
export async function fetchCoinalyzeLiquidations(
  apiKey: string, ccy: string, interval: CoinalyzeInterval, startMs: number, endMs: number, revalidateSeconds = 3600,
): Promise<LiquidationBar[]> {
  const symbols = await discoverPerpSymbols(apiKey, ccy)
  if (symbols.length === 0) return []
  const params = new URLSearchParams({ symbols: symbols.join(","), interval, from: String(Math.floor(startMs / 1000)), to: String(Math.floor(endMs / 1000)) })
  const rows = await get<{ symbol: string; history: { t: number; l: number; s: number }[] }[]>(`/liquidation-history?${params.toString()}`, apiKey, revalidateSeconds)
  const agg = new Map<number, LiquidationBar>()
  for (const r of rows) for (const h of r.history ?? []) {
    const ts = h.t * 1000
    const cur = agg.get(ts) ?? { timestamp: ts, longUsd: 0, shortUsd: 0 }
    cur.longUsd += Number(h.l) || 0
    cur.shortUsd += Number(h.s) || 0
    agg.set(ts, cur)
  }
  return [...agg.values()].sort((a, b) => a.timestamp - b.timestamp)
}

/** Aggregated open interest in USD (bar close) across the discovered venues. */
export async function fetchCoinalyzeOpenInterest(
  apiKey: string, ccy: string, interval: CoinalyzeInterval, startMs: number, endMs: number, revalidateSeconds = 3600,
): Promise<{ timestamp: number; value: number }[]> {
  const symbols = await discoverPerpSymbols(apiKey, ccy)
  if (symbols.length === 0) return []
  const params = new URLSearchParams({ symbols: symbols.join(","), interval, from: String(Math.floor(startMs / 1000)), to: String(Math.floor(endMs / 1000)), convert_to_usd: "true" })
  const rows = await get<{ symbol: string; history: { t: number; c: number }[] }[]>(`/open-interest-history?${params.toString()}`, apiKey, revalidateSeconds)
  const agg = new Map<number, number>()
  for (const r of rows) for (const h of r.history ?? []) agg.set(h.t * 1000, (agg.get(h.t * 1000) ?? 0) + (Number(h.c) || 0))
  return [...agg.entries()].map(([timestamp, value]) => ({ timestamp, value })).sort((a, b) => a.timestamp - b.timestamp)
}
