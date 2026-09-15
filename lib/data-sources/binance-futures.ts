/**
 * Binance USDT-M futures public endpoints with multi-year history and no API key.
 *
 * Why this exists: OKX keeps ~90 days of liquidation orders and its rubik stats
 * are shallow, so a 1-year chart of funding, taker flow or liquidations from OKX
 * alone is mostly empty. Binance's funding-rate history goes back to 2019-09 and
 * its klines carry taker-buy volume per candle, which is enough to rebuild CVD
 * and taker imbalance over the full window.
 */

const FAPI = process.env.BINANCE_FAPI_BASE_URL?.trim() || "https://fapi.binance.com"

export interface FundingPoint { timestamp: number; rate: number }
export interface FuturesKline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  takerBuyBase: number
  takerBuyQuote: number
}

async function getJson<T>(url: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(url, { next: { revalidate: revalidateSeconds }, headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`binance_http_${res.status}`)
  return (await res.json()) as T
}

/** Full funding history in [startMs, endMs], 1000 rows per page, ascending. */
export async function fetchBinanceFundingHistory(symbol: string, startMs: number, endMs: number, revalidateSeconds = 3600): Promise<FundingPoint[]> {
  const out: FundingPoint[] = []
  let cursor = startMs
  for (let page = 0; page < 60 && cursor < endMs; page++) {
    const url = `${FAPI}/fapi/v1/fundingRate?symbol=${symbol}&startTime=${cursor}&endTime=${endMs}&limit=1000`
    const rows = await getJson<{ fundingTime: number; fundingRate: string }[]>(url, revalidateSeconds)
    if (!rows.length) break
    for (const r of rows) out.push({ timestamp: Number(r.fundingTime), rate: Number(r.fundingRate) })
    const last = Number(rows[rows.length - 1].fundingTime)
    if (rows.length < 1000 || last <= cursor) break
    cursor = last + 1
  }
  return out
}

export type BinanceInterval = "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w"

/** Klines in [startMs, endMs], 1500 per page. Field 9 is taker-buy base volume. */
export async function fetchBinanceFuturesKlines(symbol: string, interval: BinanceInterval, startMs: number, endMs: number, revalidateSeconds = 3600): Promise<FuturesKline[]> {
  const out: FuturesKline[] = []
  let cursor = startMs
  for (let page = 0; page < 80 && cursor < endMs; page++) {
    const url = `${FAPI}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${cursor}&endTime=${endMs}&limit=1500`
    const rows = await getJson<(string | number)[][]>(url, revalidateSeconds)
    if (!rows.length) break
    for (const r of rows) {
      out.push({
        openTime: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]),
        volume: Number(r[5]), quoteVolume: Number(r[7]), takerBuyBase: Number(r[9]), takerBuyQuote: Number(r[10]),
      })
    }
    const last = Number(rows[rows.length - 1][0])
    if (rows.length < 1500 || last <= cursor) break
    cursor = last + 1
  }
  return out
}
