/**
 * Forward-return backtest engine — the computational validation the product
 * "research-validated" framing has been missing.
 *
 * Given a price series and a signal predicate, it measures what *actually*
 * happened after the signal fired: forward N-day return distribution, hit-rate,
 * max adverse excursion, and — crucially — the edge vs. an unconditional
 * baseline (buying on a random day). This is what lets a signal card or a
 * notification say "this condition occurred n times; 90d median +X%, hit-rate
 * Y%, deepest interim drawdown Z%" instead of an unbacked assertion.
 *
 * Honesty guarantees baked in:
 *  - No lookahead: the predicate at bar i only sees bars[0..i]; forward returns
 *    read strictly future bars.
 *  - Overlap de-duplication: consecutive in-zone bars are collapsed via
 *    `minGapBars` so a 30-day-long zone is not counted as 30 "independent"
 *    signals (the classic way backtests inflate sample size).
 *  - Baseline comparison: every stat is reported against the unconditional
 *    distribution over the same horizon, so a "70% hit-rate" is judged against
 *    the asset's own drift, not in a vacuum.
 *
 * Pure functions, no I/O.
 */

export interface BacktestBar {
  time: number
  close: number
  /** Optional intra-bar low for max-adverse-excursion; falls back to close. */
  low?: number
}

/**
 * Predicate deciding whether a signal is active at bar `i`, seeing only history
 * up to and including `i`. Must not read `bars[j]` for j > i.
 */
export type SignalPredicate = (i: number, bars: BacktestBar[]) => boolean

export interface ForwardReturnStats {
  horizonBars: number
  /** De-duplicated signal occurrences with a full forward window available. */
  count: number
  /** Share of occurrences with a positive forward return (0–1). */
  hitRate: number
  medianReturnPct: number
  meanReturnPct: number
  p25ReturnPct: number
  p75ReturnPct: number
  bestReturnPct: number
  worstReturnPct: number
  /** Median deepest drawdown between entry and horizon (negative %). */
  medianMaxAdverseExcursionPct: number
  /** Unconditional median forward return over the same horizon. */
  baselineMedianReturnPct: number
  /** Unconditional hit-rate over the same horizon (0–1). */
  baselineHitRate: number
  /** medianReturnPct − baselineMedianReturnPct (edge in percentage points). */
  edgeVsBaselinePct: number
}

export interface BacktestResult {
  totalBars: number
  /** Raw bars where the predicate was true (before overlap de-dup). */
  rawSignalBars: number
  /** De-duplicated signal entries actually measured. */
  signalEntries: number
  horizons: ForwardReturnStats[]
}

export interface BacktestOptions {
  /** Forward horizons in bars (e.g. daily bars → [7, 30, 90]). */
  horizonsBars?: number[]
  /**
   * Minimum bars between counted signals. Collapses a contiguous in-zone stretch
   * to one entry (plus re-arms after the gap). Default 5.
   */
  minGapBars?: number
}

// ─── stats helpers ────────────────────────────────────────────────────────

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return NaN
  if (sortedAsc.length === 1) return sortedAsc[0]
  const pos = (sortedAsc.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sortedAsc[lo]
  const frac = pos - lo
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac
}

const median = (sortedAsc: number[]) => quantile(sortedAsc, 0.5)

/** Forward return % from bar i to bar i+h. */
function forwardReturnPct(bars: BacktestBar[], i: number, h: number): number | null {
  const entry = bars[i]?.close
  const exit = bars[i + h]?.close
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0) return null
  return ((exit - entry) / entry) * 100
}

/** Deepest drawdown (negative %) between entry i and i+h, using low when present. */
function maxAdverseExcursionPct(bars: BacktestBar[], i: number, h: number): number {
  const entry = bars[i]?.close
  if (!Number.isFinite(entry) || entry <= 0) return 0
  let worst = 0
  for (let k = i + 1; k <= i + h && k < bars.length; k += 1) {
    const trough = Number.isFinite(bars[k].low as number) ? (bars[k].low as number) : bars[k].close
    const dd = ((trough - entry) / entry) * 100
    if (dd < worst) worst = dd
  }
  return worst
}

/** Unconditional forward-return distribution over all valid bars for horizon h. */
function baselineForHorizon(bars: BacktestBar[], h: number): { median: number; hitRate: number } {
  const rets: number[] = []
  for (let i = 0; i + h < bars.length; i += 1) {
    const r = forwardReturnPct(bars, i, h)
    if (r !== null) rets.push(r)
  }
  if (rets.length === 0) return { median: NaN, hitRate: NaN }
  const hits = rets.filter((r) => r > 0).length
  return { median: median([...rets].sort((a, b) => a - b)), hitRate: hits / rets.length }
}

// ─── main ─────────────────────────────────────────────────────────────────

export function backtestSignal(
  bars: BacktestBar[],
  isSignal: SignalPredicate,
  options: BacktestOptions = {},
): BacktestResult {
  const horizonsBars = options.horizonsBars ?? [7, 30, 90]
  const minGapBars = Math.max(1, options.minGapBars ?? 5)
  const maxHorizon = Math.max(...horizonsBars)

  // Collect de-duplicated entry indices where the predicate first (re-)fires.
  const rawSignalIndices: number[] = []
  const entries: number[] = []
  let lastEntry = -Infinity
  for (let i = 0; i < bars.length; i += 1) {
    if (!isSignal(i, bars)) continue
    rawSignalIndices.push(i)
    if (i - lastEntry >= minGapBars) {
      entries.push(i)
      lastEntry = i
    }
  }

  const horizons: ForwardReturnStats[] = horizonsBars.map((h) => {
    const returns: number[] = []
    const maes: number[] = []
    for (const i of entries) {
      const r = forwardReturnPct(bars, i, h)
      if (r === null) continue // not enough forward data → excluded, not zero-filled
      returns.push(r)
      maes.push(maxAdverseExcursionPct(bars, i, h))
    }
    const sorted = [...returns].sort((a, b) => a - b)
    const sortedMae = [...maes].sort((a, b) => a - b)
    const base = baselineForHorizon(bars, h)
    const med = returns.length > 0 ? median(sorted) : NaN
    const hits = returns.filter((r) => r > 0).length
    return {
      horizonBars: h,
      count: returns.length,
      hitRate: returns.length > 0 ? hits / returns.length : NaN,
      medianReturnPct: med,
      meanReturnPct: returns.length > 0 ? returns.reduce((s, v) => s + v, 0) / returns.length : NaN,
      p25ReturnPct: quantile(sorted, 0.25),
      p75ReturnPct: quantile(sorted, 0.75),
      bestReturnPct: sorted.length > 0 ? sorted[sorted.length - 1] : NaN,
      worstReturnPct: sorted.length > 0 ? sorted[0] : NaN,
      medianMaxAdverseExcursionPct: sortedMae.length > 0 ? median(sortedMae) : NaN,
      baselineMedianReturnPct: base.median,
      baselineHitRate: base.hitRate,
      edgeVsBaselinePct: Number.isFinite(med) && Number.isFinite(base.median) ? med - base.median : NaN,
    }
  })

  return {
    totalBars: bars.length,
    rawSignalBars: rawSignalIndices.length,
    signalEntries: entries.length,
    horizons,
  }
}
