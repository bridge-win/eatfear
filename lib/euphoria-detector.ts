/**
 * Euphoria / Distribution Detector — the short-side mirror of black-swan-detector.
 *
 * Identifies blow-off-top and distribution setups during vertical run-ups,
 * extreme greed, and crowded-long leverage by combining 9 weighted factors:
 * upper-wick blow-off, Greed extreme, funding froth + OI ballooning, run-up from
 * 90d low, overbought mean-reversion gap, VIX complacency, buying-volume climax,
 * Mayer Multiple (>2.4 overbought), and Puell Multiple (>4 overheated).
 *
 * Reuses the black-swan `BlackSwanMetrics` input verbatim — same upstreams — so a
 * caller can score both directions from one fetch. Pure function, no I/O.
 *
 * Read honestly: overbought can stay overbought far longer than oversold stays
 * oversold. A high euphoria score flags distribution *risk* and a place to trim or
 * hedge, not a precise top. Shorting strong uptrends is the fastest way to lose.
 */

import type { BlackSwanCandle, BlackSwanMetrics } from "@/lib/black-swan-detector"

export const EUPHORIA_WEIGHTS = {
  wickBlowoff: 0.20,
  greedExtreme: 0.18,
  leverageFroth: 0.15,
  runupMagnitude: 0.12,
  macroComplacency: 0.10,
  meanReversionHigh: 0.08,
  mayerMultiple: 0.07,
  volumeClimax: 0.05,
  puellMultiple: 0.05,
} as const

export type EuphoriaFactorId = keyof typeof EUPHORIA_WEIGHTS

export type EuphoriaBand =
  | "no_signal"
  | "watch"
  | "building"
  | "strong"
  | "blow_off_top"

export type EuphoriaDirection = "short" | "take_profit" | "neutral"

export interface EuphoriaFactor {
  id: EuphoriaFactorId
  labelZh: string
  labelEn: string
  /** Factor sub-score 0–100 (higher = more euphoric / overbought). */
  score: number
  weight: number
  weighted: number
  lines: string[]
}

export interface EuphoriaActiveSignal {
  code: string
  severity: "info" | "warn" | "alert"
  labelZh: string
  labelEn: string
}

export interface EuphoriaBlowoffEvent {
  time: number
  /** upperWick / candle range (0–1). */
  upperWickRatio: number
  wickUsd: number
  closeUsd: number
  /** Volume Z-score vs 30-candle mean. */
  volumeZ: number
  /** Forward 24h return after the candle close, if known (negative = rejection worked). */
  fade24hPct: number | null
}

export interface EuphoriaComputation {
  euphoriaScore: number
  signalBand: EuphoriaBand
  direction: EuphoriaDirection
  signalLabelZh: string
  signalLabelEn: string
  factors: EuphoriaFactor[]
  activeSignals: EuphoriaActiveSignal[]
  recentBlowoffs: EuphoriaBlowoffEvent[]
}

// ─── helpers (local copies — kept decoupled from black-swan internals) ──────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const linTo100 = (x: number, lo: number, hi: number) => {
  if (hi === lo) return 50
  return clamp(((x - lo) / (hi - lo)) * 100, 0, 100)
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const m = values.reduce((s, v) => s + v, 0) / values.length
  if (values.length < 2) return { mean: m, std: 0 }
  const variance = values.reduce((s, v) => s + (v - m) * (v - m), 0) / (values.length - 1)
  return { mean: m, std: Math.sqrt(variance) }
}

function upperWickRatio(c: BlackSwanCandle): number {
  const range = Math.max(c.high - c.low, Number.EPSILON)
  return clamp((c.high - Math.max(c.open, c.close)) / range, 0, 1)
}

function upperWickUsd(c: BlackSwanCandle): number {
  return Math.max(0, c.high - Math.max(c.open, c.close))
}

function makeFactor(
  id: EuphoriaFactorId,
  labelZh: string,
  labelEn: string,
  score: number,
  lines: string[],
): EuphoriaFactor {
  const s = clamp(score, 0, 100)
  return { id, labelZh, labelEn, score: s, weight: EUPHORIA_WEIGHTS[id], weighted: s * EUPHORIA_WEIGHTS[id], lines }
}

function bandFromScore(total: number): { band: EuphoriaBand; direction: EuphoriaDirection; zh: string; en: string } {
  if (total >= 85)
    return { band: "blow_off_top", direction: "short", zh: "吹顶派发极端区 · 一轮级别顶部风险", en: "Blow-off top · once-a-cycle distribution risk" }
  if (total >= 70)
    return { band: "strong", direction: "short", zh: "强派发信号 · 过热 + 杠杆拥挤", en: "Strong distribution · overheated + crowded longs" }
  if (total >= 50)
    return { band: "building", direction: "take_profit", zh: "亢奋成型中 · 建议减仓 / 收紧止盈", en: "Building froth · trim / tighten take-profit" }
  if (total >= 30)
    return { band: "watch", direction: "take_profit", zh: "观察 · 部分过热因子触发", en: "Watch · partial overbought extremes" }
  return { band: "no_signal", direction: "neutral", zh: "暂无派发信号 · 中性或恐慌", en: "No distribution signal · neutral or fearful" }
}

// ─── factor scorers ─────────────────────────────────────────────────────────

function scoreWickBlowoff(m: BlackSwanMetrics): EuphoriaFactor {
  const candles = m.candles
  if (candles.length < 14) {
    return makeFactor("wickBlowoff", "吹顶插针", "Blow-off Wick", 25, ["Insufficient candles for wick analysis"])
  }
  const last = candles[candles.length - 1]
  const uwr = upperWickRatio(last)
  const wickUsd = upperWickUsd(last)

  const window = candles.slice(-60).map(upperWickRatio)
  const { mean, std } = meanStd(window)
  const z = std > 0 ? (uwr - mean) / std : 0

  let score: number
  if (z >= 3) score = 100
  else if (z >= 2) score = 85
  else if (z >= 1.5) score = 65
  else if (z >= 1) score = 45
  else if (z >= 0.5) score = 30
  else score = linTo100(uwr, 0, 0.6) * 0.4
  if (uwr >= 0.55) score = Math.min(100, score + 8)

  return makeFactor("wickBlowoff", "吹顶插针", "Blow-off Wick", score, [
    `Last candle upper-wick ratio ${(uwr * 100).toFixed(1)}% (z=${z.toFixed(2)}) · wick ${wickUsd >= 1000 ? `$${(wickUsd / 1000).toFixed(2)}K` : `$${wickUsd.toFixed(0)}`}`,
    `60-candle baseline · mean ratio ${(mean * 100).toFixed(1)}% · σ ${(std * 100).toFixed(1)}% · large upper wick = rejection at highs`,
  ])
}

function scoreGreedExtreme(m: BlackSwanMetrics): EuphoriaFactor {
  const lines: string[] = []
  let score = 25
  const v = m.fearGreedValue
  if (v === null || !Number.isFinite(v)) {
    lines.push("Fear & Greed unavailable")
  } else {
    if (v > 90) score = 100
    else if (v > 85) score = 92
    else if (v > 80) score = 82
    else if (v > 75) score = 72
    else if (v > 65) score = 55
    else if (v > 50) score = 35
    else if (v > 35) score = 18
    else score = 5
    lines.push(`Fear & Greed ${v.toFixed(0)} (higher = greed / euphoria ceiling zone)`)

    const recent = m.fearGreedRecent ?? []
    if (recent.length >= 7) {
      const a = recent[recent.length - 7]
      const rise = v - a
      if (Number.isFinite(rise) && rise >= 15) {
        score = Math.min(100, score + 10)
        lines.push(`F&G rose ${rise.toFixed(0)}pts over 7 prints · greed acceleration`)
      }
    }
  }
  return makeFactor("greedExtreme", "极度贪婪", "Greed Extreme", score, lines)
}

function scoreLeverageFroth(m: BlackSwanMetrics): EuphoriaFactor {
  const lines: string[] = []
  let fundingScore = 30
  const fr = m.fundingRatePct
  if (fr === null || !Number.isFinite(fr)) {
    lines.push("Funding rate unavailable")
  } else {
    if (fr >= 0.15) fundingScore = 100
    else if (fr >= 0.1) fundingScore = 90
    else if (fr >= 0.05) fundingScore = 75
    else if (fr >= 0.02) fundingScore = 55
    else if (fr >= 0) fundingScore = 35
    else if (fr >= -0.02) fundingScore = 20
    else fundingScore = 8
    lines.push(`Funding ${fr.toFixed(3)}%/period · high positive = longs paying to stay in`)

    const recent = m.fundingRecentPct ?? []
    if (recent.length >= 6 && fr >= 0.05) {
      const past = recent[recent.length - 6]
      if (Number.isFinite(past) && past < 0.01) {
        fundingScore = Math.min(100, fundingScore + 8)
        lines.push(`Funding ramped from ${past.toFixed(3)}% → +${fr.toFixed(3)}% · longs piling in`)
      }
    }
  }

  // OI ballooning: rising OI into a rally = fresh leverage stacking up
  let oiScore = 40
  if (m.oiUsdSeries.length >= 24) {
    const last = m.oiUsdSeries[m.oiUsdSeries.length - 1]
    const a = m.oiUsdSeries[m.oiUsdSeries.length - 24]
    if (a > 0 && Number.isFinite(last)) {
      const pct = ((last - a) / a) * 100
      if (pct >= 15) oiScore = 100
      else if (pct >= 10) oiScore = 85
      else if (pct >= 6) oiScore = 70
      else if (pct >= 2) oiScore = 52
      else if (pct >= -2) oiScore = 38
      else oiScore = 20
      lines.push(`OI 24-period change ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% · large positive = leverage stacking`)
    }
  } else {
    lines.push("OI series insufficient for froth detection")
  }

  const blended = 0.6 * fundingScore + 0.4 * oiScore
  return makeFactor("leverageFroth", "杠杆过热", "Leverage Froth", blended, lines)
}

function scoreRunupMagnitude(m: BlackSwanMetrics): EuphoriaFactor {
  const candles = m.candles
  if (candles.length < 30) {
    return makeFactor("runupMagnitude", "涨幅拉伸", "Run-up Extension", 25, ["Not enough history for run-up read"])
  }
  const window = candles.slice(-90)
  let lo = Infinity
  let hi = 0
  for (const c of window) {
    if (c.low < lo) lo = c.low
    if (c.high > hi) hi = c.high
  }
  const last = window[window.length - 1].close
  const runup = lo > 0 && Number.isFinite(lo) ? ((last - lo) / lo) * 100 : 0
  const belowHigh = hi > 0 ? ((hi - last) / hi) * 100 : 0

  const runupScore = linTo100(runup, 15, 150)
  // Near the 90d high adds topping risk; deep pullback from high cools it.
  const proximityScore = linTo100(-belowHigh, -12, 0)
  const score = clamp(0.7 * runupScore + 0.3 * proximityScore, 0, 100)

  return makeFactor("runupMagnitude", "涨幅拉伸", "Run-up Extension", score, [
    `Close +${runup.toFixed(1)}% from 90d low $${lo.toFixed(0)} · ${belowHigh.toFixed(1)}% below 90d high $${hi.toFixed(0)}`,
  ])
}

function scoreMacroComplacency(m: BlackSwanMetrics): EuphoriaFactor {
  const vix = m.vixValue
  if (vix === null || !Number.isFinite(vix)) {
    return makeFactor("macroComplacency", "宏观自满", "Macro Complacency", 30, ["VIX unavailable · neutral baseline"])
  }
  let score: number
  if (vix <= 12) score = 100
  else if (vix <= 13) score = 85
  else if (vix <= 14) score = 70
  else if (vix <= 16) score = 50
  else if (vix <= 20) score = 30
  else if (vix <= 26) score = 15
  else score = 5
  return makeFactor("macroComplacency", "宏观自满", "Macro Complacency", score, [
    `VIX ${vix.toFixed(1)} · low = complacency (weak standalone signal; low vol can persist for months)`,
  ])
}

function scoreMeanReversionHigh(m: BlackSwanMetrics): EuphoriaFactor {
  const candles = m.candles
  if (candles.length < 30) {
    return makeFactor("meanReversionHigh", "超买回归", "Overbought Stretch", 25, ["Not enough history"])
  }
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

  const sma20Window = closes.slice(-20)
  const sma20 = sma20Window.reduce((s, v) => s + v, 0) / sma20Window.length
  const gap = sma20 > 0 ? ((closes[closes.length - 1] - sma20) / sma20) * 100 : 0

  const zScore = linTo100(z, -0.5, 3.5)
  const gapScore = linTo100(gap, -4, 18)
  const score = clamp(0.55 * zScore + 0.45 * gapScore, 0, 100)

  return makeFactor("meanReversionHigh", "超买回归", "Overbought Stretch", score, [
    `7-period return z=${z.toFixed(2)} (positive = overbought)`,
    `Close vs SMA20 gap ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%`,
  ])
}

function scoreMayerMultiple(m: BlackSwanMetrics): EuphoriaFactor {
  const candles = m.candles
  if (candles.length < 60) {
    return makeFactor("mayerMultiple", "Mayer 倍数", "Mayer Multiple", 30, ["Insufficient candles for Mayer Multiple"])
  }
  const closes = candles.map((c) => c.close)
  const currentClose = closes[closes.length - 1]
  const smaLen = Math.min(closes.length, 200)
  const sma200 = closes.slice(-smaLen).reduce((s, v) => s + v, 0) / smaLen
  const mayer = sma200 > 0 ? currentClose / sma200 : null
  if (!mayer || !Number.isFinite(mayer)) {
    return makeFactor("mayerMultiple", "Mayer 倍数", "Mayer Multiple", 30, ["Mayer Multiple calculation failed"])
  }
  const smaLabel = smaLen >= 200 ? "SMA200" : `SMA${smaLen}`
  const lines = [`Mayer ${mayer.toFixed(3)}× · Close $${currentClose.toFixed(0)} / ${smaLabel} $${sma200.toFixed(0)}`]

  let score: number
  if (mayer >= 2.8) { score = 100; lines.push("Extreme overvaluation · classic cycle-top territory (Mayer > 2.4 rule)") }
  else if (mayer >= 2.4) { score = 88; lines.push("Historic overbought · Mayer > 2.4 canonical sell zone") }
  else if (mayer >= 1.8) { score = 62; lines.push("Elevated · extended above 200d MA") }
  else if (mayer >= 1.2) { score = 32; lines.push("Fair-to-rich value territory") }
  else if (mayer >= 0.8) { score = 12; lines.push("At/below 200d MA · not overbought") }
  else { score = 3; lines.push("Deep discount · opposite of euphoria") }

  return makeFactor("mayerMultiple", "Mayer 倍数", "Mayer Multiple", score, lines)
}

function scoreVolumeClimax(m: BlackSwanMetrics): EuphoriaFactor {
  const candles = m.candles
  if (candles.length < 30) {
    return makeFactor("volumeClimax", "买盘高潮", "Buying Climax", 25, ["Not enough history"])
  }
  const last = candles[candles.length - 1]
  const window = candles.slice(-31, -1).map((c) => c.volume)
  const { mean, std } = meanStd(window)
  const z = std > 0 ? (last.volume - mean) / std : 0
  // Volume climax counts toward euphoria only when price is rising into it.
  const rising = last.close >= last.open

  let score: number
  if (z >= 3.5) score = 100
  else if (z >= 2.5) score = 85
  else if (z >= 1.5) score = 65
  else if (z >= 0.75) score = 45
  else score = clamp(linTo100(z, -1, 0.75) * 0.45, 0, 45)
  if (!rising) score *= 0.6

  return makeFactor("volumeClimax", "买盘高潮", "Buying Climax", score, [
    `Last candle volume z=${z.toFixed(2)} vs 30-candle baseline · ${rising ? "up-candle (buying climax)" : "down-candle (discounted)"}`,
  ])
}

function scorePuellMultiple(m: BlackSwanMetrics): EuphoriaFactor {
  const rev = m.minerRevenueSeries ?? []
  if (rev.length < 30) {
    return makeFactor("puellMultiple", "Puell 倍数", "Puell Multiple", 30, ["Insufficient miner revenue history for Puell Multiple"])
  }
  const current = rev[rev.length - 1]
  const maLen = Math.min(rev.length, 365)
  const ma365 = rev.slice(-maLen).reduce((s, v) => s + v, 0) / maLen
  const puell = ma365 > 0 ? current / ma365 : null
  if (!puell || !Number.isFinite(puell)) {
    return makeFactor("puellMultiple", "Puell 倍数", "Puell Multiple", 30, ["Puell Multiple calculation failed"])
  }
  const lines = [`Puell ${puell.toFixed(3)} · daily $${(current / 1e6).toFixed(1)}M / ${maLen}d avg $${(ma365 / 1e6).toFixed(1)}M`]

  let score: number
  if (puell >= 4.0) { score = 100; lines.push("Extreme miner-revenue overheating · historic cycle-top signal") }
  else if (puell >= 2.5) { score = 82; lines.push("Overheated miner revenue · distribution zone") }
  else if (puell >= 1.5) { score = 55; lines.push("Above-average miner revenue · elevated") }
  else if (puell >= 1.0) { score = 30; lines.push("Around average") }
  else { score = 8; lines.push("Below-average miner revenue · not overheated") }

  return makeFactor("puellMultiple", "Puell 倍数", "Puell Multiple", score, lines)
}

// ─── blow-off event extraction (mirror of extractRecentWicks) ───────────────

export function extractRecentBlowoffs(candles: BlackSwanCandle[], lookback = 60): EuphoriaBlowoffEvent[] {
  if (candles.length < 30) return []
  const tail = candles.slice(-Math.max(lookback, 30))
  const ratios = candles.slice(-90).map(upperWickRatio)
  const { mean, std } = meanStd(ratios)
  const volWindow = candles.slice(-60).map((c) => c.volume)
  const volStat = meanStd(volWindow)
  const events: EuphoriaBlowoffEvent[] = []
  for (const c of tail) {
    const uwr = upperWickRatio(c)
    const z = std > 0 ? (uwr - mean) / std : 0
    if (z < 1.3 && uwr < 0.5) continue
    const vz = volStat.std > 0 ? (c.volume - volStat.mean) / volStat.std : 0
    let fade: number | null = null
    const idx = candles.indexOf(c)
    if (idx >= 0 && idx + 1 < candles.length) {
      const next = candles[idx + 1]
      if (c.close > 0) fade = ((next.close - c.close) / c.close) * 100
    }
    events.push({ time: c.time, upperWickRatio: uwr, wickUsd: upperWickUsd(c), closeUsd: c.close, volumeZ: vz, fade24hPct: fade })
  }
  return events.sort((a, b) => b.time - a.time).slice(0, 8)
}

// ─── active signal extraction ───────────────────────────────────────────────

function deriveActiveSignals(m: BlackSwanMetrics, factors: EuphoriaFactor[]): EuphoriaActiveSignal[] {
  const out: EuphoriaActiveSignal[] = []
  const last = m.candles[m.candles.length - 1]
  if (last) {
    const uwr = upperWickRatio(last)
    if (uwr >= 0.55) {
      out.push({
        code: "UPPER_WICK_EXTREME",
        severity: "alert",
        labelZh: `极端上插针 · 上影线占比 ${(uwr * 100).toFixed(0)}%`,
        labelEn: `Extreme upper wick · ${(uwr * 100).toFixed(0)}% of range`,
      })
    }
  }
  if (m.fearGreedValue !== null && m.fearGreedValue > 80) {
    out.push({
      code: "FNG_EUPHORIA",
      severity: "alert",
      labelZh: `极度贪婪 · F&G ${m.fearGreedValue.toFixed(0)}`,
      labelEn: `Extreme greed · F&G ${m.fearGreedValue.toFixed(0)}`,
    })
  }
  if (m.fundingRatePct !== null && m.fundingRatePct >= 0.05) {
    out.push({
      code: "FUNDING_FROTH",
      severity: "warn",
      labelZh: `资金费率过热 +${m.fundingRatePct.toFixed(3)}%`,
      labelEn: `Funding froth +${m.fundingRatePct.toFixed(3)}%`,
    })
  }
  if (m.oiUsdSeries.length >= 24) {
    const a = m.oiUsdSeries[m.oiUsdSeries.length - 24]
    const b = m.oiUsdSeries[m.oiUsdSeries.length - 1]
    if (a > 0 && Number.isFinite(b)) {
      const pct = ((b - a) / a) * 100
      if (pct >= 10) {
        out.push({
          code: "OI_BALLOON",
          severity: "warn",
          labelZh: `OI 24 期上升 ${pct.toFixed(1)}% · 杠杆堆积`,
          labelEn: `OI up ${pct.toFixed(1)}% in 24 prints · leverage stacking`,
        })
      }
    }
  }
  if (m.vixValue !== null && m.vixValue <= 13) {
    out.push({
      code: "VIX_COMPLACENCY",
      severity: "info",
      labelZh: `VIX 低位 ${m.vixValue.toFixed(1)} · 宏观自满`,
      labelEn: `VIX low ${m.vixValue.toFixed(1)} · macro complacency`,
    })
  }
  const runup = factors.find((f) => f.id === "runupMagnitude")
  if (runup && runup.score >= 75) {
    out.push({ code: "RUNUP_EXTREME", severity: "warn", labelZh: `涨幅高度拉伸 · 逼近顶部区间`, labelEn: `Run-up highly extended · near topping zone` })
  }
  const mayer = factors.find((f) => f.id === "mayerMultiple")
  if (mayer && mayer.score >= 80) {
    out.push({ code: "MAYER_OVERBOUGHT", severity: "warn", labelZh: `Mayer 倍数 > 2.4 · 历史超买区`, labelEn: `Mayer Multiple > 2.4 · historic overbought` })
  }
  const puell = factors.find((f) => f.id === "puellMultiple")
  if (puell && puell.score >= 80) {
    out.push({ code: "PUELL_OVERHEATED", severity: "warn", labelZh: `Puell 倍数 > 4 · 矿工收入过热`, labelEn: `Puell Multiple > 4 · miner revenue overheated` })
  }
  const vol = factors.find((f) => f.id === "volumeClimax")
  if (vol && vol.score >= 80) {
    out.push({ code: "BUYING_CLIMAX", severity: "info", labelZh: `买盘量能高潮 · 追高情绪`, labelEn: `Buying-volume climax · chase euphoria` })
  }
  return out
}

// ─── main entry ─────────────────────────────────────────────────────────────

export function computeEuphoriaRisk(m: BlackSwanMetrics): EuphoriaComputation {
  const factors: EuphoriaFactor[] = [
    scoreWickBlowoff(m),
    scoreGreedExtreme(m),
    scoreLeverageFroth(m),
    scoreRunupMagnitude(m),
    scoreMacroComplacency(m),
    scoreMeanReversionHigh(m),
    scoreMayerMultiple(m),
    scoreVolumeClimax(m),
    scorePuellMultiple(m),
  ]

  let total = factors.reduce((s, f) => s + f.weighted, 0)

  const active = deriveActiveSignals(m, factors)
  const alertCount = active.filter((s) => s.severity === "alert").length
  if (alertCount >= 3) total += 6
  if (alertCount >= 4) total += 4
  total = clamp(total, 0, 100)

  const { band, direction, zh, en } = bandFromScore(total)

  return {
    euphoriaScore: total,
    signalBand: band,
    direction,
    signalLabelZh: zh,
    signalLabelEn: en,
    factors,
    activeSignals: active,
    recentBlowoffs: extractRecentBlowoffs(m.candles, 60),
  }
}
