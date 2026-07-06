/**
 * Paper-trading P&L — the safe, teaching-first execution layer (P5a). Simulates
 * positions with SL/TP so a user can act on a signal, then compare "the signal's
 * timing vs. mine" with zero regulatory risk. No real funds, no exchange keys.
 *
 * Pure functions, no I/O. Persistence lives in the `paper_positions` table.
 */

export type PositionDirection = "long" | "short"

export interface PaperPosition {
  id: string
  symbol: string
  direction: PositionDirection
  entry: number
  size: number
  stopLoss?: number | null
  takeProfit?: number | null
  openedAt: number
  closedAt?: number | null
  exit?: number | null
  /** Set when closed: why it closed. */
  closeReason?: "stop_loss" | "take_profit" | "manual" | null
}

export interface PositionPnl {
  /** Signed return in % relative to entry, direction-aware. */
  pnlPct: number
  /** Signed absolute P&L in quote currency (size is notional at entry). */
  pnlAbs: number
}

/** Direction-aware return % from entry to a given price. */
export function returnPct(direction: PositionDirection, entry: number, price: number): number {
  if (!(entry > 0) || !Number.isFinite(price)) return 0
  const raw = ((price - entry) / entry) * 100
  return direction === "long" ? raw : -raw
}

export function positionPnl(pos: PaperPosition, currentPrice: number): PositionPnl {
  const price = pos.closedAt && pos.exit != null ? pos.exit : currentPrice
  const pnlPct = returnPct(pos.direction, pos.entry, price)
  return { pnlPct, pnlAbs: (pnlPct / 100) * pos.size }
}

export interface SettlementResult {
  closed: boolean
  exit?: number
  closeReason?: "stop_loss" | "take_profit"
  pnlPct?: number
}

/**
 * Check whether a bar (high/low) would have hit the stop or target. When both
 * are touched in the same bar, the stop is assumed hit first (conservative).
 */
export function settleAgainstBar(pos: PaperPosition, high: number, low: number): SettlementResult {
  if (pos.closedAt) return { closed: false }
  const { direction, stopLoss, takeProfit } = pos

  const stopHit =
    stopLoss != null &&
    (direction === "long" ? low <= stopLoss : high >= stopLoss)
  const tpHit =
    takeProfit != null &&
    (direction === "long" ? high >= takeProfit : low <= takeProfit)

  if (stopHit) {
    return { closed: true, exit: stopLoss as number, closeReason: "stop_loss", pnlPct: returnPct(direction, pos.entry, stopLoss as number) }
  }
  if (tpHit) {
    return { closed: true, exit: takeProfit as number, closeReason: "take_profit", pnlPct: returnPct(direction, pos.entry, takeProfit as number) }
  }
  return { closed: false }
}

export interface PortfolioSummary {
  openCount: number
  closedCount: number
  realizedPnlAbs: number
  unrealizedPnlAbs: number
  winCount: number
  lossCount: number
  winRatePct: number | null
}

/** Aggregate realized/unrealized P&L and win-rate across positions. */
export function summarizePortfolio(
  positions: PaperPosition[],
  priceBySymbol: Record<string, number>,
): PortfolioSummary {
  let realized = 0
  let unrealized = 0
  let openCount = 0
  let closedCount = 0
  let winCount = 0
  let lossCount = 0

  for (const pos of positions) {
    if (pos.closedAt && pos.exit != null) {
      closedCount += 1
      const { pnlAbs } = positionPnl(pos, pos.exit)
      realized += pnlAbs
      if (pnlAbs > 0) winCount += 1
      else if (pnlAbs < 0) lossCount += 1
    } else {
      openCount += 1
      const price = priceBySymbol[pos.symbol]
      if (Number.isFinite(price)) unrealized += positionPnl(pos, price).pnlAbs
    }
  }

  const decided = winCount + lossCount
  return {
    openCount,
    closedCount,
    realizedPnlAbs: realized,
    unrealizedPnlAbs: unrealized,
    winCount,
    lossCount,
    winRatePct: decided > 0 ? (winCount / decided) * 100 : null,
  }
}
