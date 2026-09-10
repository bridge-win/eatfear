/**
 * Horizon-scale probabilistic forecast.
 *
 * What this deliberately does NOT do: predict direction. Walk-forward tests on 2015-2026
 * daily data show every multi-factor model scoring a negative out-of-sample R² against a
 * zero-drift baseline, failing to rank returns, and never beating "always long" on hit
 * rate. Conditioning the distribution on valuation, volatility or sentiment regimes made
 * the pinball loss worse at every horizon. So the median is the spot price, and the only
 * thing modelled is width.
 *
 * Width comes from a volatility model; shape comes from the empirical quantiles of past
 * standardised returns, which keeps the fat right tail instead of assuming normality.
 */

export interface Candle {
  time: number
  close: number
}

export type VolModel = "const" | "rv30" | "ewma" | "har" | "ensemble"

export const QUANTILES = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95] as const

const DAY = 86_400_000

function logReturns(candles: Candle[]): number[] {
  return candles.map((c, i) => (i === 0 ? 0 : Math.log(c.close / candles[i - 1].close)))
}

function rollingStd(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < window) {
      out.push(null)
      continue
    }
    const slice = values.slice(i - window + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    out.push(Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1)))
  }
  return out
}

/** Annualised volatility forecasts for [t+1, t+horizon], each using only data up to t. */
export function volForecasts(candles: Candle[], horizon: number): Record<VolModel, (number | null)[]> {
  const r = logReturns(candles)
  const ann = Math.sqrt(365)
  const scale = (xs: (number | null)[]) => xs.map((v) => (v === null ? null : v * ann))

  const rv7 = scale(rollingStd(r, 7))
  const rv30 = scale(rollingStd(r, 30))
  const rv90 = scale(rollingStd(r, 90))

  const ewma: (number | null)[] = []
  let ev = 0
  for (let i = 0; i < r.length; i++) {
    ev = i === 0 ? r[i] ** 2 : 0.94 * ev + 0.06 * r[i] ** 2
    ewma.push(i < 30 ? null : Math.sqrt(ev * 365))
  }

  const constant: (number | null)[] = []
  for (let i = 0; i < r.length; i++) {
    if (i < 365) {
      constant.push(null)
      continue
    }
    const slice = r.slice(1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    constant.push(Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1)) * ann)
  }

  // HAR-RV (Corsi 2009): log realised vol over the horizon regressed on weekly/monthly/
  // quarterly lags. Coefficients are refit each calendar year on data whose target window
  // already closed before the year starts, so the fit never sees its own test period.
  const target = scale(forwardStd(r, horizon))
  const har: (number | null)[] = new Array(r.length).fill(null)
  let coeffs: number[] | null = null
  const years = [...new Set(candles.map((c) => new Date(c.time).getUTCFullYear()))].sort()
  for (const year of years) {
    const cut = Date.UTC(year, 0, 1)
    const gap = cut - (horizon + 1) * DAY
    const rows: { x: number[]; y: number }[] = []
    for (let i = 0; i < candles.length; i++) {
      if (candles[i].time > gap) break
      const a = rv7[i], b = rv30[i], c = rv90[i], y = target[i]
      if (a && b && c && y && a > 0 && b > 0 && c > 0 && y > 0) rows.push({ x: [Math.log(a), Math.log(b), Math.log(c), 1], y: Math.log(y) })
    }
    if (rows.length >= 300) coeffs = leastSquares(rows)
    if (!coeffs) continue
    for (let i = 0; i < candles.length; i++) {
      const t = candles[i].time
      if (t < cut || t >= Date.UTC(year + 1, 0, 1)) continue
      const a = rv7[i], b = rv30[i], c = rv90[i]
      if (a && b && c && a > 0 && b > 0 && c > 0) har[i] = Math.exp(coeffs[0] * Math.log(a) + coeffs[1] * Math.log(b) + coeffs[2] * Math.log(c) + coeffs[3])
    }
  }

  const models: Record<VolModel, (number | null)[]> = { const: constant, rv30, ewma, har, ensemble: [] }
  models.ensemble = candles.map((_, i) => {
    const parts = [constant[i], rv30[i], ewma[i], har[i]].filter((v): v is number => v !== null && v > 0)
    return parts.length === 4 ? Math.exp(parts.reduce((a, b) => a + Math.log(b), 0) / 4) : null
  })
  return models
}

function forwardStd(r: number[], horizon: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < r.length; i++) {
    if (i + horizon >= r.length) {
      out.push(null)
      continue
    }
    const slice = r.slice(i + 1, i + horizon + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    out.push(Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1)))
  }
  return out
}

function leastSquares(rows: { x: number[]; y: number }[]): number[] {
  const k = rows[0].x.length
  const ata = Array.from({ length: k }, () => new Array(k).fill(0))
  const atb = new Array(k).fill(0)
  for (const { x, y } of rows) {
    for (let i = 0; i < k; i++) {
      atb[i] += x[i] * y
      for (let j = 0; j < k; j++) ata[i][j] += x[i] * x[j]
    }
  }
  for (let i = 0; i < k; i++) ata[i][i] += 1e-8
  return solve(ata, atb)
}

function solve(a: number[][], b: number[]): number[] {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    const d = m[col][col] || 1e-12
    for (let c = col; c <= n; c++) m[col][c] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r][col]
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c]
    }
  }
  return m.map((row) => row[n])
}

export interface Calibration {
  model: VolModel
  n: number
  /** Patton (2011) robust loss for volatility forecasts; lower is better. */
  qlike: number
  /** Kolmogorov-Smirnov distance of the PIT from uniform; lower means better calibrated. */
  pitKs: number
  coverage: { p50: number; p80: number; p90: number }
}

/** Walk-forward calibration: standardised quantiles come from data before each test year. */
export function calibrate(candles: Candle[], sigma: (number | null)[], horizon: number, model: VolModel, fromYear: number, toYear: number): Calibration | null {
  const logs = candles.map((c) => Math.log(c.close))
  const realised = forwardStd(logReturns(candles), horizon).map((v) => (v === null ? null : v * Math.sqrt(365)))
  const z: (number | null)[] = candles.map((_, i) => {
    const s = sigma[i]
    const y = i + horizon < candles.length ? logs[i + horizon] - logs[i] : null
    return s && s > 0 && y !== null ? y / (s * Math.sqrt(horizon / 365)) : null
  })

  const pits: number[] = []
  let qlikeSum = 0, qlikeN = 0
  const cov = { p50: 0, p80: 0, p90: 0 }
  let covN = 0

  for (let year = fromYear; year <= toYear; year++) {
    const cut = Date.UTC(year, 0, 1)
    const gap = cut - (horizon + 1) * DAY
    const train = z.filter((v, i) => v !== null && candles[i].time <= gap) as number[]
    if (train.length < 300) continue
    const sorted = [...train].sort((a, b) => a - b)
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
    const bands = { p50: [q(0.25), q(0.75)], p80: [q(0.1), q(0.9)], p90: [q(0.05), q(0.95)] }
    for (let i = 0; i < candles.length; i++) {
      const t = candles[i].time
      if (t < cut || t >= Date.UTC(year + 1, 0, 1)) continue
      const zi = z[i]
      if (zi === null) continue
      pits.push(sorted.filter((v) => v <= zi).length / sorted.length)
      covN++
      for (const key of ["p50", "p80", "p90"] as const) {
        if (zi >= bands[key][0] && zi <= bands[key][1]) cov[key]++
      }
      const s = sigma[i], rv = realised[i]
      if (s && rv && s > 0) {
        const ratio = (rv * rv) / (s * s)
        qlikeSum += ratio - Math.log(ratio) - 1
        qlikeN++
      }
    }
  }
  if (covN === 0 || qlikeN === 0) return null
  const sortedPit = [...pits].sort((a, b) => a - b)
  let ks = 0
  sortedPit.forEach((p, i) => {
    ks = Math.max(ks, Math.abs(p - (i + 1) / sortedPit.length), Math.abs(p - i / sortedPit.length))
  })
  return {
    model,
    n: covN,
    qlike: qlikeSum / qlikeN,
    pitKs: ks,
    coverage: { p50: cov.p50 / covN, p80: cov.p80 / covN, p90: cov.p90 / covN },
  }
}

export interface ForecastBand {
  day: number
  time: number
  quantiles: Record<string, number>
}

export interface HorizonForecast {
  horizon: number
  asOf: string
  horizonEnd: string
  spot: number
  volModel: VolModel
  sigma: number
  sigmaAlternatives: Partial<Record<VolModel, number>>
  /** Standardised quantiles, centred so the median is exactly zero drift. */
  zQuantiles: Record<string, number>
  sampleSize: number
  effectiveSampleSize: number
  bands: ForecastBand[]
  probabilities: { price: number; below: number }[]
  calibration: Calibration[]
  selectedBecause: string
}

/**
 * @param selectionYears window used to pick the volatility model
 * @param holdoutFrom first year that is only ever scored, never used for selection
 */
export function forecast(
  candles: Candle[],
  horizon: number,
  selectionYears: [number, number],
  holdoutFrom: number,
  priceGrid?: number[],
): HorizonForecast {
  const models = volForecasts(candles, horizon)
  const lastYear = new Date(candles[candles.length - 1].time).getUTCFullYear()
  const names: VolModel[] = ["const", "rv30", "ewma", "har", "ensemble"]

  const selection = names.map((m) => calibrate(candles, models[m], horizon, m, selectionYears[0], selectionYears[1])).filter((c): c is Calibration => c !== null)
  const holdout = names.map((m) => calibrate(candles, models[m], horizon, m, holdoutFrom, lastYear)).filter((c): c is Calibration => c !== null)

  const bestOf = (list: Calibration[]) => list.reduce((a, b) => (b.qlike < a.qlike ? b : a)).model
  const selWinner = selection.length ? bestOf(selection) : "ensemble"
  const holdWinner = holdout.length ? bestOf(holdout) : "ensemble"
  // Picking the holdout winner would be selecting on the exam. Agreement between the two
  // windows is the only evidence that a single model is genuinely better; otherwise combine.
  const chosen: VolModel = selWinner === holdWinner ? selWinner : "ensemble"
  const selectedBecause = selWinner === holdWinner
    ? `选择窗与留出窗的 QLIKE 赢家一致(${selWinner}),采用该模型`
    : `选择窗赢家 ${selWinner}、留出窗赢家 ${holdWinner} 不一致,按事前规则不做选择,取等权组合`

  const sigmaSeries = models[chosen]
  const last = candles.length - 1
  const sigma = sigmaSeries[last] ?? sigmaSeries.filter((v): v is number => v !== null).slice(-1)[0] ?? 0.5
  const spot = candles[last].close

  const logs = candles.map((c) => Math.log(c.close))
  const gap = candles[last].time - (horizon + 1) * DAY
  const z: number[] = []
  for (let i = 0; i < candles.length; i++) {
    if (candles[i].time > gap) break
    const s = sigmaSeries[i]
    if (!s || s <= 0 || i + horizon >= candles.length) continue
    z.push((logs[i + horizon] - logs[i]) / (s * Math.sqrt(horizon / 365)))
  }
  const sorted = [...z].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const centred = sorted.map((v) => v - median)
  const zq: Record<string, number> = {}
  for (const p of QUANTILES) zq[String(p)] = centred[Math.min(centred.length - 1, Math.floor(p * centred.length))]

  const bands: ForecastBand[] = []
  for (let day = 1; day <= horizon; day++) {
    const s = sigma * Math.sqrt(day / 365)
    const quantiles: Record<string, number> = {}
    for (const p of QUANTILES) quantiles[String(p)] = spot * Math.exp(zq[String(p)] * s)
    bands.push({ day, time: candles[last].time + day * DAY, quantiles })
  }

  const s30 = sigma * Math.sqrt(horizon / 365)
  // Round to a step that scales with price; a fixed 500 step collapses to zero for
  // low-priced series and silently produces a degenerate grid.
  const step = Math.max(0.01, 10 ** Math.floor(Math.log10(spot) - 1.5))
  const grid = priceGrid ?? [0.75, 0.8, 0.85, 0.9, 0.95, 1.05, 1.1, 1.15, 1.25].map((k) => Math.round((spot * k) / step) * step)
  const probabilities = grid.map((price) => ({
    price,
    below: centred.filter((v) => v * s30 < Math.log(price / spot)).length / centred.length,
  }))

  return {
    horizon,
    asOf: new Date(candles[last].time).toISOString().slice(0, 10),
    horizonEnd: new Date(candles[last].time + horizon * DAY).toISOString().slice(0, 10),
    spot,
    volModel: chosen,
    sigma,
    sigmaAlternatives: Object.fromEntries(names.map((m) => [m, models[m][last] ?? undefined]).filter(([, v]) => v !== undefined)) as Partial<Record<VolModel, number>>,
    zQuantiles: zq,
    sampleSize: centred.length,
    effectiveSampleSize: Math.floor(centred.length / horizon),
    bands,
    probabilities,
    calibration: holdout,
    selectedBecause,
  }
}
