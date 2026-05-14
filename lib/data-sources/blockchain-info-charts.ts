import { fetchJson } from "@/lib/data-sources/_fetch"

interface BlockchainChartPayload {
  values?: { x: number; y: number }[]
}

/** BTC/USD closing index from Blockchain.com Charts API — official aggregated series. */
export async function fetchBtcUsdDailyFromBlockchain(
  /** ≥200 bars needed for SMA200; 2years ≈731 daily observations */
  timespan = "2years",
  revalidate = 300,
): Promise<{ points: Array<{ timestamp: number; close: number }> } | null> {
  const url = `https://api.blockchain.info/charts/market-price?timespan=${encodeURIComponent(timespan)}&interval=daily&format=json`
  const payload = await fetchJson<BlockchainChartPayload>(url, { revalidate, timeoutMs: 12_000 })
  const vals = payload?.values
  if (!vals?.length) return null

  const points = vals
    .map((point) => ({
      timestamp: point.x * 1000,
      close: Number(point.y),
    }))
    .filter((p) => Number.isFinite(p.close))

  return points.length >= 120 ? { points } : null
}

/**
 * Generic Blockchain.com chart fetcher — returns aligned daily points for
 * any of the public on-chain series (hash-rate, difficulty, n-transactions,
 * n-unique-addresses, mempool-size, transaction-fees-usd, …).
 *
 * No API key required.
 */
export async function fetchBlockchainInfoSeries(
  chart: string,
  timespan: string,
  revalidate = 1800,
): Promise<Array<{ timestamp: number; value: number }>> {
  const url = `https://api.blockchain.info/charts/${encodeURIComponent(
    chart,
  )}?timespan=${encodeURIComponent(timespan)}&interval=daily&format=json`
  const payload = await fetchJson<BlockchainChartPayload>(url, { revalidate, timeoutMs: 15_000 })
  return (payload?.values ?? [])
    .map((point) => ({ timestamp: point.x * 1000, value: Number(point.y) }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
}
