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
