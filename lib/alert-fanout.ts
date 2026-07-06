/**
 * Alert fan-out — maps a `signal_events` row to the channels each user's
 * `alert_rules` want, and formats the message. This is ROADMAP.md's "Next
 * Integration Work" items 2-4 (worker → signal_events/alerts_log → channels):
 * main shipped the schema and the detectors; nothing dispatched between them
 * yet. Every alert carries the *why* (evidence), the historical backtest stat,
 * and a risk note — the notification is the lesson, not just a buy/sell ping.
 *
 * Pure functions, no I/O. Consumed by app/api/alerts/dispatch (the cron worker),
 * which loads events + rules + telegram_links and calls these to build and send.
 *
 * Schema reference (scripts/003_trading_loop_schema.sql):
 *   alert_rules(user_id, symbol='*', signal_id='composite', threshold, channels[], enabled)
 *   signal_events(user_id?, symbol, asset_class, signal_id, direction, state, score, evidence_json)
 *   alerts_log(user_id, event_id, channel, title, body)
 */

export type AlertChannel = "email" | "in_app" | "telegram" | "web_push"
export type SignalState = "neutral" | "zone_entered" | "triggered" | "invalidated" | "resolved"
export type SignalDirection = "long" | "short" | "risk_off"
export type Locale = "zh" | "en"

export interface AlertRule {
  user_id: string
  symbol: string // '*' = any followed symbol
  signal_id: string // 'composite' = any
  threshold: number
  channels: AlertChannel[]
  enabled: boolean
}

export interface SignalEventRecord {
  symbol: string
  asset_class: "crypto" | "stock" | "macro"
  signal_id: string
  direction: SignalDirection
  state: SignalState
  score: number
  evidence_json?: {
    activeSignals?: { code: string; labelZh: string; labelEn: string }[]
    invalidationPrice?: number | null
    backtest?: { horizonDays: number; hitRatePct: number | null; medianReturnPct: number | null } | null
  } | null
  triggered_at: string
}

/**
 * Only a confirmed trigger at/above the user's threshold fires an alert;
 * zone_entered/invalidated/resolved are heads-up states a UI can show but that
 * should not page someone by email/Telegram.
 */
export function ruleMatchesEvent(rule: AlertRule, event: SignalEventRecord): boolean {
  if (!rule.enabled) return false
  if (event.state !== "triggered") return false
  if (rule.symbol !== "*" && rule.symbol.toUpperCase() !== event.symbol.toUpperCase()) return false
  if (rule.signal_id !== "composite" && rule.signal_id !== event.signal_id) return false
  if (event.score < rule.threshold) return false
  return true
}

/** Channels to deliver an event on for a user, deduped across their rules. */
export function channelsForEvent(rules: AlertRule[], event: SignalEventRecord): AlertChannel[] {
  const set = new Set<AlertChannel>()
  for (const rule of rules) {
    if (ruleMatchesEvent(rule, event)) rule.channels.forEach((c) => set.add(c))
  }
  return [...set]
}

const SIGNAL_NAME: Record<string, { zh: string; en: string }> = {
  "black-swan": { zh: "黑天鹅抄底", en: "Black Swan dip" },
  black_swan: { zh: "黑天鹅抄底", en: "Black Swan dip" },
  euphoria: { zh: "超涨派发", en: "Euphoria distribution" },
  composite: { zh: "综合信号", en: "Composite signal" },
}

const STATE_LABEL: Record<SignalState, { zh: string; en: string }> = {
  neutral: { zh: "中性", en: "neutral" },
  zone_entered: { zh: "进入信号区", en: "entered zone" },
  triggered: { zh: "触发", en: "triggered" },
  invalidated: { zh: "失效", en: "invalidated" },
  resolved: { zh: "解除", en: "resolved" },
}

export interface FormattedAlert {
  title: string
  /** HTML-ish body for email and Telegram (parse_mode=HTML). */
  body: string
}

export function formatAlertMessage(event: SignalEventRecord, locale: Locale): FormattedAlert {
  const name = SIGNAL_NAME[event.signal_id] ?? SIGNAL_NAME.composite
  const state = STATE_LABEL[event.state]
  const dirZh = event.direction === "long" ? "做多/抄底" : event.direction === "short" ? "做空/派发" : "风险规避"
  const dirEn = event.direction === "long" ? "long / accumulate" : event.direction === "short" ? "short / distribute" : "risk-off"

  const title =
    locale === "zh"
      ? `${event.symbol} · ${name.zh}${state.zh}(${event.score.toFixed(0)}/100)`
      : `${event.symbol} · ${name.en} ${state.en} (${event.score.toFixed(0)}/100)`

  const lines: string[] = []
  if (locale === "zh") {
    lines.push(`<b>${event.symbol}</b> ${name.zh} ${state.zh} · ${dirZh}`)
    lines.push(`评分 <b>${event.score.toFixed(0)}/100</b>`)
  } else {
    lines.push(`<b>${event.symbol}</b> ${name.en} ${state.en} · ${dirEn}`)
    lines.push(`Score <b>${event.score.toFixed(0)}/100</b>`)
  }

  const active = event.evidence_json?.activeSignals ?? []
  if (active.length) {
    lines.push(locale === "zh" ? "证据:" : "Why:")
    for (const s of active.slice(0, 4)) lines.push(`• ${locale === "zh" ? s.labelZh : s.labelEn}`)
  }

  const bt = event.evidence_json?.backtest
  if (bt && bt.hitRatePct != null && bt.medianReturnPct != null) {
    lines.push(
      locale === "zh"
        ? `历史:${bt.horizonDays}日中位 ${bt.medianReturnPct.toFixed(1)}% · 胜率 ${bt.hitRatePct.toFixed(0)}%`
        : `History: ${bt.horizonDays}d median ${bt.medianReturnPct.toFixed(1)}% · hit-rate ${bt.hitRatePct.toFixed(0)}%`,
    )
  }

  const inval = event.evidence_json?.invalidationPrice
  if (inval != null && Number.isFinite(inval)) {
    lines.push(locale === "zh" ? `失效价 ${inval.toFixed(2)}` : `Invalidation ${inval.toFixed(2)}`)
  }

  lines.push(
    locale === "zh"
      ? "<i>概率信号,非精确顶底。先定仓位与失效价。非投资建议。</i>"
      : "<i>Probabilistic, not a precise top/bottom. Size and set your stop first. Not investment advice.</i>",
  )

  return { title, body: lines.join("\n") }
}
