import { fetchJson } from "@/lib/data-sources/_fetch"

export interface MempoolHashratePoint {
  timestamp: number
  hashrateHps: number
}

interface MempoolHashrateRow {
  timestamp: number
  avgHashrate: number
}

export async function fetchMempoolHashrateHistory(revalidate = 600): Promise<MempoolHashratePoint[]> {
  const payload = await fetchJson<{ hashrates?: MempoolHashrateRow[] }>(
    "https://mempool.space/api/v1/mining/hashrate/total",
    { revalidate, timeoutMs: 15_000 },
  )
  return (payload?.hashrates ?? [])
    .map((row) => ({
      timestamp: row.timestamp * 1000,
      hashrateHps: Number(row.avgHashrate),
    }))
    .filter(
      (row) => Number.isFinite(row.timestamp) && Number.isFinite(row.hashrateHps) && row.hashrateHps > 0,
    )
}
