export interface MetricPoint {
  timestamp: number
  value: number
}

export interface ManipulationMetricInputs {
  price: MetricPoint[]
  openInterest: MetricPoint[]
  funding: MetricPoint[]
  basis: MetricPoint[]
  takerBuy: MetricPoint[]
  takerSell: MetricPoint[]
  takerCumulativeNet: MetricPoint[]
  longLiquidations: MetricPoint[]
  shortLiquidations: MetricPoint[]
  upperWick: MetricPoint[]
  lowerWick: MetricPoint[]
  volume: MetricPoint[]
}

export interface MarketManipulationMetrics {
  manipLeveragePressure: MetricPoint[]
  manipPriceOiDivergence: MetricPoint[]
  manipFundingSqueezeZ: MetricPoint[]
  manipBasisDislocationZ: MetricPoint[]
  manipTakerImbalancePct: MetricPoint[]
  manipCvdPriceDivergence: MetricPoint[]
  manipLiquidationImbalancePct: MetricPoint[]
  manipLiquidationIntensityZ: MetricPoint[]
  manipWickAsymmetryPct: MetricPoint[]
  manipVolumeImpactZ: MetricPoint[]
}

const DAY_MS = 86_400_000
const ROLLING_WINDOW = 30
const DIVERGENCE_LOOKBACK = 7
const MIN_NORMALIZED_VOLUME = 0.05

function normalizeSeries(points: MetricPoint[]): MetricPoint[] {
  const valuesByDay = new Map<number, number>()
  for (const point of points) {
    if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.value)) continue
    const timestamp = Math.floor(point.timestamp / DAY_MS) * DAY_MS
    valuesByDay.set(timestamp, point.value)
  }
  return Array.from(valuesByDay, ([timestamp, value]) => ({ timestamp, value }))
    .sort((left, right) => left.timestamp - right.timestamp)
}

function valueMap(points: MetricPoint[]): Map<number, number> {
  return new Map(normalizeSeries(points).map((point) => [point.timestamp, point.value]))
}

function rollingZScore(points: MetricPoint[], windowSize = ROLLING_WINDOW): MetricPoint[] {
  const normalized = normalizeSeries(points)
  return normalized.map((point, index) => {
    const sample = normalized
      .slice(Math.max(0, index - windowSize + 1), index + 1)
      .map((item) => item.value)
    const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length
    const variance = sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sample.length
    const deviation = Math.sqrt(variance)
    return { timestamp: point.timestamp, value: deviation === 0 ? 0 : (point.value - mean) / deviation }
  })
}

function rollingChange(points: MetricPoint[], lookback: number, percent: boolean): MetricPoint[] {
  const normalized = normalizeSeries(points)
  return normalized.flatMap((point, index) => {
    const previous = normalized[index - lookback]
    if (!previous) return []
    if (percent && previous.value === 0) return [{ timestamp: point.timestamp, value: 0 }]
    const difference = point.value - previous.value
    const value = percent ? (difference / previous.value) * 100 : difference
    return Number.isFinite(value) ? [{ timestamp: point.timestamp, value }] : []
  })
}

function combineIntersection(
  left: MetricPoint[],
  right: MetricPoint[],
  calculate: (leftValue: number, rightValue: number) => number,
): MetricPoint[] {
  const rightByDay = valueMap(right)
  return normalizeSeries(left).flatMap((point) => {
    const rightValue = rightByDay.get(point.timestamp)
    if (rightValue === undefined) return []
    const value = calculate(point.value, rightValue)
    return Number.isFinite(value) ? [{ timestamp: point.timestamp, value }] : []
  })
}

function combineUnion(
  left: MetricPoint[],
  right: MetricPoint[],
  calculate: (leftValue: number, rightValue: number) => number,
): MetricPoint[] {
  const leftByDay = valueMap(left)
  const rightByDay = valueMap(right)
  const timestamps = Array.from(new Set([...leftByDay.keys(), ...rightByDay.keys()]))
    .sort((leftTimestamp, rightTimestamp) => leftTimestamp - rightTimestamp)
  return timestamps.flatMap((timestamp) => {
    const value = calculate(leftByDay.get(timestamp) ?? 0, rightByDay.get(timestamp) ?? 0)
    return Number.isFinite(value) ? [{ timestamp, value }] : []
  })
}

function rollingMean(points: MetricPoint[], windowSize = ROLLING_WINDOW): MetricPoint[] {
  const normalized = normalizeSeries(points)
  return normalized.map((point, index) => {
    const sample = normalized.slice(Math.max(0, index - windowSize + 1), index + 1)
    const mean = sample.reduce((sum, item) => sum + item.value, 0) / sample.length
    return { timestamp: point.timestamp, value: mean }
  })
}

function computeVolumeImpact(price: MetricPoint[], volume: MetricPoint[]): MetricPoint[] {
  const dailyReturn = rollingChange(price, 1, true)
  const volumeByDay = valueMap(volume)
  const volumeMeanByDay = valueMap(rollingMean(volume))
  const rawImpact = dailyReturn.flatMap((point) => {
    const currentVolume = volumeByDay.get(point.timestamp)
    const meanVolume = volumeMeanByDay.get(point.timestamp)
    if (currentVolume === undefined || meanVolume === undefined) return []
    const normalizedVolume = meanVolume === 0 ? 0 : currentVolume / meanVolume
    const value = Math.abs(point.value) / Math.max(normalizedVolume, MIN_NORMALIZED_VOLUME)
    return Number.isFinite(value) ? [{ timestamp: point.timestamp, value }] : []
  })
  return rollingZScore(rawImpact)
}

export function computeMarketManipulationMetrics(
  inputs: ManipulationMetricInputs,
): MarketManipulationMetrics {
  const returnZ = rollingZScore(rollingChange(inputs.price, 1, true))
  const openInterestChangeZ = rollingZScore(rollingChange(inputs.openInterest, 1, true))
  const priceSevenDayZ = rollingZScore(rollingChange(inputs.price, DIVERGENCE_LOOKBACK, true))
  const cumulativeFlowSevenDayZ = rollingZScore(
    rollingChange(inputs.takerCumulativeNet, DIVERGENCE_LOOKBACK, false),
  )
  const liquidationTotal = combineUnion(
    inputs.longLiquidations,
    inputs.shortLiquidations,
    (longValue, shortValue) => longValue + shortValue,
  )

  return {
    manipLeveragePressure: combineIntersection(
      returnZ,
      openInterestChangeZ,
      (returnValue, openInterestValue) => returnValue * Math.max(openInterestValue, 0),
    ),
    manipPriceOiDivergence: combineIntersection(
      returnZ,
      openInterestChangeZ,
      (returnValue, openInterestValue) => returnValue * -openInterestValue,
    ),
    manipFundingSqueezeZ: rollingZScore(inputs.funding),
    manipBasisDislocationZ: rollingZScore(inputs.basis),
    manipTakerImbalancePct: combineIntersection(
      inputs.takerBuy,
      inputs.takerSell,
      (buyValue, sellValue) => {
        const total = buyValue + sellValue
        return total === 0 ? 0 : ((buyValue - sellValue) / total) * 100
      },
    ),
    manipCvdPriceDivergence: combineIntersection(
      priceSevenDayZ,
      cumulativeFlowSevenDayZ,
      (priceValue, flowValue) => priceValue - flowValue,
    ),
    manipLiquidationImbalancePct: combineUnion(
      inputs.longLiquidations,
      inputs.shortLiquidations,
      (longValue, shortValue) => {
        const total = longValue + shortValue
        return total === 0 ? 0 : ((longValue - shortValue) / total) * 100
      },
    ),
    manipLiquidationIntensityZ: rollingZScore(liquidationTotal),
    manipWickAsymmetryPct: combineIntersection(
      inputs.upperWick,
      inputs.lowerWick,
      (upperValue, lowerValue) => upperValue - lowerValue,
    ),
    manipVolumeImpactZ: computeVolumeImpact(inputs.price, inputs.volume),
  }
}
