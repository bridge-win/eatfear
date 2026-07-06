/**
 * Signal trigger state machine — turns a continuously-scored signal into
 * discrete, alertable *events* (the thing notifications fire on).
 *
 * A raw score of "72" is not actionable; the moment it *crosses into* the
 * trigger zone is. Each (symbol × signal) walks:
 *
 *   neutral → zone_entered → triggered → (invalidated | resolved) → neutral
 *
 * Hysteresis (zoneEnter > invalidate) stops a score hovering on a threshold
 * from flapping out an alert every refresh. Transitions — not levels — are what
 * get persisted to `signal_events` and fanned out to email / in-app / Telegram.
 *
 * Convention: higher score = stronger signal, for both the black-swan dip score
 * and the euphoria score (direction distinguishes long vs. short intent).
 *
 * Pure functions, no I/O. Caller loads the prior snapshot, applies a reading,
 * and persists the returned snapshot + any transition.
 */

export type SignalState = "neutral" | "zone_entered" | "triggered" | "invalidated" | "resolved"

export type SignalDirection = "long" | "short"

export type SignalEventKind =
  | "zone_entered"
  | "triggered"
  | "invalidated"
  | "resolved"
  | "rearmed"

export interface SignalThresholds {
  /** Score at/above which the signal enters its watch zone. */
  zoneEnter: number
  /** Score at/above which the signal is confirmed/triggered. Must be ≥ zoneEnter. */
  trigger: number
  /**
   * Score below which an active signal is invalidated. Must be < zoneEnter so
   * entering and leaving use different levels (hysteresis).
   */
  invalidate: number
  direction: SignalDirection
}

export interface SignalReading {
  score: number
  time: number
}

export interface SignalStateSnapshot {
  state: SignalState
  /** Epoch ms the current state was entered. */
  since: number
  /** Highest score seen during the current active episode (reset on re-arm). */
  peakScore: number
  /** Score at the last update. */
  lastScore: number
}

export interface SignalTransition {
  from: SignalState
  to: SignalState
  event: SignalEventKind
  time: number
  score: number
  direction: SignalDirection
}

export interface SignalEvolution {
  snapshot: SignalStateSnapshot
  transition: SignalTransition | null
}

export const INITIAL_SNAPSHOT: SignalStateSnapshot = {
  state: "neutral",
  since: 0,
  peakScore: 0,
  lastScore: 0,
}

function validateThresholds(t: SignalThresholds): void {
  if (!(t.trigger >= t.zoneEnter && t.zoneEnter > t.invalidate)) {
    throw new Error(
      `Invalid thresholds: require trigger(${t.trigger}) >= zoneEnter(${t.zoneEnter}) > invalidate(${t.invalidate})`,
    )
  }
}

export function evolveSignalState(
  prev: SignalStateSnapshot,
  reading: SignalReading,
  thresholds: SignalThresholds,
): SignalEvolution {
  validateThresholds(thresholds)
  const { score, time } = reading
  const { zoneEnter, trigger, invalidate, direction } = thresholds

  const move = (to: SignalState, event: SignalEventKind, peak: number): SignalEvolution => ({
    snapshot: { state: to, since: time, peakScore: peak, lastScore: score },
    transition: { from: prev.state, to, event, time, score, direction },
  })
  const stay = (): SignalEvolution => ({
    snapshot: {
      state: prev.state,
      since: prev.since,
      peakScore: Math.max(prev.peakScore, score),
      lastScore: score,
    },
    transition: null,
  })

  switch (prev.state) {
    case "neutral":
      if (score >= trigger) return move("triggered", "triggered", score)
      if (score >= zoneEnter) return move("zone_entered", "zone_entered", score)
      return stay()

    case "zone_entered":
      if (score >= trigger) return move("triggered", "triggered", Math.max(prev.peakScore, score))
      if (score < invalidate) return move("resolved", "resolved", prev.peakScore)
      return stay()

    case "triggered":
      // Stays triggered while it holds above the invalidation floor.
      if (score < invalidate) return move("invalidated", "invalidated", prev.peakScore)
      return stay()

    case "invalidated":
    case "resolved":
      // Re-arm once the score has fully receded below the invalidation floor.
      if (score < invalidate) return move("neutral", "rearmed", 0)
      return stay()

    default:
      return stay()
  }
}

/**
 * Replay a full score history through the machine, returning the final snapshot
 * and every transition. Handy for backfilling `signal_events` and for tests.
 */
export function replaySignalHistory(
  readings: SignalReading[],
  thresholds: SignalThresholds,
  initial: SignalStateSnapshot = INITIAL_SNAPSHOT,
): { snapshot: SignalStateSnapshot; transitions: SignalTransition[] } {
  let snapshot = initial
  const transitions: SignalTransition[] = []
  for (const reading of readings) {
    const evo = evolveSignalState(snapshot, reading, thresholds)
    snapshot = evo.snapshot
    if (evo.transition) transitions.push(evo.transition)
  }
  return { snapshot, transitions }
}

/**
 * Default thresholds for the two flagship composite scores. Both use the
 * higher-is-stronger convention; direction sets long (dip) vs. short (euphoria).
 */
export const DEFAULT_SIGNAL_THRESHOLDS: Record<"blackSwan" | "euphoria", SignalThresholds> = {
  blackSwan: { zoneEnter: 50, trigger: 70, invalidate: 40, direction: "long" },
  euphoria: { zoneEnter: 50, trigger: 70, invalidate: 40, direction: "short" },
}
