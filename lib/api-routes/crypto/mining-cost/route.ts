import { NextResponse } from "next/server"
import { fetchJson } from "@/lib/data-sources/_fetch"
import { fetchMempoolHashrateHistory } from "@/lib/data-sources/mempool"
import {
  computeMiningCostFromHashrateHps,
  resolveMiningCostParameters,
  type MiningCostPoint,
} from "@/lib/mining-cost"
import { DEFAULT_TIME_RANGE, getBlockchainTimespan, getRangeDays, getTimeRange } from "@/lib/time-range"

export const revalidate = 600

/**
 * Mining cost / electricity-cost proxy curves.
 *
 * We combine three public, free-tier feeds:
 *   - mempool.space network hashrate history (per-day avg hashrate in H/s)
 *   - blockchain.info market price (USD per BTC) for the same window
 *   - configurable miner efficiency, electricity rate, and comprehensive-cost multiplier
 *     so the curve can be tuned via env without breaking when keys are absent.
 *
 * Cost-of-production per BTC is approximated as:
 *   network_kWh_per_day = hashrate_TH/s * 86_400_s * efficiency_J/TH / 3.6e6
 *   btc_per_day         = 144 blocks/day * block_reward (3.125 post-2024 halving)
 *   electricity_cost    = network_kWh_per_day * electricity_rate / btc_per_day
 *   comprehensive_cost  = electricity_cost * comprehensive_multiplier
 *
 * This is intentionally a coarse proxy — what matters is the *shape* relative
 * to price, which is the actionable signal traders track (cost-of-production
 * vs. spot defines miner-capitulation regimes).
 */

interface BlockchainPriceEnvelope {
  values?: { x: number; y: number }[]
}

async function fetchBtcPriceHistory(timespan: string): Promise<{ time: number; price: number }[]> {
  const payload = await fetchJson<BlockchainPriceEnvelope>(
    `https://api.blockchain.info/charts/market-price?timespan=${encodeURIComponent(
      timespan,
    )}&format=json&cors=true`,
    { revalidate, timeoutMs: 15_000 },
  )
  return (payload?.values ?? [])
    .map((row) => ({ time: row.x * 1000, price: Number(row.y) }))
    .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.price) && row.price > 0)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
  const parameters = resolveMiningCostParameters(url.searchParams)

  const [hashrates, prices] = await Promise.all([
    fetchMempoolHashrateHistory(revalidate),
    fetchBtcPriceHistory(getBlockchainTimespan(range.id)),
  ])

  if (hashrates.length === 0) {
    return NextResponse.json(
      {
        error: "no_hashrate_data",
        source: "mempool.space",
        range: range.id,
        points: [],
      },
      { status: 502 },
    )
  }

  const days = getRangeDays(range.id)
  const horizonStart = Date.now() - days * 86_400_000

  // Nearest-price lookup
  const priceIndex = prices.length
    ? prices.sort((a, b) => a.time - b.time)
    : []

  function nearestPrice(time: number): number | null {
    if (priceIndex.length === 0) return null
    let lo = 0
    let hi = priceIndex.length - 1
    if (time <= priceIndex[lo].time) return priceIndex[lo].price
    if (time >= priceIndex[hi].time) return priceIndex[hi].price
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1
      if (priceIndex[mid].time <= time) lo = mid
      else hi = mid
    }
    const a = priceIndex[lo]
    const b = priceIndex[hi]
    return Math.abs(a.time - time) <= Math.abs(b.time - time) ? a.price : b.price
  }

  const points: MiningCostPoint[] = hashrates
    .filter((row) => row.timestamp >= horizonStart)
    .map((row) => {
      return computeMiningCostFromHashrateHps({
        time: row.timestamp,
        hashrateHps: row.hashrateHps,
        marketPriceUsd: nearestPrice(row.timestamp),
        parameters,
      })
    })

  const latest = points[points.length - 1] ?? null

  return NextResponse.json({
    source: "mempool.space hashrate × blockchain.info price (electricity + comprehensive cost model)",
    range: range.id,
    parameters,
    points,
    latest,
    updatedAt: Date.now(),
  })
}
