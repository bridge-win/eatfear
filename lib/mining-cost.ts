export const DEFAULT_MINING_EFFICIENCY_J_PER_TH = Number(process.env.MINING_EFFICIENCY_J_PER_TH ?? 21)
export const DEFAULT_MINING_ELECTRICITY_USD_PER_KWH = Number(process.env.MINING_ELECTRICITY_USD_PER_KWH ?? 0.05)
export const DEFAULT_MINING_COMPREHENSIVE_MULTIPLIER = Number(
  process.env.MINING_COMPREHENSIVE_COST_MULTIPLIER ?? 1.8,
)
export const BTC_BLOCK_REWARD = 3.125

export interface MiningCostParameters {
  efficiencyJPerTh: number
  electricityUsdPerKwh: number
  comprehensiveMultiplier: number
  blockReward: number
}

export interface MiningCostPoint {
  time: number
  hashrate: number
  electricityUsdPerBtc: number
  comprehensiveUsdPerBtc: number
  marketPriceUsd: number | null
  electricityMarginPct: number | null
  comprehensiveMarginPct: number | null
  marginPct: number | null
}

const readPositiveNumber = (value: string | null, fallback: number): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

export function resolveMiningCostParameters(searchParams: URLSearchParams): MiningCostParameters {
  return {
    efficiencyJPerTh: readPositiveNumber(searchParams.get("efficiency"), DEFAULT_MINING_EFFICIENCY_J_PER_TH),
    electricityUsdPerKwh: readPositiveNumber(searchParams.get("rate"), DEFAULT_MINING_ELECTRICITY_USD_PER_KWH),
    comprehensiveMultiplier: readPositiveNumber(
      searchParams.get("comprehensiveMultiplier") ?? searchParams.get("multiplier"),
      DEFAULT_MINING_COMPREHENSIVE_MULTIPLIER,
    ),
    blockReward: BTC_BLOCK_REWARD,
  }
}

const computeMarginPct = (marketPriceUsd: number | null, costUsdPerBtc: number): number | null => {
  if (!marketPriceUsd || marketPriceUsd <= 0 || costUsdPerBtc <= 0) return null
  return ((marketPriceUsd - costUsdPerBtc) / costUsdPerBtc) * 100
}

export function computeMiningCostFromHashrateThPerSec({
  time,
  hashrateThPerSec,
  marketPriceUsd,
  parameters,
}: {
  time: number
  hashrateThPerSec: number
  marketPriceUsd: number | null
  parameters: MiningCostParameters
}): MiningCostPoint {
  const btcPerDay = 144 * parameters.blockReward
  const networkKwhPerDay = (hashrateThPerSec * 86_400 * parameters.efficiencyJPerTh) / 3.6e6
  const electricityUsdPerBtc = (networkKwhPerDay * parameters.electricityUsdPerKwh) / btcPerDay
  const comprehensiveUsdPerBtc = electricityUsdPerBtc * parameters.comprehensiveMultiplier
  const electricityMarginPct = computeMarginPct(marketPriceUsd, electricityUsdPerBtc)
  const comprehensiveMarginPct = computeMarginPct(marketPriceUsd, comprehensiveUsdPerBtc)

  return {
    time,
    hashrate: hashrateThPerSec / 1e6,
    electricityUsdPerBtc,
    comprehensiveUsdPerBtc,
    marketPriceUsd,
    electricityMarginPct,
    comprehensiveMarginPct,
    marginPct: electricityMarginPct,
  }
}

export function computeMiningCostFromHashrateHps({
  time,
  hashrateHps,
  marketPriceUsd,
  parameters,
}: {
  time: number
  hashrateHps: number
  marketPriceUsd: number | null
  parameters: MiningCostParameters
}): MiningCostPoint {
  return computeMiningCostFromHashrateThPerSec({
    time,
    hashrateThPerSec: hashrateHps / 1e12,
    marketPriceUsd,
    parameters,
  })
}
