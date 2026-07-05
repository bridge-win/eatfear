export type SignalDirection = "long" | "short" | "risk_off"

export type SignalLifecycleState =
  | "neutral"
  | "zone_entered"
  | "triggered"
  | "invalidated"
  | "resolved"

export interface SignalStateSnapshot {
  symbol: string
  signalId: string
  direction: SignalDirection
  state: SignalLifecycleState
  score: number
  observedAt: number
  enteredAt?: number
  triggeredAt?: number
  invalidatedAt?: number
  resolvedAt?: number
}

export interface SignalThresholds {
  enter: number
  trigger: number
  invalidate: number
  resolve: number
}

export interface SignalStateTransition {
  previous: SignalStateSnapshot
  next: SignalStateSnapshot
  event:
    | "none"
    | "zone_entered"
    | "triggered"
    | "invalidated"
    | "resolved"
    | "reset"
}

export interface SignalEventPayload {
  symbol: string
  signalId: string
  direction: SignalDirection
  state: SignalLifecycleState
  score: number
  evidence: Record<string, unknown>
  triggeredAt: number
}

function baseNext(previous: SignalStateSnapshot, score: number, observedAt: number): SignalStateSnapshot {
  return {
    ...previous,
    score,
    observedAt,
  }
}

export function createNeutralSignalState({
  symbol,
  signalId,
  direction,
  observedAt,
}: {
  symbol: string
  signalId: string
  direction: SignalDirection
  observedAt: number
}): SignalStateSnapshot {
  return {
    symbol,
    signalId,
    direction,
    state: "neutral",
    score: 0,
    observedAt,
  }
}

export function resolveSignalTransition({
  previous,
  score,
  observedAt,
  thresholds,
}: {
  previous: SignalStateSnapshot
  score: number
  observedAt: number
  thresholds: SignalThresholds
}): SignalStateTransition {
  const next = baseNext(previous, score, observedAt)

  if (previous.state === "neutral") {
    if (score >= thresholds.trigger) {
      return {
        previous,
        next: { ...next, state: "triggered", enteredAt: observedAt, triggeredAt: observedAt },
        event: "triggered",
      }
    }
    if (score >= thresholds.enter) {
      return {
        previous,
        next: { ...next, state: "zone_entered", enteredAt: observedAt },
        event: "zone_entered",
      }
    }
    return { previous, next, event: "none" }
  }

  if (previous.state === "zone_entered") {
    if (score <= thresholds.invalidate) {
      return {
        previous,
        next: { ...next, state: "invalidated", invalidatedAt: observedAt },
        event: "invalidated",
      }
    }
    if (score >= thresholds.trigger) {
      return {
        previous,
        next: { ...next, state: "triggered", triggeredAt: observedAt },
        event: "triggered",
      }
    }
    return { previous, next, event: "none" }
  }

  if (previous.state === "triggered") {
    if (score <= thresholds.resolve) {
      return {
        previous,
        next: { ...next, state: "resolved", resolvedAt: observedAt },
        event: "resolved",
      }
    }
    if (score <= thresholds.invalidate) {
      return {
        previous,
        next: { ...next, state: "invalidated", invalidatedAt: observedAt },
        event: "invalidated",
      }
    }
    return { previous, next, event: "none" }
  }

  if (score >= thresholds.enter) {
    return {
      previous,
      next: { ...next, state: "zone_entered", enteredAt: observedAt },
      event: "reset",
    }
  }

  return { previous, next: { ...next, state: "neutral" }, event: "reset" }
}

export function toSignalEventPayload({
  snapshot,
  evidence,
}: {
  snapshot: SignalStateSnapshot
  evidence: Record<string, unknown>
}): SignalEventPayload {
  return {
    symbol: snapshot.symbol,
    signalId: snapshot.signalId,
    direction: snapshot.direction,
    state: snapshot.state,
    score: snapshot.score,
    evidence,
    triggeredAt: snapshot.triggeredAt ?? snapshot.enteredAt ?? snapshot.observedAt,
  }
}
