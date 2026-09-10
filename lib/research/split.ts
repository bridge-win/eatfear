/**
 * Parameter selection with enforced train/test isolation.
 *
 * The failure this prevents: picking parameters on the full history and then reporting
 * the same history as "out-of-sample". `selectParams` refuses to look at any bar dated
 * on or after the cutoff, and throws rather than silently truncating — a silent truncation
 * would still produce a plausible-looking number, which is worse than an error.
 */

import { runLedger, summarize, type Bar, type LedgerConfig, type PerformanceStats } from "./ledger.ts"

export interface Rule<P> {
  id: string
  name: string
  family: string
  /** Parameter grid searched during selection. Keep it small; every extra cell inflates the multiple-comparison count. */
  grid: P[]
  /**
   * Targets for every bar. Implementations receive the full series so indicators can warm up,
   * but must never read bars[j] for j > i when producing targets[i].
   */
  targets: (bars: Bar[], params: P) => number[]
}

export interface SelectionResult<P> {
  params: P
  stats: PerformanceStats
  grid: { params: P; stats: PerformanceStats }[]
}

export function assertNoLeakage(bars: Bar[], cutoff: number, label = "selection"): void {
  const last = bars[bars.length - 1]
  if (last && last.time >= cutoff) {
    throw new Error(`Leakage in ${label}: saw bar ${new Date(last.time).toISOString().slice(0, 10)} at or after cutoff ${new Date(cutoff).toISOString().slice(0, 10)}`)
  }
}

export function selectParams<P>(
  rule: Rule<P>,
  trainBars: Bar[],
  cutoff: number,
  config: LedgerConfig,
  minTrades = 5,
): SelectionResult<P> {
  assertNoLeakage(trainBars, cutoff, `selectParams(${rule.id})`)
  const grid = rule.grid.map((params) => ({
    params,
    stats: summarize(runLedger(trainBars, rule.targets(trainBars, params), config)),
  }))
  const eligible = grid.filter((g) => g.stats.trades >= minTrades)
  const pool = eligible.length > 0 ? eligible : grid
  const best = pool.reduce((a, b) => (b.stats.sharpe > a.stats.sharpe ? b : a))
  return { params: best.params, stats: best.stats, grid }
}

export interface EvaluateResult<P> {
  params: P
  is: PerformanceStats
  oos: PerformanceStats
  /** Sharpe of every grid cell measured on the test window — diagnosis only, never selection. */
  plane: { params: P; oosSharpe: number; oosTotal: number }[]
  planeSpread: number
  concentration: { all: number; drop1: number; drop3: number; n: number }
  yearly: Record<string, number>
  equity: { time: number; value: number }[]
}

/** Split-once evaluation: select on train, freeze, then score the untouched test window. */
export function evaluate<P>(rule: Rule<P>, bars: Bar[], testStart: number, config: LedgerConfig): EvaluateResult<P> {
  const trainBars = bars.filter((b) => b.time < testStart)
  const { params, grid } = selectParams(rule, trainBars, testStart, config)

  const full = runLedger(bars, rule.targets(bars, params), config)
  const splitIndex = bars.findIndex((b) => b.time >= testStart)
  const isStats = summarize(sliceResult(full, 0, splitIndex), 365)
  const oosStats = summarize(sliceResult(full, splitIndex, bars.length), 365)

  const plane = grid.map((g) => {
    const r = runLedger(bars, rule.targets(bars, g.params), config)
    const s = summarize(sliceResult(r, splitIndex, bars.length), 365)
    return { params: g.params, oosSharpe: s.sharpe, oosTotal: s.total }
  })
  const sharpes = plane.map((p) => p.oosSharpe)
  const planeSpread = sharpes.length ? Math.max(...sharpes) - Math.min(...sharpes) : 0

  return {
    params,
    is: isStats,
    oos: oosStats,
    plane,
    planeSpread,
    concentration: concentration(full, splitIndex),
    yearly: yearlyReturns(full),
    equity: full.times.map((t, i) => ({ time: t, value: full.equity[i] })),
  }
}

function sliceResult(result: ReturnType<typeof runLedger>, from: number, to: number) {
  const base = result.equity[Math.max(0, from)] || 1
  return {
    times: result.times.slice(from, to),
    equity: result.equity.slice(from, to).map((v) => v / base),
    exposure: result.exposure.slice(from, to),
    returns: result.returns.slice(from, to),
    fills: result.fills.filter((f) => f.time >= (result.times[from] ?? -Infinity) && f.time < (result.times[to] ?? Infinity)),
    totalFees: 0,
    turnover: 0,
  }
}

/** How much of the test-window profit came from the best few trades. */
function concentration(result: ReturnType<typeof runLedger>, splitIndex: number) {
  const segs = tradeReturns(result, splitIndex)
  const sorted = [...segs].sort((a, b) => a - b)
  const prod = (arr: number[]) => arr.reduce((a, b) => a * (1 + b), 1) - 1
  return {
    all: prod(sorted),
    drop1: prod(sorted.slice(0, -1)),
    drop3: prod(sorted.slice(0, -3)),
    n: sorted.length,
  }
}

function tradeReturns(result: ReturnType<typeof runLedger>, from: number): number[] {
  const out: number[] = []
  let start = -1
  for (let i = Math.max(1, from); i <= result.exposure.length; i++) {
    const prev = result.exposure[i - 1]
    const cur = i < result.exposure.length ? result.exposure[i] : 0
    if (Math.abs(prev) > 1e-12 && start === -1) start = i - 1
    if (start !== -1 && Math.sign(cur) !== Math.sign(prev)) {
      out.push(result.equity[Math.min(i, result.equity.length - 1)] / result.equity[start] - 1)
      start = Math.abs(cur) > 1e-12 ? i : -1
    }
  }
  return out
}

function yearlyReturns(result: ReturnType<typeof runLedger>): Record<string, number> {
  const out: Record<string, number> = {}
  const byYear = new Map<string, number[]>()
  result.times.forEach((t, i) => {
    if (i === 0) return
    const y = new Date(t).getUTCFullYear().toString()
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(result.returns[i])
  })
  for (const [y, rs] of byYear) out[y] = rs.reduce((a, b) => a * (1 + b), 1) - 1
  return out
}

export interface WalkForwardWindow<P> {
  trainEnd: string
  testEnd: string
  params: P
  total: number
  sharpe: number
}

export interface WalkForwardResult<P> {
  windows: WalkForwardWindow<P>[]
  nWindows: number
  winWindows: number
  pctWindows: number
  paramSwitches: number
  sharpe: number
  total: number
}

/**
 * Rolling re-selection: each window picks its own parameters from data strictly before
 * the window, so the stitched curve is many independent exams instead of one.
 */
export function walkForward<P>(
  rule: Rule<P>,
  bars: Bar[],
  config: LedgerConfig,
  trainYears = 3,
  testMonths = 6,
): WalkForwardResult<P> {
  const DAY = 86_400_000
  const windows: WalkForwardWindow<P>[] = []
  const stitched: number[] = []
  let trainEnd = bars[0].time + trainYears * 365.25 * DAY
  const end = bars[bars.length - 1].time

  while (trainEnd < end) {
    const testEnd = Math.min(trainEnd + testMonths * 30.44 * DAY, end)
    if (testEnd - trainEnd < 20 * DAY) break
    const trainBars = bars.filter((b) => b.time < trainEnd)
    if (trainBars.length < 300) {
      trainEnd = testEnd
      continue
    }
    let params: P
    try {
      params = selectParams(rule, trainBars, trainEnd, config).params
    } catch {
      trainEnd = testEnd
      continue
    }
    const full = runLedger(bars, rule.targets(bars, params), config)
    const idx = full.times.map((t, i) => ({ t, i })).filter(({ t }) => t >= trainEnd && t < testEnd).map(({ i }) => i)
    if (idx.length > 5) {
      const rs = idx.map((i) => full.returns[i])
      const total = rs.reduce((a, b) => a * (1 + b), 1) - 1
      const mean = rs.reduce((a, b) => a + b, 0) / rs.length
      const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rs.length - 1))
      windows.push({
        trainEnd: new Date(trainEnd).toISOString().slice(0, 10),
        testEnd: new Date(testEnd).toISOString().slice(0, 10),
        params,
        total,
        sharpe: sd > 0 ? (mean / sd) * Math.sqrt(365) : 0,
      })
      stitched.push(...rs)
    }
    trainEnd = testEnd
  }

  const keys = windows.map((w) => JSON.stringify(w.params))
  const paramSwitches = keys.slice(1).filter((k, i) => k !== keys[i]).length
  const mean = stitched.length ? stitched.reduce((a, b) => a + b, 0) / stitched.length : 0
  const sd = stitched.length > 1 ? Math.sqrt(stitched.reduce((a, b) => a + (b - mean) ** 2, 0) / (stitched.length - 1)) : 0
  const wins = windows.filter((w) => w.total > 0).length
  return {
    windows,
    nWindows: windows.length,
    winWindows: wins,
    pctWindows: windows.length ? wins / windows.length : 0,
    paramSwitches,
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(365) : 0,
    total: stitched.reduce((a, b) => a * (1 + b), 1) - 1,
  }
}

export type VerdictTag = "样本外为负" | "参数尖峰" | "靠少数几笔" | "年份不稳" | "滚动前推不过半" | "未被证伪"

/** The same three checks the frozen evidence file used, so old and new results stay comparable. */
export function verdict<P>(result: EvaluateResult<P>, wf?: WalkForwardResult<P>): VerdictTag[] {
  const tags: VerdictTag[] = []
  if (result.oos.sharpe <= 0) tags.push("样本外为负")
  if (result.planeSpread > 1.2) tags.push("参数尖峰")
  if (result.concentration.all > 0 && result.concentration.drop3 <= 0) tags.push("靠少数几笔")
  const years = Object.values(result.yearly)
  if (years.length > 0 && years.filter((v) => v > 0).length / years.length < 0.5) tags.push("年份不稳")
  if (wf && wf.nWindows > 0 && wf.pctWindows < 0.6) tags.push("滚动前推不过半")
  return tags.length ? tags : ["未被证伪"]
}

/**
 * Deflated Sharpe (Bailey & López de Prado 2014): the probability the observed Sharpe
 * is truly positive once you account for having tried `nTrials` configurations.
 */
export function deflatedSharpe(returns: number[], nTrials: number, trialSharpeVariance: number): number {
  const n = returns.length
  if (n < 30) return 0
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
  if (sd === 0) return 0
  const sr = mean / sd
  const m3 = returns.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / n
  const m4 = returns.reduce((a, b) => a + ((b - mean) / sd) ** 4, 0) / n
  const gamma = 0.5772156649
  const emax = Math.sqrt(Math.max(trialSharpeVariance, 1e-12)) *
    ((1 - gamma) * invNorm(1 - 1 / nTrials) + gamma * invNorm(1 - 1 / (nTrials * Math.E)))
  const denom = Math.sqrt(Math.max(1 - m3 * sr + ((m4 - 1) / 4) * sr * sr, 1e-9))
  return normCdf(((sr - emax) * Math.sqrt(n - 1)) / denom)
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function erf(x: number): number {
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}

function invNorm(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  let lo = -8
  let hi = 8
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (normCdf(mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
