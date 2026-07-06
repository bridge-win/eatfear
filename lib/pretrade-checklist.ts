/**
 * Pre-trade checklist generator — the risk-execution layer the research corpus
 * catalogues (vol-target sizing, invalidation, event risk, confluence) but the
 * app never implemented. Turns a triggered signal into a structured go/no-go
 * checklist, a volatility-targeted position size, and an invalidation price, so
 * "the score is 78" becomes "here's how much, where you're wrong, and why to
 * pause." Mirrors the 12-checkpoint discipline standard for retail traders.
 *
 * Pure functions, no I/O. Not investment advice.
 */

export type TradeDirection = "long" | "short"

export interface ChecklistInput {
  direction: TradeDirection
  /** Composite signal score 0–100 (higher = stronger). */
  score: number
  /** Score at/above which the signal is considered triggered. */
  triggerScore: number
  entryPrice: number
  /** Recent daily ATR as % of price, for sizing + invalidation distance. */
  atrPct?: number
  activeSignals?: { code: string; severity: "info" | "warn" | "alert" }[]
  /** Disconfirming factors surfaced by the engine. */
  contradictions?: string[]
  /** Whether a known high-impact event (earnings, FOMC, unlock) is imminent. */
  eventRiskSoon?: boolean
  /** Account equity in quote currency, for position sizing. */
  accountEquity?: number
  /** Risk budget per trade as % of equity (default 1%). */
  riskPerTradePct?: number
  /** ATR multiple for the stop (default 2). */
  stopAtrMultiple?: number
}

export type CheckStatus = "pass" | "warn" | "fail" | "info"

export interface ChecklistItem {
  id: string
  labelZh: string
  labelEn: string
  status: CheckStatus
  detailZh: string
  detailEn: string
}

export type Readiness = "ready" | "caution" | "stand_down"

export interface ChecklistResult {
  items: ChecklistItem[]
  invalidationPrice: number | null
  stopDistancePct: number | null
  /** Suggested position size in quote currency (vol-targeted). */
  positionSizeQuote: number | null
  /** Position size as a fraction of equity (0–1). */
  positionSizeFraction: number | null
  readiness: Readiness
}

function pct(n: number, digits = 1): string {
  return `${n >= 0 ? "" : ""}${n.toFixed(digits)}%`
}

export function buildPretradeChecklist(input: ChecklistInput): ChecklistResult {
  const {
    direction,
    score,
    triggerScore,
    entryPrice,
    atrPct,
    activeSignals = [],
    contradictions = [],
    eventRiskSoon = false,
    accountEquity,
    riskPerTradePct = 1,
    stopAtrMultiple = 2,
  } = input

  const items: ChecklistItem[] = []

  // 1. Signal strength
  items.push({
    id: "strength",
    labelZh: "信号强度达到触发阈值",
    labelEn: "Signal strength meets trigger",
    status: score >= triggerScore ? "pass" : "warn",
    detailZh: `分数 ${score.toFixed(0)} vs 触发 ${triggerScore.toFixed(0)}`,
    detailEn: `Score ${score.toFixed(0)} vs trigger ${triggerScore.toFixed(0)}`,
  })

  // 2. Confluence
  const alertCount = activeSignals.filter((s) => s.severity === "alert").length
  items.push({
    id: "confluence",
    labelZh: "多信号共振(≥2 个 alert)",
    labelEn: "Confluence (≥2 alert-tier signals)",
    status: alertCount >= 2 ? "pass" : alertCount === 1 ? "warn" : "fail",
    detailZh: `${alertCount} 个 alert 级信号叠加`,
    detailEn: `${alertCount} alert-tier signal(s) stacked`,
  })

  // 3. Contradictions
  items.push({
    id: "contradictions",
    labelZh: "反证项已审阅",
    labelEn: "Contradictions reviewed",
    status: contradictions.length === 0 ? "pass" : "warn",
    detailZh: contradictions.length ? `${contradictions.length} 项反证:${contradictions.slice(0, 2).join("；")}` : "无显著反证",
    detailEn: contradictions.length ? `${contradictions.length} contradiction(s): ${contradictions.slice(0, 2).join("; ")}` : "none flagged",
  })

  // 4. Event risk
  items.push({
    id: "event",
    labelZh: "临近事件风险",
    labelEn: "Imminent event risk",
    status: eventRiskSoon ? "warn" : "pass",
    detailZh: eventRiskSoon ? "有高影响事件临近,考虑减半仓或等待" : "无已知高影响事件临近",
    detailEn: eventRiskSoon ? "High-impact event soon — consider half size or waiting" : "no known high-impact event soon",
  })

  // 5. Invalidation + 6. Sizing (both need ATR)
  let invalidationPrice: number | null = null
  let stopDistancePct: number | null = null
  let positionSizeQuote: number | null = null
  let positionSizeFraction: number | null = null

  if (atrPct !== undefined && Number.isFinite(atrPct) && atrPct > 0 && entryPrice > 0) {
    stopDistancePct = atrPct * stopAtrMultiple
    invalidationPrice =
      direction === "long"
        ? entryPrice * (1 - stopDistancePct / 100)
        : entryPrice * (1 + stopDistancePct / 100)

    items.push({
      id: "invalidation",
      labelZh: "失效价已设定",
      labelEn: "Invalidation price set",
      status: "pass",
      detailZh: `${stopAtrMultiple}×ATR ⇒ 止损距离 ${pct(stopDistancePct)} · 失效价 ${invalidationPrice.toFixed(2)}`,
      detailEn: `${stopAtrMultiple}×ATR ⇒ stop ${pct(stopDistancePct)} · invalidation ${invalidationPrice.toFixed(2)}`,
    })

    // Vol-target sizing: risk budget / stop distance = position notional.
    if (accountEquity !== undefined && accountEquity > 0) {
      const riskQuote = accountEquity * (riskPerTradePct / 100)
      positionSizeQuote = riskQuote / (stopDistancePct / 100)
      positionSizeFraction = positionSizeQuote / accountEquity
      // A vol-target size exceeding equity implies leverage; cap the suggestion.
      const capped = Math.min(positionSizeQuote, accountEquity)
      items.push({
        id: "sizing",
        labelZh: "波动率定仓",
        labelEn: "Volatility-targeted sizing",
        status: positionSizeFraction > 1 ? "warn" : "pass",
        detailZh: `风险 ${riskPerTradePct}% 权益 ⇒ 仓位 ≈ ${capped.toFixed(0)}${positionSizeFraction > 1 ? "(需杠杆,已按无杠杆封顶)" : ""}`,
        detailEn: `${riskPerTradePct}% equity at risk ⇒ size ≈ ${capped.toFixed(0)}${positionSizeFraction > 1 ? " (implies leverage; capped to spot)" : ""}`,
      })
    } else {
      items.push({
        id: "sizing",
        labelZh: "波动率定仓",
        labelEn: "Volatility-targeted sizing",
        status: "info",
        detailZh: "填写账户权益后计算建议仓位",
        detailEn: "Enter account equity to size the position",
      })
    }
  } else {
    items.push({
      id: "invalidation",
      labelZh: "失效价已设定",
      labelEn: "Invalidation price set",
      status: "fail",
      detailZh: "缺少 ATR/波动率,无法设定止损——不要在没有失效价的情况下入场",
      detailEn: "No ATR/volatility — cannot set a stop. Do not enter without an invalidation level.",
    })
  }

  const failCount = items.filter((i) => i.status === "fail").length
  const warnCount = items.filter((i) => i.status === "warn").length
  const readiness: Readiness = failCount > 0 ? "stand_down" : warnCount >= 2 ? "caution" : "ready"

  return { items, invalidationPrice, stopDistancePct, positionSizeQuote, positionSizeFraction, readiness }
}
