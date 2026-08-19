export interface RawPoint {
  timestamp: number
  value: number
}

export interface QuantCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
}

export interface QuantFeatureSet {
  returns: RawPoint[]
  ret24hNorm: RawPoint[]
  ret72hNorm: RawPoint[]
  ret7dNorm: RawPoint[]
  vwap: RawPoint[]
  vwapDistancePct: RawPoint[]
  vwapZScore: RawPoint[]
  rsi14: RawPoint[]
  atr14: RawPoint[]
  atrPct: RawPoint[]
  ema20: RawPoint[]
  ema50: RawPoint[]
  ema200: RawPoint[]
  ema20Slope: RawPoint[]
  ema50Slope: RawPoint[]
  adx14: RawPoint[]
  plusDi: RawPoint[]
  minusDi: RawPoint[]
  donchianUpper20: RawPoint[]
  donchianLower20: RawPoint[]
  realizedVol: RawPoint[]
  rvPercentile30d: RawPoint[]
  rvPercentile90d: RawPoint[]
  trendRegime: RawPoint[]
  volRegime: RawPoint[]
}

export interface CompositeSignalSet {
  crowdingScore: RawPoint[]
  extensionScore: RawPoint[]
  trendScore: RawPoint[]
  cascadeScore: RawPoint[]
  cascadeInProgress: RawPoint[]
  exhaustionScore: RawPoint[]
}

const DAY_MS = 86_400_000

function toPoint(timestamp: number, value: number | null): RawPoint | null {
  return value === null || !Number.isFinite(value) ? null : { timestamp, value }
}

function compact(points: Array<RawPoint | null>): RawPoint[] {
  return points.filter((point): point is RawPoint => point !== null)
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function rollingPercentile(points: RawPoint[], windowSize: number): RawPoint[] {
  return points.map((point, index) => {
    const sample = points.slice(Math.max(0, index - windowSize + 1), index + 1).map((row) => row.value)
    if (sample.length === 0) return { timestamp: point.timestamp, value: 50 }
    const belowOrEqual = sample.filter((value) => value <= point.value).length
    return { timestamp: point.timestamp, value: (belowOrEqual / sample.length) * 100 }
  })
}

export function rollingZScore(points: RawPoint[], windowSize: number): RawPoint[] {
  return points.map((point, index) => {
    const sample = points.slice(Math.max(0, index - windowSize + 1), index + 1).map((row) => row.value)
    const deviation = standardDeviation(sample)
    return { timestamp: point.timestamp, value: deviation === 0 ? 0 : (point.value - mean(sample)) / deviation }
  })
}

function rollingEma(candles: QuantCandle[], period: number): RawPoint[] {
  const multiplier = 2 / (period + 1)
  let ema: number | null = null
  return candles.map((candle) => {
    ema = ema === null ? candle.close : (candle.close - ema) * multiplier + ema
    return { timestamp: candle.timestamp, value: ema }
  })
}

function rollingSlopePct(points: RawPoint[], lookback: number): RawPoint[] {
  return points.map((point, index) => {
    const previous = points[index - lookback]
    if (!previous || previous.value === 0) return { timestamp: point.timestamp, value: 0 }
    return { timestamp: point.timestamp, value: ((point.value - previous.value) / previous.value) * 100 }
  })
}

function rollingRsi(candles: QuantCandle[], period: number): RawPoint[] {
  let averageGain = 0
  let averageLoss = 0
  const points: RawPoint[] = []

  for (let index = 0; index < candles.length; index += 1) {
    const current = candles[index]
    const previous = candles[index - 1]
    const change = previous ? current.close - previous.close : 0
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)

    if (index <= period) {
      averageGain += gain
      averageLoss += loss
      if (index === period) {
        averageGain /= period
        averageLoss /= period
      }
    } else {
      averageGain = (averageGain * (period - 1) + gain) / period
      averageLoss = (averageLoss * (period - 1) + loss) / period
    }

    if (index < period) {
      points.push({ timestamp: current.timestamp, value: 50 })
      continue
    }

    const rs = averageLoss === 0 ? 100 : averageGain / averageLoss
    points.push({ timestamp: current.timestamp, value: 100 - 100 / (1 + rs) })
  }

  return points
}

function rollingAtr(candles: QuantCandle[], period: number): RawPoint[] {
  let atr = 0
  const points: RawPoint[] = []

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]
    const previous = candles[index - 1]
    const trueRange = previous
      ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
      : candle.high - candle.low

    if (index < period) {
      atr += trueRange
      points.push({ timestamp: candle.timestamp, value: index === period - 1 ? atr / period : trueRange })
      if (index === period - 1) atr /= period
      continue
    }

    atr = (atr * (period - 1) + trueRange) / period
    points.push({ timestamp: candle.timestamp, value: atr })
  }

  return points
}

function rollingAdx(candles: QuantCandle[], period: number): Pick<QuantFeatureSet, "adx14" | "plusDi" | "minusDi"> {
  let smoothedTr = 0
  let smoothedPlusDm = 0
  let smoothedMinusDm = 0
  let adx = 0
  const dxValues: number[] = []
  const adx14: RawPoint[] = []
  const plusDi: RawPoint[] = []
  const minusDi: RawPoint[] = []

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]
    const previous = candles[index - 1]
    if (!previous) {
      adx14.push({ timestamp: candle.timestamp, value: 0 })
      plusDi.push({ timestamp: candle.timestamp, value: 0 })
      minusDi.push({ timestamp: candle.timestamp, value: 0 })
      continue
    }

    const upMove = candle.high - previous.high
    const downMove = previous.low - candle.low
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0
    const trueRange = Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))

    if (index <= period) {
      smoothedTr += trueRange
      smoothedPlusDm += plusDm
      smoothedMinusDm += minusDm
    } else {
      smoothedTr = smoothedTr - smoothedTr / period + trueRange
      smoothedPlusDm = smoothedPlusDm - smoothedPlusDm / period + plusDm
      smoothedMinusDm = smoothedMinusDm - smoothedMinusDm / period + minusDm
    }

    const positiveDi = smoothedTr === 0 ? 0 : (smoothedPlusDm / smoothedTr) * 100
    const negativeDi = smoothedTr === 0 ? 0 : (smoothedMinusDm / smoothedTr) * 100
    const dx = positiveDi + negativeDi === 0 ? 0 : (Math.abs(positiveDi - negativeDi) / (positiveDi + negativeDi)) * 100
    dxValues.push(dx)

    if (index <= period * 2) {
      adx = mean(dxValues.slice(-period))
    } else {
      adx = (adx * (period - 1) + dx) / period
    }

    plusDi.push({ timestamp: candle.timestamp, value: positiveDi })
    minusDi.push({ timestamp: candle.timestamp, value: negativeDi })
    adx14.push({ timestamp: candle.timestamp, value: adx })
  }

  return { adx14, plusDi, minusDi }
}

function rollingVwap(candles: QuantCandle[], windowSize: number): Pick<QuantFeatureSet, "vwap" | "vwapDistancePct" | "vwapZScore"> {
  const vwap: RawPoint[] = []
  const distancePct: RawPoint[] = []
  const rawDistance: RawPoint[] = []

  for (let index = 0; index < candles.length; index += 1) {
    const sample = candles.slice(Math.max(0, index - windowSize + 1), index + 1)
    let weightedPrice = 0
    let totalVolume = 0
    for (const candle of sample) {
      const price = (candle.high + candle.low + candle.close) / 3
      const volume = candle.quoteVolume > 0 ? candle.quoteVolume : candle.volume
      weightedPrice += price * volume
      totalVolume += volume
    }
    const candle = candles[index]
    const value = totalVolume === 0 ? candle.close : weightedPrice / totalVolume
    const distance = value === 0 ? 0 : ((candle.close - value) / value) * 100
    vwap.push({ timestamp: candle.timestamp, value })
    distancePct.push({ timestamp: candle.timestamp, value: distance })
    rawDistance.push({ timestamp: candle.timestamp, value: candle.close - value })
  }

  return {
    vwap,
    vwapDistancePct: distancePct,
    vwapZScore: rollingZScore(rawDistance, windowSize),
  }
}

/* Previous-N-bar extremes (current bar excluded) so a close beyond the band
   registers as a breakout on the bar where it happens. */
function rollingDonchian(candles: QuantCandle[], period: number): { upper: RawPoint[]; lower: RawPoint[] } {
  const upper: RawPoint[] = []
  const lower: RawPoint[] = []
  for (let index = 0; index < candles.length; index += 1) {
    const sample = index === 0 ? candles.slice(0, 1) : candles.slice(Math.max(0, index - period), index)
    let high = -Infinity
    let low = Infinity
    for (const candle of sample) {
      high = Math.max(high, candle.high)
      low = Math.min(low, candle.low)
    }
    upper.push({ timestamp: candles[index].timestamp, value: high })
    lower.push({ timestamp: candles[index].timestamp, value: low })
  }
  return { upper, lower }
}

function realizedVolatility(candles: QuantCandle[], windowSize: number, barsPerYear: number): RawPoint[] {
  const returns = candles.map((candle, index) => {
    const previous = candles[index - 1]
    return previous && previous.close > 0 ? Math.log(candle.close / previous.close) : 0
  })
  return candles.map((candle, index) => {
    const sample = returns.slice(Math.max(0, index - windowSize + 1), index + 1)
    const rv = Math.sqrt(sample.reduce((sum, value) => sum + value ** 2, 0) / Math.max(sample.length, 1)) * Math.sqrt(barsPerYear) * 100
    return { timestamp: candle.timestamp, value: rv }
  })
}

export function computeQuantFeatures(candles: QuantCandle[], barsPerDay: number): QuantFeatureSet {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp)
  const returns = sorted.map((candle, index) => {
    const previous = sorted[index - 1]
    return { timestamp: candle.timestamp, value: previous && previous.close > 0 ? ((candle.close / previous.close) - 1) * 100 : 0 }
  })
  const vwapFeatures = rollingVwap(sorted, Math.max(2, Math.round(barsPerDay)))
  const atr14 = rollingAtr(sorted, 14)
  const ema20 = rollingEma(sorted, 20)
  const ema50 = rollingEma(sorted, 50)
  const ema200 = rollingEma(sorted, 200)
  const rv = realizedVolatility(sorted, Math.max(2, Math.round(30 * barsPerDay)), Math.max(365, Math.round(365 * barsPerDay)))
  const adxFeatures = rollingAdx(sorted, 14)
  const donchian = rollingDonchian(sorted, 20)

  /* Horizon return divided by realized vol scaled to the same horizon — the
     trend-engine input where at least two of the 24h/72h/7d horizons must
     agree before a direction is tradable. */
  const volNormalizedReturn = (horizonDays: number): RawPoint[] => {
    const lookback = Math.max(1, Math.round(horizonDays * barsPerDay))
    return sorted.map((candle, index) => {
      const previous = sorted[index - lookback]
      const horizonVolPct = (rv[index]?.value ?? 0) * Math.sqrt(horizonDays / 365)
      if (!previous || previous.close <= 0 || horizonVolPct <= 0) return { timestamp: candle.timestamp, value: 0 }
      return { timestamp: candle.timestamp, value: ((candle.close / previous.close - 1) * 100) / horizonVolPct }
    })
  }

  const trendRegime = sorted.map((candle, index) => {
    const e20 = ema20[index]?.value ?? candle.close
    const e50 = ema50[index]?.value ?? candle.close
    const e200 = ema200[index]?.value ?? candle.close
    const slope20 = rollingSlopePct(ema20, Math.max(1, Math.round(5 * barsPerDay)))[index]?.value ?? 0
    const adx = adxFeatures.adx14[index]?.value ?? 0
    const bullish = e20 > e50 && e50 > e200 && slope20 > 0
    const bearish = e20 < e50 && e50 < e200 && slope20 < 0
    const value = bullish && adx >= 25 ? 2 : bullish ? 1 : bearish && adx >= 25 ? -2 : bearish ? -1 : 0
    return { timestamp: candle.timestamp, value }
  })
  const rvPct90 = rollingPercentile(rv, Math.max(2, Math.round(90 * barsPerDay)))

  return {
    returns,
    ret24hNorm: volNormalizedReturn(1),
    ret72hNorm: volNormalizedReturn(3),
    ret7dNorm: volNormalizedReturn(7),
    ...vwapFeatures,
    rsi14: rollingRsi(sorted, 14),
    atr14,
    atrPct: atr14.map((point, index) => ({
      timestamp: point.timestamp,
      value: sorted[index]?.close ? (point.value / sorted[index].close) * 100 : 0,
    })),
    ema20,
    ema50,
    ema200,
    ema20Slope: rollingSlopePct(ema20, Math.max(1, Math.round(5 * barsPerDay))),
    ema50Slope: rollingSlopePct(ema50, Math.max(1, Math.round(10 * barsPerDay))),
    ...adxFeatures,
    donchianUpper20: donchian.upper,
    donchianLower20: donchian.lower,
    realizedVol: rv,
    rvPercentile30d: rollingPercentile(rv, Math.max(2, Math.round(30 * barsPerDay))),
    rvPercentile90d: rvPct90,
    trendRegime,
    volRegime: rvPct90.map((point) => ({
      timestamp: point.timestamp,
      value: point.value > 90 ? 3 : point.value > 70 ? 2 : point.value < 30 ? 0 : 1,
    })),
  }
}

function valueAt(points: RawPoint[], timestamp: number, maxStaleMs: number): number | null {
  let latest: RawPoint | null = null
  for (const point of points) {
    if (point.timestamp > timestamp) break
    latest = point
  }
  if (!latest || timestamp - latest.timestamp > maxStaleMs) return null
  return latest.value
}

function tailScore(percentile: number | null): number {
  if (percentile === null) return 0
  return Math.max(percentile, 100 - percentile)
}

function absPoint(points: RawPoint[]): RawPoint[] {
  return points.map((point) => ({ timestamp: point.timestamp, value: Math.abs(point.value) }))
}

export function computeDerivativeFeatures(points: {
  funding: RawPoint[]
  oi: RawPoint[]
  longLiquidations: RawPoint[]
  shortLiquidations: RawPoint[]
}): {
  fundingPct30d: RawPoint[]
  fundingPct90d: RawPoint[]
  fundingZScore: RawPoint[]
  oiChange1h: RawPoint[]
  oiChange4h: RawPoint[]
  oiPct30d: RawPoint[]
  oiPct90d: RawPoint[]
  oiZScore: RawPoint[]
  liquidationZScore: RawPoint[]
  liquidationImbalance: RawPoint[]
  liqOverOi: RawPoint[]
} {
  const oi = [...points.oi].sort((a, b) => a.timestamp - b.timestamp)
  const oiChange = (lookbackMs: number) =>
    oi.map((point) => {
      const previous = valueAt(oi, point.timestamp - lookbackMs, lookbackMs * 2)
      return { timestamp: point.timestamp, value: previous && previous !== 0 ? ((point.value - previous) / previous) * 100 : 0 }
    })
  const liquidationByTime = new Map<number, { long: number; short: number }>()
  for (const point of points.longLiquidations) {
    liquidationByTime.set(point.timestamp, { long: point.value, short: liquidationByTime.get(point.timestamp)?.short ?? 0 })
  }
  for (const point of points.shortLiquidations) {
    liquidationByTime.set(point.timestamp, { long: liquidationByTime.get(point.timestamp)?.long ?? 0, short: point.value })
  }
  const liquidation = Array.from(liquidationByTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, row]) => ({ timestamp, value: row.long + row.short }))

  return {
    fundingPct30d: rollingPercentile(points.funding, 90),
    fundingPct90d: rollingPercentile(points.funding, 270),
    fundingZScore: rollingZScore(points.funding, 90),
    oiChange1h: oiChange(60 * 60 * 1000),
    oiChange4h: oiChange(4 * 60 * 60 * 1000),
    oiPct30d: rollingPercentile(oi, 30),
    oiPct90d: rollingPercentile(oi, 90),
    oiZScore: rollingZScore(oi, 30),
    liquidationZScore: rollingZScore(liquidation, 30),
    /* Forced-flow trigger: liquidation notional relative to open interest.
       A spike toward its upper tail marks a leverage flush, not just a busy day. */
    liqOverOi: liquidation.map((point) => {
      const oiValue = valueAt(oi, point.timestamp, 2 * DAY_MS)
      return { timestamp: point.timestamp, value: oiValue && oiValue > 0 ? (point.value / oiValue) * 100 : 0 }
    }),
    liquidationImbalance: Array.from(liquidationByTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, row]) => ({
        timestamp,
        value: row.long + row.short === 0 ? 0 : ((row.long - row.short) / (row.long + row.short)) * 100,
      })),
  }
}

/* Crowding gauge: open interest relative to rolling 24h traded volume. High
   values mean positions are large versus what the tape can absorb, so exits
   move price. */
export function computeOiVolumeRatio(oi: RawPoint[], candles: QuantCandle[], barsPerDay: number): RawPoint[] {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp)
  const window = Math.max(1, Math.round(barsPerDay))
  const rolling24hVolume: RawPoint[] = sorted.map((candle, index) => {
    const sample = sorted.slice(Math.max(0, index - window + 1), index + 1)
    const volume = sample.reduce(
      (sum, row) => sum + (row.quoteVolume > 0 ? row.quoteVolume : row.volume * row.close),
      0,
    )
    return { timestamp: candle.timestamp, value: volume }
  })
  return [...oi]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((point) => {
      const volume = valueAt(rolling24hVolume, point.timestamp, 2 * DAY_MS)
      return { timestamp: point.timestamp, value: volume && volume > 0 ? point.value / volume : 0 }
    })
}

export function computeCompositeSignals(input: {
  candles: QuantCandle[]
  barsPerDay: number
  quant: QuantFeatureSet
  fundingPct90d: RawPoint[]
  oiPct90d: RawPoint[]
  oiChange4h: RawPoint[]
  liquidationZScore: RawPoint[]
  liquidationImbalance: RawPoint[]
  buyVolume: RawPoint[]
  sellVolume: RawPoint[]
  cvd: RawPoint[]
  bidDepth05: RawPoint[]
  askDepth05: RawPoint[]
  spread: RawPoint[]
}): CompositeSignalSet {
  const staleMs = Math.max(DAY_MS, Math.round((DAY_MS / input.barsPerDay) * 8))
  const returnZ = rollingZScore(input.quant.returns, Math.max(10, Math.round(30 * input.barsPerDay)))
  const volumeDelta = input.buyVolume.map((point) => ({
    timestamp: point.timestamp,
    value: point.value - (valueAt(input.sellVolume, point.timestamp, staleMs) ?? 0),
  }))
  const volumeDeltaZ = rollingZScore(volumeDelta, Math.max(10, Math.round(30 * input.barsPerDay)))
  const cvdSlope = input.cvd.map((point, index) => {
    const previous = input.cvd[Math.max(0, index - Math.round(input.barsPerDay))]
    return { timestamp: point.timestamp, value: previous ? point.value - previous.value : 0 }
  })

  const crowdingScore: RawPoint[] = []
  const extensionScore: RawPoint[] = []
  const trendScore: RawPoint[] = []
  const cascadeScore: RawPoint[] = []
  const cascadeInProgress: RawPoint[] = []
  const exhaustionScore: RawPoint[] = []

  /* The quant feature arrays are ascending; the fetcher hands candles in
     descending order. Sort so index i pairs the candle with its own features. */
  const candles = [...input.candles].sort((a, b) => a.timestamp - b.timestamp)

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]
    const timestamp = candle.timestamp
    const fundingTail = tailScore(valueAt(input.fundingPct90d, timestamp, staleMs))
    const oiPct = valueAt(input.oiPct90d, timestamp, staleMs) ?? 0
    const oiGrowth = Math.min(100, Math.abs(valueAt(input.oiChange4h, timestamp, staleMs) ?? 0) * 8)
    const vwapTail = Math.min(100, Math.abs(input.quant.vwapZScore[index]?.value ?? 0) * 18)
    const crowding = clamp(fundingTail * 0.35 + oiPct * 0.25 + oiGrowth * 0.2 + vwapTail * 0.2, 0, 100)

    const rsi = input.quant.rsi14[index]?.value ?? 50
    const rsiExtreme = rsi < 30 ? ((30 - rsi) / 30) * 100 : rsi > 70 ? ((rsi - 70) / 30) * 100 : 0
    const atrPct = input.quant.atrPct[index]?.value ?? 0
    const atrMove = atrPct > 0 ? Math.min(100, (Math.abs(input.quant.returns[index]?.value ?? 0) / atrPct) * 25) : 0
    const returnShock = Math.min(100, Math.abs(returnZ[index]?.value ?? 0) * 22)
    const extension = clamp(vwapTail * 0.35 + rsiExtreme * 0.25 + atrMove * 0.25 + returnShock * 0.15, 0, 100)

    const e20 = input.quant.ema20[index]?.value ?? candle.close
    const e50 = input.quant.ema50[index]?.value ?? candle.close
    const e200 = input.quant.ema200[index]?.value ?? candle.close
    const adx = input.quant.adx14[index]?.value ?? 0
    const diSpread = Math.abs((input.quant.plusDi[index]?.value ?? 0) - (input.quant.minusDi[index]?.value ?? 0))
    const emaStructure = e20 > e50 && e50 > e200 ? 100 : e20 < e50 && e50 < e200 ? 100 : 35
    const slopeScore = Math.min(100, Math.abs(input.quant.ema20Slope[index]?.value ?? 0) * 15 + Math.abs(input.quant.ema50Slope[index]?.value ?? 0) * 10)
    const trend = clamp(emaStructure * 0.35 + slopeScore * 0.2 + Math.min(100, adx * 2.2) * 0.3 + Math.min(100, diSpread * 2) * 0.15, 0, 100)

    const priceVelocity = Math.min(100, Math.abs(input.quant.returns[index]?.value ?? 0) * 20)
    const oiFlush = Math.min(100, Math.max(0, -(valueAt(input.oiChange4h, timestamp, staleMs) ?? 0)) * 12)
    const liquidation = Math.min(100, Math.max(0, valueAt(input.liquidationZScore, timestamp, staleMs) ?? 0) * 25)
    const flow = Math.min(100, Math.abs(valueAt(volumeDeltaZ, timestamp, staleMs) ?? 0) * 20)
    const bid = valueAt(input.bidDepth05, timestamp, staleMs)
    const ask = valueAt(input.askDepth05, timestamp, staleMs)
    const depth = bid !== null && ask !== null ? bid + ask : null
    const depthStress = depth && depth > 0 ? Math.min(100, Math.abs(valueAt(input.spread, timestamp, staleMs) ?? 0) * 15) : 0
    const cascade = clamp(priceVelocity * 0.2 + oiFlush * 0.2 + liquidation * 0.25 + flow * 0.15 + depthStress * 0.2, 0, 100)

    const previousLiq = valueAt(input.liquidationZScore, timestamp - DAY_MS / input.barsPerDay, staleMs)
    const liqNow = valueAt(input.liquidationZScore, timestamp, staleMs)
    const liqDecay = previousLiq !== null && liqNow !== null && previousLiq > liqNow ? Math.min(100, (previousLiq - liqNow) * 25) : 0
    const cvdTurn = Math.min(100, Math.abs(valueAt(cvdSlope, timestamp, staleMs) ?? 0) / Math.max(candle.quoteVolume, 1) * 10_000)
    const wick = candle.close >= candle.open
      ? ((Math.min(candle.open, candle.close) - candle.low) / Math.max(candle.high - candle.low, Number.EPSILON)) * 100
      : ((candle.high - Math.max(candle.open, candle.close)) / Math.max(candle.high - candle.low, Number.EPSILON)) * 100
    const vwapReclaim = Math.abs(input.quant.vwapDistancePct[index]?.value ?? 0) < 0.4 ? 100 : 0
    const exhaustion = clamp(cvdTurn * 0.3 + liqDecay * 0.25 + (100 - flow) * 0.2 + wick * 0.15 + vwapReclaim * 0.1, 0, 100)

    crowdingScore.push({ timestamp, value: crowding })
    extensionScore.push({ timestamp, value: extension })
    trendScore.push({ timestamp, value: trend })
    cascadeScore.push({ timestamp, value: cascade })
    cascadeInProgress.push({ timestamp, value: cascade >= 70 ? 1 : 0 })
    exhaustionScore.push({ timestamp, value: exhaustion })
  }

  return { crowdingScore, extensionScore, trendScore, cascadeScore, cascadeInProgress, exhaustionScore }
}

export function buildOrderBookDepthSnapshot(input: {
  timestamp: number
  bids: Array<{ price: number; quantity: number }>
  asks: Array<{ price: number; quantity: number }>
}): {
  bestBid: RawPoint
  bestAsk: RawPoint
  spread: RawPoint
  bidDepth01: RawPoint
  askDepth01: RawPoint
  bidDepth05: RawPoint
  askDepth05: RawPoint
  bidDepth1: RawPoint
  askDepth1: RawPoint
  orderbookImbalance: RawPoint
} | null {
  const bestBid = input.bids[0]?.price
  const bestAsk = input.asks[0]?.price
  if (!bestBid || !bestAsk) return null
  const mid = (bestBid + bestAsk) / 2
  const depth = (levels: Array<{ price: number; quantity: number }>, side: "bid" | "ask", pct: number) => {
    const boundary = side === "bid" ? mid * (1 - pct / 100) : mid * (1 + pct / 100)
    return levels.reduce((sum, level) => {
      const inside = side === "bid" ? level.price >= boundary : level.price <= boundary
      return inside ? sum + level.price * level.quantity : sum
    }, 0)
  }
  const bidDepth05 = depth(input.bids, "bid", 0.5)
  const askDepth05 = depth(input.asks, "ask", 0.5)
  const imbalance = bidDepth05 + askDepth05 === 0 ? 0 : ((bidDepth05 - askDepth05) / (bidDepth05 + askDepth05)) * 100

  return {
    bestBid: { timestamp: input.timestamp, value: bestBid },
    bestAsk: { timestamp: input.timestamp, value: bestAsk },
    spread: { timestamp: input.timestamp, value: ((bestAsk - bestBid) / mid) * 100 },
    bidDepth01: { timestamp: input.timestamp, value: depth(input.bids, "bid", 0.1) },
    askDepth01: { timestamp: input.timestamp, value: depth(input.asks, "ask", 0.1) },
    bidDepth05: { timestamp: input.timestamp, value: bidDepth05 },
    askDepth05: { timestamp: input.timestamp, value: askDepth05 },
    bidDepth1: { timestamp: input.timestamp, value: depth(input.bids, "bid", 1) },
    askDepth1: { timestamp: input.timestamp, value: depth(input.asks, "ask", 1) },
    orderbookImbalance: { timestamp: input.timestamp, value: imbalance },
  }
}

export function sumPointSeries(left: RawPoint[], right: RawPoint[]): RawPoint[] {
  const byTime = new Map<number, number>()
  for (const point of left) byTime.set(point.timestamp, (byTime.get(point.timestamp) ?? 0) + point.value)
  for (const point of right) byTime.set(point.timestamp, (byTime.get(point.timestamp) ?? 0) + point.value)
  return Array.from(byTime.entries()).sort(([a], [b]) => a - b).map(([timestamp, value]) => ({ timestamp, value }))
}

export function nonNullPoints(points: Array<RawPoint | null>): RawPoint[] {
  return compact(points)
}
