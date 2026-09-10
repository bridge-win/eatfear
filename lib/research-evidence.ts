import evidenceJson from "@/public/research/evidence.json"

export type Verdict = string

export interface StrategyEvidence {
  id: string
  name: string
  family: string
  timeframe: string
  params: Record<string, number | boolean | string> | null
  gridSize: number | null
  oos: { total: number; sharpe: number; maxdd: number; trades: number; win: number; pf: number }
  is_: { total: number; sharpe: number }
  robustness: {
    planeSpread: number | null
    concentration: { all: number; drop1: number; drop3: number; n: number } | null
    yearly: Record<string, number> | null
    walkForward: {
      n_windows: number | null
      win_windows: number | null
      pct_windows: number | null
      sharpe: number | null
      param_switches: number | null
    }
  }
  verdict: Verdict[]
  doc: string
}

export interface ComboEvidence {
  id: string
  desc: string
  family: string
  trades: number
  exposure: number
  oos: { total: number; sharpe: number; maxdd: number }
  oosStress: { total: number; sharpe: number }
  is_: { total: number; sharpe: number }
  winPct: number
  dsr: number
}

export interface ResearchEvidence {
  schema: string
  generatedAt: string
  provenance: { origin: string; commit: string; note: string }
  windows: {
    strategies: { train: [string, string]; test: [string, string]; fee: number }
    combos: { train: string; test: string; fee: number; slip: number; wickW: number; nTrials: number }
  }
  benchmark: { id: string; name: string; oos: { total: number; sharpe: number; maxdd: number } }
  summary: {
    nStrategies: number
    nSurvivors: number
    survivors: string[]
    nBeatBuyHold: number
    nCombos: number
    nCombosBeatBuyHold: number
    combosBuyHoldOos: number
    selectionTest: { overlap: number; top_is_oos_beat_bh: number; top_is_oos_median: number }
    headline: string
  }
  strategies: StrategyEvidence[]
  combos: ComboEvidence[]
}

export const evidence = evidenceJson as unknown as ResearchEvidence

/** Dashboard signal id → the backtested strategies that encode the same idea. */
const SIGNAL_MAP: Record<string, string[]> = {
  fearGreed: ["fgi_contrarian", "fgi_momentum", "fgi_filtered_trend"],
  sentiment: ["fgi_contrarian", "fgi_momentum", "fgi_filtered_trend"],
  capitulation: ["capitulation", "cgw_reversal"],
  volume: ["cgw_reversal", "volume_breakout", "obv_trend", "vwma_trend", "cmf_trend", "force_index", "adl_trend"],
  volumeSpike: ["cgw_reversal", "capitulation", "liquidity_timing"],
  moneyFlow: ["mfi_mr", "cmf_trend", "adl_trend", "force_index"],
  breakout: ["donchian", "volume_breakout", "range_breakout", "atr_breakout", "bollinger_breakout", "keltner_breakout", "squeeze_breakout", "cci_breakout"],
  trend: ["tsmom", "faber_ma", "sma_cross", "ema_cross", "macd", "ichimoku", "supertrend", "psar", "triple_ma", "dema_trend", "hma_trend", "kama_trend", "trix_trend", "ppo_trend", "linear_slope", "aroon_trend", "cmo_trend", "rsi_trend", "ma_envelope"],
  trendStrength: ["adx_trend", "aroon_trend", "supertrend"],
  momentum: ["tsmom", "tsmom_vol", "awesome_oscillator", "linear_slope"],
  meanReversion: ["rsi2_mr", "bollinger_mr", "cci_mr", "stochastic_mr", "williams_mr", "mfi_mr"],
  volatility: ["vol_target", "tsmom_vol", "ulcer_timing", "squeeze_breakout"],
  regime: ["vol_target", "ulcer_timing", "fgi_filtered_trend", "liquidity_timing"],
  cyclePosition: ["ahr999_zone", "faber_ma"],
  valuation: ["ahr999_zone"],
}

const byId = new Map(evidence.strategies.map((s) => [s.id, s]))

export function strategyById(id: string): StrategyEvidence | undefined {
  return byId.get(id)
}

export function evidenceForSignal(signalId: string): StrategyEvidence[] {
  return (SIGNAL_MAP[signalId] ?? []).map((id) => byId.get(id)).filter((s): s is StrategyEvidence => Boolean(s))
}

export type EvidenceTone = "survived" | "failed" | "negative" | "none"

export interface EvidenceBadge {
  tone: EvidenceTone
  label: string
  detail: string
  strategies: StrategyEvidence[]
}

/**
 * A signal's badge reports what happened out-of-sample, not what the signal says now.
 * "Survived" means it was not falsified by the three robustness checks — which is far
 * weaker than "works", since no strategy reached the DSR ≥ 0.95 bar.
 */
export function badgeForSignal(signalId: string): EvidenceBadge {
  const matches = evidenceForSignal(signalId)
  if (matches.length === 0) {
    return { tone: "none", label: "无回测记录", detail: "该信号未纳入样本外对照,不要据其单独下注。", strategies: [] }
  }
  const best = matches.reduce((a, b) => (b.oos.sharpe > a.oos.sharpe ? b : a))
  const survived = matches.filter((s) => s.verdict.length === 1 && s.verdict[0] === "未被证伪")
  const window = `${evidence.windows.strategies.test[0]}→${evidence.windows.strategies.test[1]}`
  if (survived.length > 0) {
    const s = survived[0]
    return {
      tone: "survived",
      label: "未被证伪",
      detail: `${s.name} 样本外 ${pct(s.oos.total)}(${window}),三项稳健性检验未证伪。注意:未被证伪 ≠ 有效,全部策略的 Deflated Sharpe 均未达 0.95。`,
      strategies: matches,
    }
  }
  const tone: EvidenceTone = best.oos.sharpe <= 0 ? "negative" : "failed"
  return {
    tone,
    label: tone === "negative" ? "样本外为负" : "未通过稳健性检验",
    detail: `同类最好的是 ${best.name},样本外 ${pct(best.oos.total)}(${window}),判定:${best.verdict.join("、")}。`,
    strategies: matches,
  }
}

function pct(v: number): string {
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`
}

export function formatPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`
}
