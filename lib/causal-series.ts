export interface TimedValue { timestamp: number; value: number }

export function alignPastOnly(points: TimedValue[], timeline: number[], maxAgeMs: number): (number | null)[] {
  const sorted = points.filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value)).sort((a, b) => a.timestamp - b.timestamp)
  let cursor = 0
  let last: TimedValue | undefined
  return timeline.map((time) => {
    while (cursor < sorted.length && sorted[cursor].timestamp <= time) last = sorted[cursor++]
    return last && time - last.timestamp <= maxAgeMs ? last.value : null
  })
}
