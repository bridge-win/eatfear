import type {
  SmartMoneyActor,
  SmartMoneyQuality,
  SmartMoneyQualityCategory,
  SmartMoneyQualityComponent,
} from "./types.ts"

type MetricKey = SmartMoneyQualityComponent["key"]

interface MetricDefinition {
  key: Exclude<MetricKey, "completeness">
  weight: number
  value: (actor: SmartMoneyActor) => number | null
  inverse?: boolean
}

const METRICS: MetricDefinition[] = [
  { key: "pnl", weight: 25, value: (actor) => validFinite(actor.metrics.pnlUsd) },
  { key: "roi", weight: 20, value: (actor) => validFinite(actor.metrics.roiPct) },
  { key: "winRate", weight: 15, value: (actor) => validRange(actor.metrics.winRatePct, 0, 100) },
  { key: "drawdown", weight: 15, value: (actor) => validRange(actor.metrics.maxDrawdownPct, 0, 100), inverse: true },
  { key: "activeDays", weight: 10, value: (actor) => validMinimum(actor.metrics.activeDays, 0) },
  { key: "capital", weight: 10, value: (actor) => validMinimum(actor.metrics.accountValueUsd, 0) },
]

const METRIC_WEIGHT = METRICS.reduce((sum, metric) => sum + metric.weight, 0)
const COMPLETENESS_WEIGHT = 5

function validFinite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null
}

function validRange(value: number | null, minimum: number, maximum: number): number | null {
  const parsed = validFinite(value)
  return parsed !== null && parsed >= minimum && parsed <= maximum ? parsed : null
}

function validMinimum(value: number | null, minimum: number): number | null {
  const parsed = validFinite(value)
  return parsed !== null && parsed >= minimum ? parsed : null
}

function percentile(value: number, cohort: number[], inverse = false): number {
  if (cohort.length <= 1) return 50
  const below = cohort.filter((entry) => entry < value).length
  const equal = cohort.filter((entry) => entry === value).length
  const rank = ((below + Math.max(0, equal - 1) / 2) / (cohort.length - 1)) * 100
  const score = Math.max(0, Math.min(100, rank))
  return inverse ? 100 - score : score
}

function invalidMetricFlags(actor: SmartMoneyActor): string[] {
  const flags: string[] = []
  if (actor.metrics.roiPct !== null && !Number.isFinite(actor.metrics.roiPct)) flags.push("invalid_roi")
  if (actor.metrics.winRatePct !== null && validRange(actor.metrics.winRatePct, 0, 100) === null) {
    flags.push("invalid_win_rate")
  }
  if (actor.metrics.maxDrawdownPct !== null && validRange(actor.metrics.maxDrawdownPct, 0, 100) === null) {
    flags.push("invalid_drawdown")
  }
  if (actor.metrics.activeDays !== null && validMinimum(actor.metrics.activeDays, 0) === null) {
    flags.push("invalid_active_days")
  }
  if (actor.metrics.accountValueUsd !== null && validMinimum(actor.metrics.accountValueUsd, 0) === null) {
    flags.push("invalid_account_value")
  }
  return flags
}

function categoryFor(score: number, coverage: number): SmartMoneyQualityCategory {
  if (coverage < 50) return "unranked"
  if (score >= 90) return "elite"
  if (score >= 75) return "proven"
  if (score >= 60) return "watch"
  return "unranked"
}

function copyability(actor: SmartMoneyActor, coverage: number, flags: string[]): number {
  let score = 100
  const drawdown = validRange(actor.metrics.maxDrawdownPct, 0, 100)
  const activeDays = validMinimum(actor.metrics.activeDays, 0)
  const roi = validFinite(actor.metrics.roiPct)
  const accountValue = validMinimum(actor.metrics.accountValueUsd, 0)
  const capacity = validRange(actor.metrics.capacityUsedPct, 0, 100)

  if (drawdown === null) score -= 10
  else if (drawdown > 20) score -= Math.min(35, 10 + (drawdown - 20) * 0.5)

  if (activeDays === null) score -= 15
  else if (activeDays < 30) score -= 20
  else if (activeDays < 90) score -= 8

  if (capacity === null) score -= 5
  else if (capacity >= 95) score -= 20
  else if (capacity >= 80) score -= 8

  if (roi !== null && roi > 500 && (activeDays === null || activeDays < 90 || accountValue === null || accountValue < 50_000)) {
    score -= 25
    flags.push("extreme_roi_low_evidence")
  }

  if (coverage < 50) score -= 15
  score -= 10 // Public leaderboards do not expose order-book liquidity or follower slippage.
  flags.push("liquidity_not_observed")
  return Math.round(Math.max(0, Math.min(100, score)))
}

function scoreActor(actor: SmartMoneyActor, cohort: SmartMoneyActor[]): SmartMoneyQuality {
  const available = METRICS.flatMap((metric) => {
    const value = metric.value(actor)
    if (value === null) return []
    const values = cohort.map(metric.value).filter((entry): entry is number => entry !== null)
    return [{
      key: metric.key,
      score: Math.round(percentile(value, values, metric.inverse) * 10) / 10,
      weight: metric.weight,
    }]
  })
  const presentWeight = available.reduce((sum, component) => sum + component.weight, 0)
  const coverage = Math.round((presentWeight / METRIC_WEIGHT) * 100)
  const components: SmartMoneyQualityComponent[] = [
    ...available,
    { key: "completeness", score: coverage, weight: COMPLETENESS_WEIGHT },
  ]
  const weightedScore = components.reduce((sum, component) => sum + component.score * component.weight, 0)
  const denominator = presentWeight + COMPLETENESS_WEIGHT
  const score = denominator > 0 ? Math.round((weightedScore / denominator) * 10) / 10 : 0
  const flags = invalidMetricFlags(actor)

  return {
    version: "actor-quality-v1",
    score,
    copyabilityScore: copyability(actor, coverage, flags),
    category: categoryFor(score, coverage),
    confidence: coverage >= 80 ? "high" : coverage >= 50 ? "medium" : "low",
    coverage,
    components,
    flags,
  }
}

export function scoreActorCohort(actors: SmartMoneyActor[]): SmartMoneyActor[] {
  const scored = actors.map((actor) => ({ ...actor, quality: scoreActor(actor, actors) }))
  return scored.sort((left, right) => right.quality.score - left.quality.score || (left.metrics.rank ?? Infinity) - (right.metrics.rank ?? Infinity))
}
