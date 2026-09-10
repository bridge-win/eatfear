/**
 * The small set of rules exposed to live backtesting. Deliberately not the full frozen
 * catalogue: fifty rules on demand would just be a faster way to overfit. These six are
 * the textbook representatives of each lens (trend, breakout, momentum, mean reversion),
 * with grids kept to a handful of literature-default values so the multiple-comparison
 * count stays honest.
 */

import type { Bar } from "./ledger.ts"
import type { Rule } from "./split.ts"

function sma(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i]
    if (i >= n) sum -= closes[i - n]
    out.push(i >= n - 1 ? sum / n : null)
  }
  return out
}

function rsi(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = []
  let up = 0, dn = 0
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { out.push(null); continue }
    const d = closes[i] - closes[i - 1]
    const alpha = 1 / n
    up = up * (1 - alpha) + Math.max(d, 0) * alpha
    dn = dn * (1 - alpha) + Math.max(-d, 0) * alpha
    out.push(i < n ? null : 100 - 100 / (1 + up / (dn + 1e-12)))
  }
  return out
}

export const faberMa: Rule<{ n: number }> = {
  id: "faber_ma", name: "Faber 长均线择时(只多)", family: "趋势",
  grid: [{ n: 100 }, { n: 150 }, { n: 200 }],
  targets: (bars, { n }) => {
    const ma = sma(bars.map((b) => b.close), n)
    return bars.map((b, i) => (ma[i] !== null && b.close > ma[i]! ? 1 : 0))
  },
}

export const smaCross: Rule<{ fast: number; slow: number; short: boolean }> = {
  id: "sma_cross", name: "双均线交叉", family: "趋势",
  grid: [10, 20, 50].flatMap((fast) => [50, 100, 200].filter((slow) => slow > fast).flatMap((slow) => [true, false].map((short) => ({ fast, slow, short })))),
  targets: (bars, { fast, slow, short }) => {
    const closes = bars.map((b) => b.close)
    const f = sma(closes, fast), s = sma(closes, slow)
    return bars.map((_, i) => (f[i] === null || s[i] === null ? 0 : f[i]! > s[i]! ? 1 : short ? -1 : 0))
  },
}

export const donchian: Rule<{ n: number }> = {
  id: "donchian", name: "唐奇安通道(海龟)", family: "趋势",
  grid: [{ n: 20 }, { n: 55 }],
  targets: (bars, { n }) => {
    const out: number[] = []
    let p = 0
    for (let i = 0; i < bars.length; i++) {
      if (i < n) { out.push(0); continue }
      const win = bars.slice(i - n, i)
      const hi = Math.max(...win.map((b) => b.high)), lo = Math.min(...win.map((b) => b.low))
      const half = bars.slice(i - Math.floor(n / 2), i)
      const xh = Math.max(...half.map((b) => b.high)), xl = Math.min(...half.map((b) => b.low))
      const c = bars[i].close
      if (p === 0) { if (c > hi) p = 1; else if (c < lo) p = -1 }
      else if (p === 1 && c < xl) p = 0
      else if (p === -1 && c > xh) p = 0
      out.push(p)
    }
    return out
  },
}

export const tsmom: Rule<{ lookback: number }> = {
  id: "tsmom", name: "时间序列动量", family: "趋势",
  grid: [{ lookback: 30 }, { lookback: 90 }, { lookback: 180 }],
  targets: (bars, { lookback }) => bars.map((b, i) => (i < lookback ? 0 : Math.sign(b.close / bars[i - lookback].close - 1))),
}

export const rsi2: Rule<{ lo: number; maxHold: number }> = {
  id: "rsi2_mr", name: "RSI(2) 均值回归", family: "回归",
  grid: [10, 20, 30].flatMap((lo) => [5, 10].map((maxHold) => ({ lo, maxHold }))),
  targets: (bars, { lo, maxHold }) => {
    const r = rsi(bars.map((b) => b.close), 2)
    const out: number[] = []
    let p = 0, held = 0
    for (let i = 0; i < bars.length; i++) {
      const v = r[i]
      if (v === null || i < 20) { out.push(0); continue }
      if (p === 0) { if (v < lo) { p = 1; held = 0 } else if (v > 100 - lo) { p = -1; held = 0 } }
      else { held++; if ((p === 1 && v > 50) || (p === -1 && v < 50) || held >= maxHold) p = 0 }
      out.push(p)
    }
    return out
  },
}

export const bollinger: Rule<{ n: number; z: number }> = {
  id: "bollinger_mr", name: "布林带回归", family: "回归",
  grid: [20, 50].flatMap((n) => [2.0, 2.5].map((z) => ({ n, z }))),
  targets: (bars, { n, z }) => {
    const closes = bars.map((b) => b.close)
    const out: number[] = []
    let p = 0
    for (let i = 0; i < closes.length; i++) {
      if (i < n) { out.push(0); continue }
      const win = closes.slice(i - n + 1, i + 1)
      const m = win.reduce((a, b) => a + b, 0) / n
      const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) + 1e-12
      const zz = (closes[i] - m) / sd
      if (p === 0) { if (zz < -z) p = 1; else if (zz > z) p = -1 }
      else if ((p === 1 && zz > 0) || (p === -1 && zz < 0)) p = 0
      out.push(p)
    }
    return out
  },
}

export const RULES: Rule<Record<string, number | boolean>>[] = [faberMa, smaCross, donchian, tsmom, rsi2, bollinger] as unknown as Rule<Record<string, number | boolean>>[]

export function ruleById(id: string) {
  return RULES.find((r) => r.id === id)
}

export const buyHold: Rule<Record<string, never>> = {
  id: "buy_hold", name: "买入持有", family: "基准", grid: [{}],
  targets: (bars: Bar[]) => bars.map(() => 1),
}
