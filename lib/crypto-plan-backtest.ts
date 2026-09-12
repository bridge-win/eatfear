import { buildPlanFeatures, HORIZONS, PLAN_POLICY, planDecision, type Horizon, type TradeBar } from "./crypto-trade-plan.ts"

export interface PlanTrade { entryTime: number; exitTime: number; entry: number; exit: number; pnl: number; reason: string }
export interface PlanPerformance {
  netReturn: number; maxDrawdown: number; trades: number; winRate: number | null
  profitFactor: number | null; exposure: number; fees: number; equity: number[]; ledger: PlanTrade[]
}

export function runPlanBacktest(bars: TradeBar[], horizon: Horizon, options: { startIndex: number; endIndex?: number; costMultiplier?: number; baseline?: "ema" } ): PlanPerformance {
  const features = buildPlanFeatures(bars, horizon)
  const cfg = HORIZONS[horizon]
  const fee = PLAN_POLICY.fee * (options.costMultiplier ?? 1)
  const slip = PLAN_POLICY.slippage * (options.costMultiplier ?? 1)
  const endIndex = Math.min(bars.length, options.endIndex ?? bars.length)
  let cash = 1, units = 0, fees = 0, entry = 0, entryTime = 0, entryIndex = 0, basis = 0, stop = 0, target = 0, heldBars = 0
  const equity: number[] = [1], ledger: PlanTrade[] = []
  function close(rawPrice: number, bar: TradeBar, reason: string) {
    const exit = rawPrice * (1 - slip)
    const commission = units * exit * fee
    const proceeds = units * exit - commission
    cash += proceeds; fees += commission
    ledger.push({ entryTime, exitTime: bar.time, entry, exit, pnl: proceeds - basis, reason })
    units = 0
  }
  for (let i = Math.max(1, options.startIndex); i < endIndex; i++) {
    const b = bars[i], f = features[i - 1]
    const decision = planDecision(f, horizon, b.time)
    const gap = b.time - bars[i - 1].time !== cfg.stepMs
    let exited = false
    if (units > 0) {
      if (gap) { close(b.open, b, "data_gap"); exited = true }
      else if (b.open <= stop) { close(b.open, b, "gap_stop"); exited = true }
      else if ((options.baseline === "ema" ? f.ema20 <= f.ema50 : decision.action === "reduce") || i - entryIndex >= cfg.holdBars) {
        close(b.open, b, i - entryIndex >= cfg.holdBars ? "time_stop" : "signal_exit"); exited = true
      }
    }
    const entrySignal = options.baseline === "ema" ? f.ema20 > f.ema50 && f.continuous && !f.shock : decision.action === "buy"
    if (units === 0 && !exited && !gap && entrySignal && Math.abs(b.open - f.price) <= 0.5 * f.atr) {
      const price = b.open * (1 + slip)
      const distance = price - decision.stop
      if (distance > 0 && decision.stop > 0 && distance / price > 2 * (fee + slip)) {
        const allocation = Math.min(PLAN_POLICY.positionCap, PLAN_POLICY.riskFraction * price / distance)
        basis = cash * allocation
        units = basis / (price * (1 + fee))
        fees += units * price * fee
        cash -= basis
        entry = price; entryTime = b.time; entryIndex = i; stop = decision.stop
        target = price + PLAN_POLICY.rewardRisk * distance
      }
    }
    if (units > 0) {
      heldBars++
      // Intrabar ordering is unknown; the adverse stop wins, including on the entry bar.
      if (b.low <= stop) close(Math.min(b.open, stop), b, "stop")
      else if (b.high >= target) close(target, b, "target")
    }
    if (units > 0 && i === endIndex - 1) close(b.close, b, "sample_end")
    equity.push(cash + units * b.close)
  }
  let peak = 1, maxDrawdown = 0
  for (const e of equity) { peak = Math.max(peak, e); maxDrawdown = Math.min(maxDrawdown, e / peak - 1) }
  const wins = ledger.filter((t) => t.pnl > 0), losses = ledger.filter((t) => t.pnl < 0)
  const grossLoss = -losses.reduce((s, t) => s + t.pnl, 0)
  return { netReturn: equity.at(-1)! - 1, maxDrawdown, trades: ledger.length, winRate: ledger.length ? wins.length / ledger.length : null, profitFactor: grossLoss > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / grossLoss : null, exposure: heldBars / Math.max(1, endIndex - options.startIndex), fees, equity, ledger }
}

export function buyHoldReturn(bars: TradeBar[], start: number, multiplier = 1) {
  if (!bars[start] || !bars.at(-1)) return null
  const fee = PLAN_POLICY.fee * multiplier, slip = PLAN_POLICY.slippage * multiplier
  return bars.at(-1)!.close * (1 - slip) * (1 - fee) / (bars[start].open * (1 + slip) * (1 + fee)) - 1
}
