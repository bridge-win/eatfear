import { fetchJson } from "@/lib/data-sources/_fetch"

interface HashrateEnvelope {
  hashrates?: { timestamp: number; avgHashrate: number }[]
}

/** Network-wide estimated hashrate from mempool.space (rolling daily buckets). */
export async function fetchBtcNetworkHashrateRatioTail(
  revalidate = 300,
): Promise<{ ratioLastVsMeanTail: number } | null> {
  const payload = await fetchJson<HashrateEnvelope>("https://mempool.space/api/v1/mining/hashrate/total", {
    revalidate,
    timeoutMs: 15_000,
  })
  const rows = [...(payload?.hashrates ?? [])].sort((a, b) => a.timestamp - b.timestamp)
  if (rows.length < 16) return null
  const tail = rows.slice(-15)
  const last = tail[tail.length - 1]?.avgHashrate
  const mean = tail.slice(0, -1).reduce((s, row) => s + row.avgHashrate, 0) / (tail.length - 1)

  if (!Number.isFinite(last) || mean <= 0) return null
  return { ratioLastVsMeanTail: last / mean }
}
