import { NextResponse } from "next/server"
import { fetchJson } from "@/lib/data-sources/_fetch"
import { DEFAULT_TIME_RANGE, getBlockchainTimespan, getRangeDays, getTimeRange } from "@/lib/time-range"

export const revalidate = 600

/**
 * Mining cost / electricity-cost proxy curve.
 *
 * We combine three public, free-tier feeds:
 *   - mempool.space network hashrate history (per-day avg hashrate in H/s)
 *   - blockchain.info market price (USD per BTC) for the same window
 *   - a configurable miner efficiency (J/TH) and electricity rate (USD/kWh)
 *     so the curve can be tuned via env without breaking when keys are absent.
 *
 * Cost-of-production per BTC is approximated as:
 *   network_kWh_per_day = hashrate_TH/s * 86_400_s * efficiency_J/TH / 3.6e6
 *   btc_per_day         = 144 blocks/day * block_reward (3.125 post-2024 halving)
 *   cost_per_btc        = network_kWh_per_day * electricity_rate / btc_per_day
 *
 * This is intentionally a coarse proxy — what matters is the *shape* relative
 * to price, which is the actionable signal traders track (cost-of-production
 * vs. spot defines miner-capitulation regimes).
 */

const DEFAULT_EFFICIENCY_J_PER_TH = Number(process.env.MINING_EFFICIENCY_J_PER_TH ?? 21) // mid-fleet ASIC
const DEFAULT_ELEC_USD_PER_KWH = Number(process.env.MINING_ELECTRICITY_USD_PER_KWH ?? 0.05)
const HALVING_BLOCK_REWARD = 3.125 // post-Apr-2024 halving

interface HashrateRow {
  timestamp: number
  avgHashrate: number // H/s
}

async function fetchHashrateHistory(): Promise<HashrateRow[]> {
  const payload = await fetchJson<{ hashrates?: HashrateRow[] }>(
    "https://mempool.space/api/v1/mining/hashrate/total",
    { revalidate, timeoutMs: 15_000 },
  )
  return (payload?.hashrates ?? []).filter(
    (row) => Number.isFinite(row.timestamp) && Number.isFinite(row.avgHashrate) && row.avgHashrate > 0,
  )
}

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

interface CostPoint {
  time: number
  hashrate: number // EH/s
  electricityUsdPerBtc: number
  marketPriceUsd: number | null
  marginPct: number | null // (price - cost) / cost * 100
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const range = getTimeRange(url.searchParams.get("range") ?? DEFAULT_TIME_RANGE)
  const efficiency =
    Number(url.searchParams.get("efficiency")) > 0
      ? Number(url.searchParams.get("efficiency"))
      : DEFAULT_EFFICIENCY_J_PER_TH
  const electricityRate =
    Number(url.searchParams.get("rate")) > 0
      ? Number(url.searchParams.get("rate"))
      : DEFAULT_ELEC_USD_PER_KWH

  const [hashrates, prices] = await Promise.all([
    fetchHashrateHistory(),
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

  const btcPerDay = 144 * HALVING_BLOCK_REWARD

  const points: CostPoint[] = hashrates
    .filter((row) => row.timestamp * 1000 >= horizonStart)
    .map((row) => {
      const time = row.timestamp * 1000
      const hashrateThPerSec = row.avgHashrate / 1e12
      const networkKwhPerDay = (hashrateThPerSec * 86_400 * efficiency) / 3.6e6
      const electricityUsdPerBtc = (networkKwhPerDay * electricityRate) / btcPerDay
      const marketPriceUsd = nearestPrice(time)
      const marginPct =
        marketPriceUsd && marketPriceUsd > 0 && electricityUsdPerBtc > 0
          ? ((marketPriceUsd - electricityUsdPerBtc) / electricityUsdPerBtc) * 100
          : null
      return {
        time,
        hashrate: row.avgHashrate / 1e18,
        electricityUsdPerBtc,
        marketPriceUsd,
        marginPct,
      }
    })

  const latest = points[points.length - 1] ?? null

  return NextResponse.json({
    source: "mempool.space hashrate × blockchain.info price (efficiency / electricity-rate model)",
    range: range.id,
    parameters: {
      efficiencyJPerTh: efficiency,
      electricityUsdPerKwh: electricityRate,
      blockReward: HALVING_BLOCK_REWARD,
    },
    points,
    latest,
    updatedAt: Date.now(),
  })
}
