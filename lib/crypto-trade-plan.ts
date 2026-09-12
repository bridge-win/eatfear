export type Horizon = "2d" | "2w" | "2m"
export interface TradeBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  takerBuyQuote: number | null
}

export const HORIZONS = {
  "2d": { interval: "1h", stepMs: 3_600_000, holdBars: 48, stopAtr: 2, weights: { trend: 35, structure: 25, flow: 40 } },
  "2w": { interval: "4h", stepMs: 14_400_000, holdBars: 84, stopAtr: 2.5, weights: { trend: 45, structure: 30, flow: 25 } },
  "2m": { interval: "1d", stepMs: 86_400_000, holdBars: 60, stopAtr: 3, weights: { trend: 55, structure: 30, flow: 15 } },
} as const

// Frozen before the first historical run; these are hypotheses, not fitted probabilities.
export const PLAN_VERSION = "btc-horizons-v1"
export const PLAN_POLICY = { entryScore: 25, exitScore: -15, minimumCoverage: 70, riskFraction: 0.005, positionCap: 0.25, rewardRisk: 2.5, fee: 0.001, slippage: 0.0005 } as const

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n))
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)

export function cleanTradeBars(bars: TradeBar[], stepMs: number, asOf = Date.now()): TradeBar[] {
  const unique = new Map<number, TradeBar>()
  for (const b of bars) {
    if (![b.time, b.open, b.high, b.low, b.close, b.volume, b.quoteVolume].every(Number.isFinite)) continue
    if (b.time < 0 || b.time + stepMs > asOf || b.low <= 0 || b.high < Math.max(b.open, b.close) || b.low > Math.min(b.open, b.close) || b.volume < 0 || b.quoteVolume < 0) continue
    const buy = b.takerBuyQuote
    unique.set(b.time, { ...b, takerBuyQuote: buy !== null && Number.isFinite(buy) && buy >= 0 && buy <= b.quoteVolume ? buy : null })
  }
  return [...unique.values()].sort((a, b) => a.time - b.time)
}

export interface PlanFeature {
  time: number
  price: number
  atr: number
  rsi: number
  ema20: number
  ema50: number
  ema200: number
  macdHistogram: number
  vwap: number
  resistance: number
  support: number
  flowRatio: number | null
  cvd: number | null
  bullishDivergence: boolean
  bearishDivergence: boolean
  trend: number
  structure: number
  flow: number | null
  score: number
  coverage: number
  shock: boolean
  continuous: boolean
  setup: "breakout" | "pullback" | "reversal" | null
}

export function buildPlanFeatures(bars: TradeBar[], horizon: Horizon): PlanFeature[] {
  const cfg = HORIZONS[horizon]
  let e20 = bars[0]?.close ?? 0, e50 = e20, e200 = e20, e12 = e20, e26 = e20, macdSignal = 0
  let atr = 0, gain = 0, loss = 0, cvd = 0
  const result: PlanFeature[] = []
  const ema = (prev: number, price: number, period: number) => prev + (price - prev) * 2 / (period + 1)
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], prev = bars[i - 1]
    const change = prev ? b.close - prev.close : 0
    const tr = prev ? Math.max(b.high - b.low, Math.abs(b.high - prev.close), Math.abs(b.low - prev.close)) : b.high - b.low
    atr = i < 14 ? (atr * i + tr) / (i + 1) : (atr * 13 + tr) / 14
    gain = i <= 14 ? gain + Math.max(change, 0) / 14 : (gain * 13 + Math.max(change, 0)) / 14
    loss = i <= 14 ? loss + Math.max(-change, 0) / 14 : (loss * 13 + Math.max(-change, 0)) / 14
    e20 = ema(e20, b.close, 20); e50 = ema(e50, b.close, 50); e200 = ema(e200, b.close, 200)
    e12 = ema(e12, b.close, 12); e26 = ema(e26, b.close, 26); macdSignal = ema(macdSignal, e12 - e26, 9)
    const recent = bars.slice(Math.max(0, i - 19), i + 1)
    const prior = bars.slice(Math.max(0, i - 20), i)
    const sumVolume = recent.reduce((s, c) => s + c.volume, 0)
    const vwap = sumVolume > 0 ? recent.reduce((s, c) => s + c.quoteVolume, 0) / sumVolume : b.close
    const flowWindow = recent.slice(-8)
    const hasFlow = flowWindow.length === 8 && flowWindow.every((c) => c.takerBuyQuote !== null && c.quoteVolume > 0)
    const flowRatio = hasFlow ? flowWindow.reduce((s, c) => s + 2 * c.takerBuyQuote! - c.quoteVolume, 0) / flowWindow.reduce((s, c) => s + c.quoteVolume, 0) : null
    // A missing aggressor side breaks the cumulative segment; never synthesize CVD from candle colour.
    cvd = b.takerBuyQuote === null ? 0 : cvd + 2 * b.takerBuyQuote - b.quoteVolume
    const oldWindow = bars.slice(Math.max(0, i - 10), Math.max(0, i - 5))
    const newWindow = bars.slice(Math.max(0, i - 5), i)
    const oldLow = oldWindow.reduce((best, c) => c.low < best.low ? c : best, oldWindow[0] ?? b)
    const newLow = newWindow.reduce((best, c) => c.low < best.low ? c : best, newWindow[0] ?? b)
    const oldHigh = oldWindow.reduce((best, c) => c.high > best.high ? c : best, oldWindow[0] ?? b)
    const newHigh = newWindow.reduce((best, c) => c.high > best.high ? c : best, newWindow[0] ?? b)
    const previousFeatures = result.slice(-10)
    const flowAt = (time: number) => previousFeatures.find((f) => f.time === time)?.cvd ?? null
    const divergenceReady = i >= 210 && bars.slice(i - 10, i + 1).every((c) => c.takerBuyQuote !== null)
    const bullishDivergence = divergenceReady && newLow.low < oldLow.low && flowAt(newLow.time)! > flowAt(oldLow.time)! && b.close > (prev?.high ?? Infinity) && b.close > vwap
    const bearishDivergence = divergenceReady && newHigh.high > oldHigh.high && flowAt(newHigh.time)! < flowAt(oldHigh.time)! && b.close < (prev?.low ?? 0) && b.close < vwap
    const scale = Math.max(atr, b.close * 1e-6)
    const slope = e20 - (result[i - 5]?.ema20 ?? e20)
    const trend = clamp(0.6 * clamp((e20 - e50) / (2 * scale)) + 0.25 * clamp(slope / scale) + 0.15 * Math.sign(b.close - e200))
    const resistance = prior.length ? Math.max(...prior.map((c) => c.high)) : b.high
    const support = prior.length ? Math.min(...prior.map((c) => c.low)) : b.low
    const structure = clamp(0.6 * clamp((b.close - vwap) / (2 * scale)) + (b.close > resistance ? 0.4 : b.close < support ? -0.4 : 0) + (bullishDivergence ? 0.4 : bearishDivergence ? -0.4 : 0))
    const flow = flowRatio === null ? null : clamp(flowRatio / 0.15)
    const coverage = i < 200 ? 0 : cfg.weights.trend + cfg.weights.structure + (flow === null ? 0 : cfg.weights.flow)
    const score = trend * cfg.weights.trend + structure * cfg.weights.structure + (flow ?? 0) * cfg.weights.flow
    const shock = atr > 0 && Math.abs(change) > 3 * atr
    const continuous = i >= 200 && bars.slice(i - 200, i + 1).every((c, k, w) => k === 0 || c.time - w[k - 1].time === cfg.stepMs)
    const chasing = b.close > e20 + 2 * scale
    const aligned = e20 > e50 && b.close > e20
    const breakout = aligned && b.close > resistance && b.volume > mean(prior.map((c) => c.volume)) * 1.2
    const pullback = aligned && b.low <= e20 + 0.25 * scale && b.close > (prev?.high ?? Infinity)
    const setup = chasing ? null : breakout ? "breakout" : pullback ? "pullback" : bullishDivergence && b.close > e20 ? "reversal" : null
    result.push({ time: b.time, price: b.close, atr, rsi: i < 14 ? 50 : gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss), ema20: e20, ema50: e50, ema200: e200, macdHistogram: e12 - e26 - macdSignal, vwap, resistance, support, flowRatio, cvd: b.takerBuyQuote === null ? null : cvd, bullishDivergence, bearishDivergence, trend, structure, flow, score, coverage, shock, continuous, setup })
  }
  return result
}

export function planDecision(feature: PlanFeature, horizon: Horizon, asOf: number) {
  const cfg = HORIZONS[horizon]
  const stale = asOf - (feature.time + cfg.stepMs) > cfg.stepMs * 1.5 || asOf < feature.time + cfg.stepMs
  const blocked = stale || !feature.continuous || feature.coverage < PLAN_POLICY.minimumCoverage || feature.shock || feature.atr <= 0
  const action = blocked ? "wait" : feature.score <= PLAN_POLICY.exitScore || feature.bearishDivergence ? "reduce" : feature.score >= PLAN_POLICY.entryScore && feature.setup ? "buy" : "watch"
  const riskDistance = cfg.stopAtr * feature.atr
  const stop = Math.max(0, feature.price - riskDistance)
  const positionFraction = riskDistance > 0 ? Math.min(PLAN_POLICY.positionCap, PLAN_POLICY.riskFraction * feature.price / riskDistance) : 0
  return { action, stale, blocked, stop, target: feature.price + PLAN_POLICY.rewardRisk * riskDistance, positionFraction, timeStopHours: cfg.holdBars * cfg.stepMs / 3_600_000, reason: stale ? "stale" : !feature.continuous ? "gaps_or_warmup" : feature.coverage < PLAN_POLICY.minimumCoverage ? "missing_flow" : feature.shock ? "volatility_shock" : action === "buy" ? feature.setup : action === "reduce" ? "structure_weakened" : "await_confirmation" } as const
}
