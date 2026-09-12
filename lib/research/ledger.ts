/**
 * Trade ledger for research backtests.
 *
 * Why this exists: forward-return bucketing (lib/backtest/signal-backtest.ts) answers
 * "what happened after this signal", but it never spends cash or pays a fee, so its
 * numbers cannot be reconciled against an account. This module models the account.
 *
 * Timing invariant: a target position decided on bar t is filled at the OPEN of bar t+1.
 * Deciding and filling on the same close is the most common look-ahead bug in crypto
 * backtests, and it is structurally impossible here.
 */

export interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface LedgerConfig {
  /** Per-side taker fee, e.g. 0.0006 for 6 bp. */
  fee: number
  /** Per-side slippage as a fraction of fill price. */
  slippage?: number
  /**
   * Wick stress: fraction of the bar's adverse extreme applied to each fill.
   * 0 fills at the open; 1 fills at the worst price of the bar. Used for stress runs.
   */
  wickWeight?: number
  initialEquity?: number
}

export interface Fill {
  time: number
  /** Signed change in position, in units of exposure (1 = fully long). */
  delta: number
  /** Effective fill price after slippage and wick stress. */
  price: number
  /** Fee plus slippage cost, in equity units. */
  fee: number
  positionAfter: number
  /** Equity immediately after paying costs, before this bar's mark to market. */
  cashAfter: number
  equityAfter: number
}

export interface LedgerResult {
  times: number[]
  equity: number[]
  /** Position effective during each bar (already shifted). */
  exposure: number[]
  returns: number[]
  fills: Fill[]
  totalFees: number
  turnover: number
}

const EPS = 1e-12

/**
 * @param bars ascending by time
 * @param targets targets[i] is the position decided on bar i, effective from bar i+1
 */
export function runLedger(bars: Bar[], targets: number[], config: LedgerConfig): LedgerResult {
  if (bars.length !== targets.length) throw new Error("bars and targets length mismatch")
  const fee = config.fee
  const slip = config.slippage ?? 0
  const wick = config.wickWeight ?? 0
  const initial = config.initialEquity ?? 1

  let position = 0
  let cash = initial
  let units = 0
  let equity = initial
  let totalFees = 0
  let turnover = 0

  const times: number[] = []
  const equitySeries: number[] = []
  const exposure: number[] = []
  const returns: number[] = []
  const fills: Fill[] = []

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]
    const prevEquity = equity

    const desired = i === 0 ? 0 : targets[i - 1]
    const delta = desired - position
    if (Math.abs(delta) > EPS) {
      const adverse = delta > 0 ? Math.max(0, bar.high - bar.open) : Math.max(0, bar.open - bar.low)
      const direction = delta > 0 ? 1 : -1
      const price = bar.open * (1 + direction * slip) + direction * wick * adverse
      const equityAtFill = cash + units * price
      const rawQuantity = desired * equityAtFill / price - units
      // Solve the post-commission target exposure; retain actual units between fills.
      const quantity = rawQuantity / (1 + desired * fee * Math.sign(rawQuantity))
      const commission = Math.abs(quantity) * price * fee
      const cost = commission + Math.abs(quantity) * Math.abs(price - bar.open)
      cash -= quantity * price + commission
      units += quantity
      totalFees += cost
      turnover += Math.abs(delta)
      position = desired
      fills.push({ time: bar.time, delta, price, fee: cost, positionAfter: position, cashAfter: cash, equityAfter: cash + units * bar.open })
    }
    equity = cash + units * bar.close

    times.push(bar.time)
    equitySeries.push(equity)
    exposure.push(position)
    returns.push(prevEquity > 0 ? equity / prevEquity - 1 : 0)
  }

  return { times, equity: equitySeries, exposure, returns, fills, totalFees, turnover }
}

export interface PerformanceStats {
  total: number
  cagr: number
  sharpe: number
  maxdd: number
  trades: number
  win: number
  pf: number
  exposure: number
}

export function summarize(result: LedgerResult, barsPerYear = 365): PerformanceStats {
  const r = result.returns.slice(1)
  const eq = result.equity
  const n = r.length
  if (n === 0) return { total: 0, cagr: 0, sharpe: 0, maxdd: 0, trades: 0, win: 0, pf: 0, exposure: 0 }
  const total = eq[eq.length - 1] / eq[0] - 1
  const years = n / barsPerYear
  const mean = r.reduce((a, b) => a + b, 0) / n
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)
  const sd = Math.sqrt(variance)
  let peak = eq[0]
  let maxdd = 0
  for (const v of eq) {
    peak = Math.max(peak, v)
    maxdd = Math.min(maxdd, v / peak - 1)
  }
  // A trade is a contiguous run of non-zero exposure with a constant sign.
  const segments: number[] = []
  let start = -1
  for (let i = 1; i <= result.exposure.length; i++) {
    const cur = i < result.exposure.length ? result.exposure[i] : 0
    const prev = result.exposure[i - 1]
    const changed = i === result.exposure.length || Math.sign(cur) !== Math.sign(prev)
    if (Math.abs(prev) > EPS && start === -1) start = i - 1
    if (changed && start !== -1) {
      segments.push(eq[Math.min(i, eq.length - 1)] / eq[Math.max(0, start - 1)] - 1)
      start = Math.abs(cur) > EPS ? i : -1
    }
  }
  const wins = segments.filter((v) => v > 0)
  const losses = segments.filter((v) => v <= 0)
  const grossW = wins.reduce((a, b) => a + b, 0)
  const grossL = -losses.reduce((a, b) => a + b, 0)
  return {
    total,
    cagr: years > 0 && eq[eq.length - 1] > 0 ? (eq[eq.length - 1] / eq[0]) ** (1 / years) - 1 : -1,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(barsPerYear) : 0,
    maxdd,
    trades: segments.length,
    win: segments.length ? wins.length / segments.length : 0,
    pf: grossL > 1e-9 ? Math.min(99, grossW / grossL) : grossW > 0 ? 99 : 0,
    exposure: result.exposure.reduce((a, b) => a + (Math.abs(b) > EPS ? 1 : 0), 0) / result.exposure.length,
  }
}

/** Invariants that must hold for any ledger run; throws on violation. */
export function reconcile(result: LedgerResult, config: LedgerConfig): void {
  if (result.equity.some((v) => !Number.isFinite(v))) throw new Error("Ledger produced non-finite equity")
  const feeSum = result.fills.reduce((a, f) => a + f.fee, 0)
  if (Math.abs(feeSum - result.totalFees) > 1e-9) throw new Error("Fee total does not match fills")
  if (config.fee > 0 && result.turnover > 0 && result.totalFees <= 0) throw new Error("Turnover without fees")
  for (let i = 1; i < result.fills.length; i++) {
    if (result.fills[i].time < result.fills[i - 1].time) throw new Error("Fills out of order")
  }
}
