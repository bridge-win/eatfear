/**
 * Black Swan Opportunity Detector
 *
 * Identifies dip-buying setups during sharp wicks, capitulation, and
 * forced-liquidation flushes by combining: candle wick extremity, Fear & Greed,
 * funding/OI deleveraging, drawdown from 90d high, mean-reversion gaps, optional
 * VIX risk-off spikes, and volume climax confirmation.
 *
 * Pure function — no I/O. Caller assembles `BlackSwanMetrics` from upstreams.
 */

export const BLACK_SWAN_WEIGHTS = {
  wickCapitulation: 0.25,
  fearExtreme: 0.2,
  leverageFlush: 0.15,
  drawdownMagnitude: 0.15,
  meanReversion: 0.1,
  macroRiskOff: 0.1,
  volumeClimax: 0.05,
} as const

export type BlackSwanFactorId = keyof typeof BLACK_SWAN_WEIGHTS

export type BlackSwanBand =
  | "no_opportunity"
  | "watch"
  | "building"
  | "strong"
  | "generational"

export interface BlackSwanCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface BlackSwanMetrics {
  /** Daily candles, oldest → newest. Recommended: last 90+ days. */
  candles: BlackSwanCandle[]
  /** Latest Fear & Greed (0–100, lower = more fear). */
  fearGreedValue: number | null
  /** Last N (≈14) F&G values, oldest → newest, for delta. */
  fearGreedRecent: number[]
  /** Current funding rate (percent per period, e.g. -0.05 = shorts pay 5 bp). */
  fundingRatePct: number | null
  /** Recent funding rates (oldest → newest). */
  fundingRecentPct: number[]
  /** OI history in USD (oldest → newest). */
  oiUsdSeries: number[]
  /** Optional VIX value (0–100, higher = stress). */
  vixValue: number | null
  /** Optional VIX history. */
  vixRecent: number[]
}

export interface BlackSwanFactor {
  id: BlackSwanFactorId
  labelZh: string
  labelEn: string
  /** Factor sub-score 0–100. */
  score: number
  /** Weight as a fraction of 1. */
  weight: number
  /** weight × score. */
  weighted: number
  /** Detail explainer lines (bilingual prefix-friendly). */
  lines: string[]
}

export interface BlackSwanActiveSignal {
  code: string
  severity: "info" | "warn" | "alert"
  labelZh: string
  labelEn: string
}

export interface BlackSwanWickEvent {
  time: number
  /** lowerWick / candle range (0–1). */
  lowerWickRatio: number
  /** Absolute lower-wick distance in USD. */
  wickUsd: number
  closeUsd: number
  /** Volume Z-score vs 30-candle mean. */
  volumeZ: number
  /** Forward 24h return after the candle close, if known. */
  rebound24hPct: number | null
}

export interface BlackSwanComputation {
  opportunityScore: number
  signalBand: BlackSwanBand
  signalLabelZh: string
  signalLabelEn: string
  factors: BlackSwanFactor[]
  activeSignals: BlackSwanActiveSignal[]
  recentWicks: BlackSwanWickEvent[]
}

// ─── helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const linTo100 = (x: number, lo: number, hi: number) => {
  if (hi === lo) return 50
  return clamp(((x - lo) / (hi - lo)) * 100, 0, 100)
}
const linInv100 = (x: number, lo: number, hi: number) => 100 - linTo100(x, lo, hi)

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const m = values.reduce((s, v) => s + v, 0) / values.length
  if (values.length < 2) return { mean: m, std: 0 }
  const variance =
    values.reduce((s, v) => s + (v - m) * (v - m), 0) / (values.length - 1)
  return { mean: m, std: Math.sqrt(variance) }
}

function lowerWickRatio(c: BlackSwanCandle): number {
  const range = Math.max(c.high - c.low, Number.EPSILON)
  return clamp((Math.min(c.open, c.close) - c.low) / range, 0, 1)
}

function lowerWickUsd(c: BlackSwanCandle): number {
  return Math.max(0, Math.min(c.open, c.close) - c.low)
}

function bandFromScore(total: number): {
  band: BlackSwanBand
  zh: string
  en: string
} {
  if (total >= 85)
    return { band: "generational", zh: "世代级抄底信号 · 历史级机会", en: "Generational dip · once-a-cycle" }
  if (total >= 70)
    return { band: "strong", zh: "强力机会 · 显著超卖 + 杠杆出清", en: "Strong opportunity · capitulation + flush" }
  if (total >= 50)
    return { band: "building", zh: "机会成型中 · 关注后续确认", en: "Building setup · watch for confirmation" }
  if (total >= 30)
    return { band: "watch", zh: "观察 · 部分极端因子触发", en: "Watch · partial extremes" }
  return { band: "no_opportunity", zh: "暂无机会 · 偏中性或贪婪", en: "No opportunity · neutral or greedy" }
}

// ─── factor scorers ───────────────────────────────────────────────────────

function scoreWickCapitulation(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  const candles = m.candles
  if (candles.length < 14) {
    lines.push("Insufficient candles for wick analysis")
    return {
      id: "wickCapitulation",
      labelZh: "插针出清",
      labelEn: "Wick Capitulation",
      score: 30,
      weight: BLACK_SWAN_WEIGHTS.wickCapitulation,
      weighted: 30 * BLACK_SWAN_WEIGHTS.wickCapitulation,
      lines,
    }
  }
  const last = candles[candles.length - 1]
  const lwr = lowerWickRatio(last)
  const wickUsd = lowerWickUsd(last)

  // Lower-wick ratio distribution over recent 60 candles for z-score
  const window = candles.slice(-60).map(lowerWickRatio)
  const { mean, std } = meanStd(window)
  const z = std > 0 ? (lwr - mean) / std : 0

  // Score scaling: z>3 → 100; z>2 → 85; z>1.5 → 65; z>1 → 45; else 0–35.
  let score: number
  if (z >= 3) score = 100
  else if (z >= 2) score = 85
  else if (z >= 1.5) score = 65
  else if (z >= 1) score = 45
  else if (z >= 0.5) score = 30
  else score = linTo100(lwr, 0, 0.6) * 0.4

  // Boost if absolute wick ratio is large in this candle (>55%)
  if (lwr >= 0.55) score = Math.min(100, score + 8)

  lines.push(
    `Last candle lower-wick ratio ${(lwr * 100).toFixed(1)}% (z=${z.toFixed(2)}) · wick ${wickUsd >= 1000 ? `$${(wickUsd / 1000).toFixed(2)}K` : `$${wickUsd.toFixed(0)}`}`,
  )
  lines.push(
    `60-candle baseline · mean ratio ${(mean * 100).toFixed(1)}% · σ ${(std * 100).toFixed(1)}%`,
  )

  return {
    id: "wickCapitulation",
    labelZh: "插针出清",
    labelEn: "Wick Capitulation",
    score: clamp(score, 0, 100),
    weight: BLACK_SWAN_WEIGHTS.wickCapitulation,
    weighted: clamp(score, 0, 100) * BLACK_SWAN_WEIGHTS.wickCapitulation,
    lines,
  }
}

function scoreFearExtreme(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  let score = 30
  const v = m.fearGreedValue
  if (v === null || !Number.isFinite(v)) {
    lines.push("Fear & Greed unavailable")
  } else {
    if (v < 10) score = 100
    else if (v < 15) score = 92
    else if (v < 20) score = 82
    else if (v < 25) score = 72
    else if (v < 35) score = 55
    else if (v < 50) score = 35
    else if (v < 65) score = 18
    else score = 5
    lines.push(`Fear & Greed ${v.toFixed(0)} (lower = panic floor zone)`)

    const recent = m.fearGreedRecent ?? []
    if (recent.length >= 7) {
      const a = recent[recent.length - 7]
      const drop = a - v
      if (Number.isFinite(drop) && drop >= 15) {
        score = Math.min(100, score + 10)
        lines.push(`F&G fell ${drop.toFixed(0)}pts over 7 prints · panic acceleration`)
      }
    }
  }
  return {
    id: "fearExtreme",
    labelZh: "极度恐慌",
    labelEn: "Fear Extreme",
    score,
    weight: BLACK_SWAN_WEIGHTS.fearExtreme,
    weighted: score * BLACK_SWAN_WEIGHTS.fearExtreme,
    lines,
  }
}

function scoreLeverageFlush(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  let fundingScore = 30
  const fr = m.fundingRatePct
  if (fr === null || !Number.isFinite(fr)) {
    lines.push("Funding rate unavailable")
  } else {
    if (fr <= -0.08) fundingScore = 100
    else if (fr <= -0.04) fundingScore = 88
    else if (fr <= -0.01) fundingScore = 72
    else if (fr <= 0.01) fundingScore = 55
    else if (fr <= 0.04) fundingScore = 30
    else if (fr <= 0.1) fundingScore = 12
    else fundingScore = 3
    lines.push(`Funding ${fr.toFixed(3)}%/period · negative = shorts paying longs`)

    // Flip bonus: negative now, positive a week ago
    const recent = m.fundingRecentPct ?? []
    if (recent.length >= 6 && fr < 0) {
      const past = recent[recent.length - 6]
      if (Number.isFinite(past) && past > 0.01) {
        fundingScore = Math.min(100, fundingScore + 8)
        lines.push(`Funding flipped from +${past.toFixed(3)}% → ${fr.toFixed(3)}%`)
      }
    }
  }

  // OI deleveraging: drop in OI from 24h ago
  let oiScore = 40
  if (m.oiUsdSeries.length >= 24) {
    const last = m.oiUsdSeries[m.oiUsdSeries.length - 1]
    const a = m.oiUsdSeries[m.oiUsdSeries.length - 24]
    if (a > 0 && Number.isFinite(last)) {
      const pct = ((last - a) / a) * 100
      if (pct <= -12) oiScore = 100
      else if (pct <= -8) oiScore = 85
      else if (pct <= -5) oiScore = 70
      else if (pct <= -2) oiScore = 55
      else if (pct <= 2) oiScore = 40
      else if (pct <= 8) oiScore = 25
      else oiScore = 10
      lines.push(`OI 24-period change ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% · large negative = forced flush`)
    }
  } else {
    lines.push("OI series insufficient for flush detection")
  }

  const blended = 0.6 * fundingScore + 0.4 * oiScore
  return {
    id: "leverageFlush",
    labelZh: "杠杆出清",
    labelEn: "Leverage Flush",
    score: clamp(blended, 0, 100),
    weight: BLACK_SWAN_WEIGHTS.leverageFlush,
    weighted: clamp(blended, 0, 100) * BLACK_SWAN_WEIGHTS.leverageFlush,
    lines,
  }
}

function scoreDrawdownMagnitude(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  const candles = m.candles
  if (candles.length < 30) {
    lines.push("Not enough history for drawdown read")
    return {
      id: "drawdownMagnitude",
      labelZh: "回撤幅度",
      labelEn: "Drawdown",
      score: 30,
      weight: BLACK_SWAN_WEIGHTS.drawdownMagnitude,
      weighted: 30 * BLACK_SWAN_WEIGHTS.drawdownMagnitude,
      lines,
    }
  }
  const window = candles.slice(-90)
  let hi = 0
  for (const c of window) if (c.high > hi) hi = c.high
  const last = window[window.length - 1].close
  const dd = hi > 0 ? ((last - hi) / hi) * 100 : 0
  lines.push(`Close ${dd.toFixed(1)}% from 90d high $${hi.toFixed(0)}`)

  // Score: 0% drawdown → 0, -45% → 100
  const score = linInv100(dd, -50, -5)
  return {
    id: "drawdownMagnitude",
    labelZh: "回撤幅度",
    labelEn: "Drawdown",
    score,
    weight: BLACK_SWAN_WEIGHTS.drawdownMagnitude,
    weighted: score * BLACK_SWAN_WEIGHTS.drawdownMagnitude,
    lines,
  }
}

function scoreMeanReversion(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  const candles = m.candles
  if (candles.length < 30) {
    return {
      id: "meanReversion",
      labelZh: "均值回归",
      labelEn: "Mean Reversion",
      score: 30,
      weight: BLACK_SWAN_WEIGHTS.meanReversion,
      weighted: 30 * BLACK_SWAN_WEIGHTS.meanReversion,
      lines: ["Not enough history"],
    }
  }
  // 7-period return z-score (vs 60-period distribution of 7-period returns)
  const closes = candles.map((c) => c.close)
  const win = 7
  const returns: number[] = []
  for (let i = win; i < closes.length; i += 1) {
    const a = closes[i - win]
    const b = closes[i]
    if (a > 0) returns.push((b - a) / a)
  }
  const tail = returns.slice(-90)
  const { mean, std } = meanStd(tail)
  const lastRet = returns[returns.length - 1] ?? 0
  const z = std > 0 ? (lastRet - mean) / std : 0
  lines.push(`7-period return z=${z.toFixed(2)} (negative = oversold)`)

  // 20-SMA gap percent
  const sma20Window = closes.slice(-20)
  const sma20 = sma20Window.reduce((s, v) => s + v, 0) / sma20Window.length
  const gap = sma20 > 0 ? ((closes[closes.length - 1] - sma20) / sma20) * 100 : 0
  lines.push(`Close vs SMA20 gap ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%`)

  // Score: deeply negative z + deeply negative gap = high
  const zScore = linInv100(z, -3.5, 0.5)
  const gapScore = linInv100(gap, -18, 4)
  const score = clamp(0.55 * zScore + 0.45 * gapScore, 0, 100)
  return {
    id: "meanReversion",
    labelZh: "均值回归",
    labelEn: "Mean Reversion",
    score,
    weight: BLACK_SWAN_WEIGHTS.meanReversion,
    weighted: score * BLACK_SWAN_WEIGHTS.meanReversion,
    lines,
  }
}

function scoreMacroRiskOff(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  const vix = m.vixValue
  if (vix === null || !Number.isFinite(vix)) {
    lines.push("VIX unavailable · neutral baseline")
    return {
      id: "macroRiskOff",
      labelZh: "宏观避险",
      labelEn: "Macro Risk-Off",
      score: 35,
      weight: BLACK_SWAN_WEIGHTS.macroRiskOff,
      weighted: 35 * BLACK_SWAN_WEIGHTS.macroRiskOff,
      lines,
    }
  }
  let score: number
  if (vix >= 55) score = 100
  else if (vix >= 40) score = 85
  else if (vix >= 30) score = 65
  else if (vix >= 22) score = 45
  else if (vix >= 16) score = 25
  else score = 10
  lines.push(`VIX ${vix.toFixed(1)} · spike = panic across risk assets`)

  // Bonus if VIX up sharply over last 5 prints
  const recent = m.vixRecent ?? []
  if (recent.length >= 5) {
    const past = recent[recent.length - 5]
    if (Number.isFinite(past) && past > 0) {
      const ch = ((vix - past) / past) * 100
      if (ch >= 40) {
        score = Math.min(100, score + 8)
        lines.push(`VIX +${ch.toFixed(0)}% over 5 prints · macro stress spike`)
      }
    }
  }
  return {
    id: "macroRiskOff",
    labelZh: "宏观避险",
    labelEn: "Macro Risk-Off",
    score,
    weight: BLACK_SWAN_WEIGHTS.macroRiskOff,
    weighted: score * BLACK_SWAN_WEIGHTS.macroRiskOff,
    lines,
  }
}

function scoreVolumeClimax(m: BlackSwanMetrics): BlackSwanFactor {
  const lines: string[] = []
  const candles = m.candles
  if (candles.length < 30) {
    return {
      id: "volumeClimax",
      labelZh: "成交量高潮",
      labelEn: "Volume Climax",
      score: 30,
      weight: BLACK_SWAN_WEIGHTS.volumeClimax,
      weighted: 30 * BLACK_SWAN_WEIGHTS.volumeClimax,
      lines: ["Not enough history"],
    }
  }
  const last = candles[candles.length - 1]
  const window = candles.slice(-31, -1).map((c) => c.volume)
  const { mean, std } = meanStd(window)
  const z = std > 0 ? (last.volume - mean) / std : 0
  lines.push(`Last candle volume z=${z.toFixed(2)} vs 30-candle baseline`)

  let score: number
  if (z >= 3.5) score = 100
  else if (z >= 2.5) score = 85
  else if (z >= 1.5) score = 65
  else if (z >= 0.75) score = 45
  else score = clamp(linTo100(z, -1, 0.75) * 0.45, 0, 45)
  return {
    id: "volumeClimax",
    labelZh: "成交量高潮",
    labelEn: "Volume Climax",
    score,
    weight: BLACK_SWAN_WEIGHTS.volumeClimax,
    weighted: score * BLACK_SWAN_WEIGHTS.volumeClimax,
    lines,
  }
}

// ─── wick event extraction ────────────────────────────────────────────────

export function extractRecentWicks(candles: BlackSwanCandle[], lookback = 60): BlackSwanWickEvent[] {
  if (candles.length < 30) return []
  const tail = candles.slice(-Math.max(lookback, 30))
  const ratios = candles.slice(-90).map(lowerWickRatio)
  const { mean, std } = meanStd(ratios)
  const volWindow = candles.slice(-60).map((c) => c.volume)
  const volStat = meanStd(volWindow)
  const events: BlackSwanWickEvent[] = []
  for (let i = 0; i < tail.length; i += 1) {
    const c = tail[i]
    const lwr = lowerWickRatio(c)
    const z = std > 0 ? (lwr - mean) / std : 0
    if (z < 1.3 && lwr < 0.5) continue
    const vz = volStat.std > 0 ? (c.volume - volStat.mean) / volStat.std : 0
    let rebound: number | null = null
    const idx = candles.indexOf(c)
    if (idx >= 0 && idx + 1 < candles.length) {
      const next = candles[idx + 1]
      if (c.close > 0) rebound = ((next.close - c.close) / c.close) * 100
    }
    events.push({
      time: c.time,
      lowerWickRatio: lwr,
      wickUsd: lowerWickUsd(c),
      closeUsd: c.close,
      volumeZ: vz,
      rebound24hPct: rebound,
    })
  }
  // newest first, top 8
  return events.sort((a, b) => b.time - a.time).slice(0, 8)
}

// ─── active signal extraction ─────────────────────────────────────────────

function deriveActiveSignals(m: BlackSwanMetrics, factors: BlackSwanFactor[]): BlackSwanActiveSignal[] {
  const out: BlackSwanActiveSignal[] = []
  const candles = m.candles
  const last = candles[candles.length - 1]
  if (last) {
    const lwr = lowerWickRatio(last)
    if (lwr >= 0.55) {
      out.push({
        code: "WICK_EXTREME",
        severity: "alert",
        labelZh: `极端下插针 · 下影线占比 ${(lwr * 100).toFixed(0)}%`,
        labelEn: `Extreme lower wick · ${(lwr * 100).toFixed(0)}% of range`,
      })
    }
  }

  if (m.fearGreedValue !== null && m.fearGreedValue < 20) {
    out.push({
      code: "FNG_CAPITULATION",
      severity: "alert",
      labelZh: `恐慌投降 · F&G ${m.fearGreedValue.toFixed(0)}`,
      labelEn: `Fear capitulation · F&G ${m.fearGreedValue.toFixed(0)}`,
    })
  }

  if (m.fundingRatePct !== null && m.fundingRatePct <= -0.01) {
    out.push({
      code: "FUNDING_NEGATIVE",
      severity: "warn",
      labelZh: `资金费率转负 ${m.fundingRatePct.toFixed(3)}%`,
      labelEn: `Funding flipped negative ${m.fundingRatePct.toFixed(3)}%`,
    })
  }

  if (m.oiUsdSeries.length >= 24) {
    const a = m.oiUsdSeries[m.oiUsdSeries.length - 24]
    const b = m.oiUsdSeries[m.oiUsdSeries.length - 1]
    if (a > 0 && Number.isFinite(b)) {
      const pct = ((b - a) / a) * 100
      if (pct <= -8) {
        out.push({
          code: "LIQUIDATION_FLUSH",
          severity: "alert",
          labelZh: `OI 24 期下降 ${pct.toFixed(1)}% · 杠杆强平`,
          labelEn: `OI down ${pct.toFixed(1)}% in 24 prints · forced flush`,
        })
      }
    }
  }

  if (m.vixValue !== null && m.vixValue >= 35) {
    out.push({
      code: "VIX_SPIKE",
      severity: "warn",
      labelZh: `VIX 飙升 ${m.vixValue.toFixed(1)} · 宏观避险`,
      labelEn: `VIX spike ${m.vixValue.toFixed(1)} · macro risk-off`,
    })
  }

  const drawdownFactor = factors.find((f) => f.id === "drawdownMagnitude")
  if (drawdownFactor && drawdownFactor.score >= 75) {
    out.push({
      code: "DRAWDOWN_EXTREME",
      severity: "warn",
      labelZh: `回撤逼近历史区间`,
      labelEn: `Drawdown near cycle floor`,
    })
  }

  const volFactor = factors.find((f) => f.id === "volumeClimax")
  if (volFactor && volFactor.score >= 80) {
    out.push({
      code: "VOLUME_CLIMAX",
      severity: "warn",
      labelZh: `成交量异常放大 · 抛售高潮`,
      labelEn: `Volume climax · capitulation print`,
    })
  }

  return out
}

// ─── main entry ───────────────────────────────────────────────────────────

export function computeBlackSwanOpportunity(m: BlackSwanMetrics): BlackSwanComputation {
  const factors: BlackSwanFactor[] = [
    scoreWickCapitulation(m),
    scoreFearExtreme(m),
    scoreLeverageFlush(m),
    scoreDrawdownMagnitude(m),
    scoreMeanReversion(m),
    scoreMacroRiskOff(m),
    scoreVolumeClimax(m),
  ]

  let total = factors.reduce((s, f) => s + f.weighted, 0)

  // Confluence boost: when ≥3 alert-tier signals stack, regime is rare
  const active = deriveActiveSignals(m, factors)
  const alertCount = active.filter((s) => s.severity === "alert").length
  if (alertCount >= 3) total += 6
  if (alertCount >= 4) total += 4
  total = clamp(total, 0, 100)

  const { band, zh, en } = bandFromScore(total)
  const recentWicks = extractRecentWicks(m.candles, 60)

  return {
    opportunityScore: total,
    signalBand: band,
    signalLabelZh: zh,
    signalLabelEn: en,
    factors,
    activeSignals: active,
    recentWicks,
  }
}
