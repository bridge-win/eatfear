/**
 * Alert fan-out — maps a signal_events transition to the channels each user's
 * rules want, and formats the message. Every alert carries the *why* (evidence),
 * the invalidation, and a risk note: the notification is the lesson, not just a
 * "buy/sell" ping.
 *
 * Pure functions, no I/O. The cron route (app/api/scan-signals) loads events +
 * rules + telegram links and calls these to build and dispatch messages.
 */

export type AlertChannel = "inapp" | "email" | "telegram" | "webpush"
export type SignalEventKind = "zone_entered" | "triggered" | "invalidated" | "resolved" | "rearmed"
export type Locale = "zh" | "en"

export interface AlertRule {
  symbol: string // '*' = any followed symbol
  asset_class?: "crypto" | "stock" | null
  signal_id: string // 'composite' = any
  min_event_kind: "zone_entered" | "triggered"
  channels: AlertChannel[]
  enabled: boolean
}

export interface SignalEventRecord {
  symbol: string
  asset_class: "crypto" | "stock"
  signal_id: string
  direction: "long" | "short"
  event_kind: SignalEventKind
  score: number
  evidence?: {
    activeSignals?: { code: string; labelZh: string; labelEn: string }[]
    invalidationPrice?: number | null
    backtest?: { horizonDays: number; hitRatePct: number | null; medianReturnPct: number | null } | null
  } | null
  triggered_at: string
}

const KIND_RANK: Record<SignalEventKind, number> = {
  rearmed: 0,
  resolved: 0,
  invalidated: 1,
  zone_entered: 2,
  triggered: 3,
}

/** Does this event satisfy a rule (symbol, signal, and minimum severity)? */
export function ruleMatchesEvent(rule: AlertRule, event: SignalEventRecord): boolean {
  if (!rule.enabled) return false
  if (rule.symbol !== "*" && rule.symbol.toUpperCase() !== event.symbol.toUpperCase()) return false
  if (rule.asset_class && rule.asset_class !== event.asset_class) return false
  if (rule.signal_id !== "composite" && rule.signal_id !== event.signal_id) return false
  // Only forward-progress events (entered/triggered) alert; invalidations are
  // informational and only go out if the user explicitly asked for the low bar.
  if (KIND_RANK[event.event_kind] < KIND_RANK[rule.min_event_kind]) return false
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
  black_swan: { zh: "黑天鹅抄底", en: "Black Swan dip" },
  euphoria: { zh: "超涨派发", en: "Euphoria distribution" },
  composite: { zh: "综合信号", en: "Composite signal" },
}

const KIND_LABEL: Record<SignalEventKind, { zh: string; en: string }> = {
  zone_entered: { zh: "进入信号区", en: "entered zone" },
  triggered: { zh: "触发", en: "triggered" },
  invalidated: { zh: "失效", en: "invalidated" },
  resolved: { zh: "解除", en: "resolved" },
  rearmed: { zh: "重置", en: "re-armed" },
}

export interface FormattedAlert {
  title: string
  /** Plain/HTML-ish body suitable for email and Telegram (HTML parse mode). */
  body: string
}

export function formatAlertMessage(event: SignalEventRecord, locale: Locale): FormattedAlert {
  const name = SIGNAL_NAME[event.signal_id] ?? SIGNAL_NAME.composite
  const kind = KIND_LABEL[event.event_kind]
  const dirZh = event.direction === "long" ? "做多/抄底" : "做空/派发"
  const dirEn = event.direction === "long" ? "long / accumulate" : "short / distribute"

  const title =
    locale === "zh"
      ? `${event.symbol} · ${name.zh}${kind.zh}(${event.score.toFixed(0)}/100)`
      : `${event.symbol} · ${name.en} ${kind.en} (${event.score.toFixed(0)}/100)`

  const lines: string[] = []
  if (locale === "zh") {
    lines.push(`<b>${event.symbol}</b> ${name.zh} ${kind.zh} · ${dirZh}`)
    lines.push(`评分 <b>${event.score.toFixed(0)}/100</b>`)
  } else {
    lines.push(`<b>${event.symbol}</b> ${name.en} ${kind.en} · ${dirEn}`)
    lines.push(`Score <b>${event.score.toFixed(0)}/100</b>`)
  }

  const active = event.evidence?.activeSignals ?? []
  if (active.length) {
    lines.push(locale === "zh" ? "证据:" : "Why:")
    for (const s of active.slice(0, 4)) lines.push(`• ${locale === "zh" ? s.labelZh : s.labelEn}`)
  }

  const bt = event.evidence?.backtest
  if (bt && bt.hitRatePct != null && bt.medianReturnPct != null) {
    lines.push(
      locale === "zh"
        ? `历史:${bt.horizonDays}日中位 ${bt.medianReturnPct.toFixed(1)}% · 胜率 ${bt.hitRatePct.toFixed(0)}%`
        : `History: ${bt.horizonDays}d median ${bt.medianReturnPct.toFixed(1)}% · hit-rate ${bt.hitRatePct.toFixed(0)}%`,
    )
  }

  const inval = event.evidence?.invalidationPrice
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
