export interface PricePoint {
  time: number
  close: number
}

export interface SignalOccurrence {
  time: number
  direction: "long" | "short"
  score: number
}

export interface ForwardReturnBucket {
  days: number
  samples: number
  medianPct: number | null
  hitRatePct: number | null
  maxAdverseExcursionPct: number | null
}

export interface SignalBacktestSummary {
  occurrences: number
  baselineSamples: number
  buckets: ForwardReturnBucket[]
}

const DAY_MS = 86_400_000

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function findNearestAtOrAfter(points: PricePoint[], target: number): PricePoint | null {
  return points.find((point) => point.time >= target) ?? null
}

function computeForwardReturn({
  entry,
  exit,
  direction,
}: {
  entry: number
  exit: number
  direction: "long" | "short"
}): number | null {
  if (entry <= 0 || exit <= 0) return null
  const raw = (exit / entry - 1) * 100
  return direction === "long" ? raw : -raw
}

function computeMaxAdverseExcursion({
  entry,
  path,
  direction,
}: {
  entry: number
  path: PricePoint[]
  direction: "long" | "short"
}): number | null {
  if (entry <= 0 || path.length === 0) return null
  const adverse = path.map((point) => {
    const raw = (point.close / entry - 1) * 100
    return direction === "long" ? raw : -raw
  })
  return Math.min(...adverse)
}

export function runSignalBacktest({
  prices,
  occurrences,
  horizons = [7, 30, 90],
}: {
  prices: PricePoint[]
  occurrences: SignalOccurrence[]
  horizons?: number[]
}): SignalBacktestSummary {
  const sortedPrices = [...prices]
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.close) && point.close > 0)
    .sort((a, b) => a.time - b.time)
  const sortedOccurrences = [...occurrences]
    .filter((event) => Number.isFinite(event.time) && Number.isFinite(event.score))
    .sort((a, b) => a.time - b.time)

  const buckets = horizons.map((days) => {
    const returns: number[] = []
    const adverseMoves: number[] = []

    for (const occurrence of sortedOccurrences) {
      const entry = findNearestAtOrAfter(sortedPrices, occurrence.time)
      const exit = findNearestAtOrAfter(sortedPrices, occurrence.time + days * DAY_MS)
      if (!entry || !exit) continue
      const forwardReturn = computeForwardReturn({
        entry: entry.close,
        exit: exit.close,
        direction: occurrence.direction,
      })
      if (forwardReturn === null) continue
      returns.push(forwardReturn)
      const path = sortedPrices.filter((point) => point.time >= entry.time && point.time <= exit.time)
      const adverse = computeMaxAdverseExcursion({
        entry: entry.close,
        path,
        direction: occurrence.direction,
      })
      if (adverse !== null) adverseMoves.push(adverse)
    }

    return {
      days,
      samples: returns.length,
      medianPct: median(returns),
      hitRatePct: returns.length === 0 ? null : (returns.filter((value) => value > 0).length / returns.length) * 100,
      maxAdverseExcursionPct: median(adverseMoves),
    }
  })

  return {
    occurrences: sortedOccurrences.length,
    baselineSamples: sortedPrices.length,
    buckets,
  }
}
