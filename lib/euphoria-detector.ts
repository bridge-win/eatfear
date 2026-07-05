export const EUPHORIA_WEIGHTS = {
  upperWickExhaustion: 0.18,
  greedExtreme: 0.17,
  leverageCrowding: 0.16,
  rallyExtension: 0.14,
  meanReversionOverheat: 0.11,
  macroComplacency: 0.08,
  volumeClimax: 0.06,
  mayerMultiple: 0.06,
  puellMultiple: 0.04,
} as const

export type EuphoriaFactorId = keyof typeof EUPHORIA_WEIGHTS

export type EuphoriaBand =
  | "no_euphoria"
  | "watch"
  | "building"
  | "take_profit"
  | "short_setup"

export interface EuphoriaCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface EuphoriaMetrics {
  candles: EuphoriaCandle[]
  fearGreedValue: number | null
  fearGreedRecent: number[]
  fundingRatePct: number | null
  fundingRecentPct: number[]
  oiUsdSeries: number[]
  vixValue: number | null
  vixRecent: number[]
  minerRevenueSeries?: number[]
}

export interface EuphoriaFactor {
  id: EuphoriaFactorId
  labelZh: string
  labelEn: string
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

export interface EuphoriaWickEvent {
  time: number
  upperWickRatio: number
  wickUsd: number
  closeUsd: number
  volumeZ: number
  forward24hPct: number | null
}

export interface EuphoriaComputation {
  euphoriaScore: number
  signalBand: EuphoriaBand
  signalLabelZh: string
  signalLabelEn: string
  factors: EuphoriaFactor[]
  activeSignals: EuphoriaActiveSignal[]
  recentWicks: EuphoriaWickEvent[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function linTo100(value: number, low: number, high: number): number {
  if (high === low) return 50
  return clamp(((value - low) / (high - low)) * 100, 0, 100)
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (values.length < 2) return { mean, std: 0 }
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  return { mean, std: Math.sqrt(variance) }
}

function upperWickRatio(candle: EuphoriaCandle): number {
  const range = Math.max(candle.high - candle.low, Number.EPSILON)
  return clamp((candle.high - Math.max(candle.open, candle.close)) / range, 0, 1)
}

function upperWickUsd(candle: EuphoriaCandle): number {
  return Math.max(0, candle.high - Math.max(candle.open, candle.close))
}

function bandFromScore(score: number): { band: EuphoriaBand; zh: string; en: string } {
  if (score >= 82) return { band: "short_setup", zh: "高亢奋做空观察 · 顶部风险集中", en: "Short watch · clustered top risk" }
  if (score >= 68) return { band: "take_profit", zh: "止盈/降仓信号 · 过热明显", en: "Take-profit zone · clear overheating" }
  if (score >= 52) return { band: "building", zh: "亢奋成型中 · 等确认", en: "Euphoria building · wait for confirmation" }
  if (score >= 34) return { band: "watch", zh: "观察 · 部分过热因子触发", en: "Watch · partial overheating" }
  return { band: "no_euphoria", zh: "暂无顶部亢奋 · 偏中性", en: "No euphoria · neutral" }
}

function factor(id: EuphoriaFactorId, labelZh: string, labelEn: string, score: number, lines: string[]): EuphoriaFactor {
  const cleanScore = clamp(score, 0, 100)
  const weight = EUPHORIA_WEIGHTS[id]
  return {
    id,
    labelZh,
    labelEn,
    score: cleanScore,
    weight,
    weighted: cleanScore * weight,
    lines,
  }
}

function scoreUpperWickExhaustion(metrics: EuphoriaMetrics): EuphoriaFactor {
  const candles = metrics.candles
  if (candles.length < 14) return factor("upperWickExhaustion", "顶部插针", "Upper-Wick Exhaustion", 30, ["Insufficient candles"])

  const last = candles[candles.length - 1]
  const ratio = upperWickRatio(last)
  const wickUsd = upperWickUsd(last)
  const window = candles.slice(-60).map(upperWickRatio)
  const { mean, std } = meanStd(window)
  const z = std > 0 ? (ratio - mean) / std : 0
  let score = linTo100(z, 0.25, 3)
  if (ratio >= 0.55) score = Math.min(100, score + 10)
  return factor("upperWickExhaustion", "顶部插针", "Upper-Wick Exhaustion", score, [
    `Last candle upper-wick ratio ${(ratio * 100).toFixed(1)}% (z=${z.toFixed(2)}) · wick $${wickUsd.toFixed(0)}`,
    `60-candle baseline · mean ${(mean * 100).toFixed(1)}% · sigma ${(std * 100).toFixed(1)}%`,
  ])
}

function scoreGreedExtreme(metrics: EuphoriaMetrics): EuphoriaFactor {
  const value = metrics.fearGreedValue
  if (value === null || !Number.isFinite(value)) return factor("greedExtreme", "极度贪婪", "Greed Extreme", 30, ["Fear & Greed unavailable"])

  let score = linTo100(value, 55, 92)
  const recent = metrics.fearGreedRecent
  const lines = [`Fear & Greed ${value.toFixed(0)} (higher = crowding risk)`]
  if (recent.length >= 7) {
    const past = recent[recent.length - 7]
    const change = value - past
    if (Number.isFinite(change) && change >= 15) {
      score = Math.min(100, score + 8)
      lines.push(`F&G rose ${change.toFixed(0)}pts over 7 prints · euphoria acceleration`)
    }
  }
  return factor("greedExtreme", "极度贪婪", "Greed Extreme", score, lines)
}

function scoreLeverageCrowding(metrics: EuphoriaMetrics): EuphoriaFactor {
  const lines: string[] = []
  const funding = metrics.fundingRatePct
  let fundingScore = 35
  if (funding === null || !Number.isFinite(funding)) {
    lines.push("Funding unavailable")
  } else {
    fundingScore = linTo100(funding, 0.01, 0.16)
    lines.push(`Funding ${funding.toFixed(3)}%/period · high positive = longs paying shorts`)
  }

  let oiScore = 40
  const oi = metrics.oiUsdSeries
  if (oi.length >= 14) {
    const last = oi[oi.length - 1]
    const past = oi[Math.max(0, oi.length - 8)]
    const change = past > 0 ? ((last - past) / past) * 100 : 0
    oiScore = linTo100(change, 0, 18)
    lines.push(`OI 7-print change ${change >= 0 ? "+" : ""}${change.toFixed(2)}% · rising OI confirms crowding`)
  } else {
    lines.push("OI series insufficient")
  }

  return factor("leverageCrowding", "杠杆拥挤", "Leverage Crowding", fundingScore * 0.58 + oiScore * 0.42, lines)
}

function scoreRallyExtension(metrics: EuphoriaMetrics): EuphoriaFactor {
  const candles = metrics.candles
  if (candles.length < 90) return factor("rallyExtension", "上涨延伸", "Rally Extension", 30, ["Not enough history"])

  const window = candles.slice(-90)
  let low = Number.POSITIVE_INFINITY
  for (const candle of window) low = Math.min(low, candle.low)
  const last = window[window.length - 1].close
  const rally = low > 0 ? ((last - low) / low) * 100 : 0
  return factor("rallyExtension", "上涨延伸", "Rally Extension", linTo100(rally, 20, 120), [
    `Close ${rally >= 0 ? "+" : ""}${rally.toFixed(1)}% from 90d low $${low.toFixed(0)}`,
  ])
}

function scoreMeanReversionOverheat(metrics: EuphoriaMetrics): EuphoriaFactor {
  const candles = metrics.candles
  if (candles.length < 30) return factor("meanReversionOverheat", "均值过热", "Mean-Reversion Overheat", 30, ["Not enough history"])

  const closes = candles.map((candle) => candle.close)
  const returns: number[] = []
  for (let i = 7; i < closes.length; i += 1) {
    const previous = closes[i - 7]
    const current = closes[i]
    if (previous > 0) returns.push((current - previous) / previous)
  }
  const tail = returns.slice(-90)
  const { mean, std } = meanStd(tail)
  const lastReturn = returns[returns.length - 1] ?? 0
  const z = std > 0 ? (lastReturn - mean) / std : 0
  const sma20Window = closes.slice(-20)
  const sma20 = sma20Window.reduce((sum, value) => sum + value, 0) / sma20Window.length
  const gap = sma20 > 0 ? ((closes[closes.length - 1] - sma20) / sma20) * 100 : 0
  return factor("meanReversionOverheat", "均值过热", "Mean-Reversion Overheat", linTo100(z, 0.5, 3.5) * 0.55 + linTo100(gap, 2, 18) * 0.45, [
    `7-period return z=${z.toFixed(2)} (positive = overbought)`,
    `Close vs SMA20 gap ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%`,
  ])
}

function scoreMacroComplacency(metrics: EuphoriaMetrics): EuphoriaFactor {
  const vix = metrics.vixValue
  if (vix === null || !Number.isFinite(vix)) return factor("macroComplacency", "宏观自满", "Macro Complacency", 35, ["VIX unavailable"])

  let score = 100 - linTo100(vix, 11, 26)
  const lines = [`VIX ${vix.toFixed(1)} · low volatility can mark late-cycle complacency`]
  const recent = metrics.vixRecent
  if (recent.length >= 5) {
    const past = recent[recent.length - 5]
    const change = past > 0 ? ((vix - past) / past) * 100 : 0
    if (change <= -20) {
      score = Math.min(100, score + 6)
      lines.push(`VIX ${change.toFixed(0)}% over 5 prints · volatility compression`)
    }
  }
  return factor("macroComplacency", "宏观自满", "Macro Complacency", score, lines)
}

function scoreVolumeClimax(metrics: EuphoriaMetrics): EuphoriaFactor {
  const candles = metrics.candles
  if (candles.length < 30) return factor("volumeClimax", "成交高潮", "Volume Climax", 30, ["Not enough history"])

  const last = candles[candles.length - 1]
  const window = candles.slice(-31, -1).map((candle) => candle.volume)
  const { mean, std } = meanStd(window)
  const z = std > 0 ? (last.volume - mean) / std : 0
  return factor("volumeClimax", "成交高潮", "Volume Climax", linTo100(z, 0.5, 3.5), [
    `Last candle volume z=${z.toFixed(2)} vs 30-candle baseline`,
  ])
}

function scoreMayerMultiple(metrics: EuphoriaMetrics): EuphoriaFactor {
  const closes = metrics.candles.map((candle) => candle.close)
  if (closes.length < 60) return factor("mayerMultiple", "Mayer 倍数", "Mayer Multiple", 35, ["Insufficient candles"])

  const latest = closes[closes.length - 1]
  const smaLen = Math.min(closes.length, 200)
  const sma = closes.slice(-smaLen).reduce((sum, value) => sum + value, 0) / smaLen
  const mayer = sma > 0 ? latest / sma : null
  if (mayer === null || !Number.isFinite(mayer)) return factor("mayerMultiple", "Mayer 倍数", "Mayer Multiple", 35, ["Mayer calculation failed"])

  return factor("mayerMultiple", "Mayer 倍数", "Mayer Multiple", linTo100(mayer, 1.5, 2.6), [
    `Mayer ${mayer.toFixed(3)}x · >2.4 is the classic overheated zone`,
  ])
}

function scorePuellMultiple(metrics: EuphoriaMetrics): EuphoriaFactor {
  const revenue = metrics.minerRevenueSeries ?? []
  if (revenue.length < 30) return factor("puellMultiple", "Puell 倍数", "Puell Multiple", 35, ["Insufficient miner revenue"])

  const current = revenue[revenue.length - 1]
  const maLen = Math.min(revenue.length, 365)
  const average = revenue.slice(-maLen).reduce((sum, value) => sum + value, 0) / maLen
  const puell = average > 0 ? current / average : null
  if (puell === null || !Number.isFinite(puell)) return factor("puellMultiple", "Puell 倍数", "Puell Multiple", 35, ["Puell calculation failed"])

  return factor("puellMultiple", "Puell 倍数", "Puell Multiple", linTo100(puell, 1.5, 4.5), [
    `Puell ${puell.toFixed(3)}x · high miner revenue multiple can coincide with late-cycle heat`,
  ])
}

function recentUpperWicks(metrics: EuphoriaMetrics): EuphoriaWickEvent[] {
  const candles = metrics.candles
  if (candles.length < 30) return []
  const volumeStats = meanStd(candles.slice(-90).map((candle) => candle.volume))
  return candles
    .map((candle, index) => {
      const ratio = upperWickRatio(candle)
      const volumeZ = volumeStats.std > 0 ? (candle.volume - volumeStats.mean) / volumeStats.std : 0
      const next = candles[index + 1]
      return {
        time: candle.time,
        upperWickRatio: ratio,
        wickUsd: upperWickUsd(candle),
        closeUsd: candle.close,
        volumeZ,
        forward24hPct: next && candle.close > 0 ? ((next.close - candle.close) / candle.close) * 100 : null,
      }
    })
    .filter((event) => event.upperWickRatio >= 0.45 || event.volumeZ >= 2.5)
    .slice(-8)
    .reverse()
}

export function computeEuphoriaOpportunity(metrics: EuphoriaMetrics): EuphoriaComputation {
  const factors = [
    scoreUpperWickExhaustion(metrics),
    scoreGreedExtreme(metrics),
    scoreLeverageCrowding(metrics),
    scoreRallyExtension(metrics),
    scoreMeanReversionOverheat(metrics),
    scoreMacroComplacency(metrics),
    scoreVolumeClimax(metrics),
    scoreMayerMultiple(metrics),
    scorePuellMultiple(metrics),
  ]

  const activeSignals: EuphoriaActiveSignal[] = factors.flatMap((item) => {
    if (item.score < 75) return []
    return [{
      code: item.id,
      severity: item.score >= 90 ? "alert" : "warn",
      labelZh: item.labelZh,
      labelEn: item.labelEn,
    }]
  })
  const confluenceBoost = activeSignals.filter((signal) => signal.severity === "alert").length >= 3 ? 6 : 0
  const score = clamp(factors.reduce((sum, item) => sum + item.weighted, 0) + confluenceBoost, 0, 100)
  const band = bandFromScore(score)

  return {
    euphoriaScore: score,
    signalBand: band.band,
    signalLabelZh: band.zh,
    signalLabelEn: band.en,
    factors,
    activeSignals,
    recentWicks: recentUpperWicks(metrics),
  }
}
