"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Flame, Sparkles, TrendingUp } from "lucide-react"

import { ScoreIndexCard } from "@/components/score-index-card"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type {
  BlackSwanActiveSignal,
  BlackSwanBand,
  BlackSwanWickEvent,
} from "@/lib/black-swan-detector"

const REFRESH_MS = 60 * 1000

interface FactorPayload {
  id: string
  labelZh: string
  labelEn: string
  score: number
  weight: number
  weighted: number
  lines: string[]
}

interface Payload {
  ccy: string
  updatedAt: number
  summary: {
    opportunityScore: number
    band: BlackSwanBand
    signalZh: string
    signalEn: string
  }
  factors: FactorPayload[]
  activeSignals: BlackSwanActiveSignal[]
  recentWicks: BlackSwanWickEvent[]
  upstream: Record<string, string>
  weights: Record<string, string>
  error?: string
}

function bandStyles(band: BlackSwanBand): string {
  switch (band) {
    case "generational":
      return "text-purple-600 dark:text-purple-400"
    case "strong":
      return "text-emerald-600 dark:text-emerald-400"
    case "building":
      return "text-teal-600 dark:text-teal-400"
    case "watch":
      return "text-amber-600 dark:text-amber-400"
    default:
      return "text-muted-foreground"
  }
}

function severityClass(sev: BlackSwanActiveSignal["severity"]): string {
  switch (sev) {
    case "alert":
      return "border-red-500/40 bg-red-500/8 text-red-600 dark:text-red-300"
    case "warn":
      return "border-amber-500/40 bg-amber-500/8 text-amber-600 dark:text-amber-300"
    default:
      return "border-border bg-muted/40 text-foreground"
  }
}

function severityIcon(sev: BlackSwanActiveSignal["severity"]) {
  switch (sev) {
    case "alert":
      return <Flame className="h-3 w-3" />
    case "warn":
      return <AlertTriangle className="h-3 w-3" />
    default:
      return <Sparkles className="h-3 w-3" />
  }
}

async function fetchPayload(ccy: string): Promise<Payload> {
  const res = await fetch(`/api/crypto/black-swan?ccy=${encodeURIComponent(ccy)}`)
  const json = (await res.json()) as Payload
  if (!res.ok || !json.summary) throw new Error(json.error ?? "Black-swan score unavailable")
  return json
}

function HoverContents({
  payload,
  loading,
  error,
  updatedHint,
}: {
  payload: Payload | null
  loading: boolean
  error: string | null
  updatedHint: string
}) {
  const { locale, t } = useI18n()

  if (loading) return <p className="px-3 py-3 text-[11px] text-muted-foreground">{t("blackSwan.hover.loading")}</p>
  if (error) return <p className="px-3 py-3 text-[11px] text-destructive">{error}</p>
  if (!payload) return null
  const ccy = payload.ccy || "BTC"

  const modelLines =
    locale === "zh"
      ? [
          `${ccy} 黑天鹅机会指数（0–100）由 10 个因子加权合成，识别极端恐慌、强制爆仓和价值脱离区。`,
          "",
          `① 插针出清 (20%)：${ccy} 日线下影线占比 + 60 期 z-score。`,
          "② 极度恐慌 (18%)：alternative.me F&G + 7 期下行加速。",
          `③ 杠杆出清 (13%)：${ccy} 永续费率 + OI 24 期变动（强平 ≥ 8%）。`,
          `④ 回撤幅度 (12%)：${ccy} 现价较 90 日高点的距离。`,
          `⑤ 均值回归 (8%)：${ccy} 7 期收益 z-score + 20SMA 偏离。`,
          "⑥ 宏观避险 (10%)：VIX 飙升识别跨资产恐慌。",
          `⑦ 成交高潮 (5%)：${ccy} 日线量能 z-score。`,
          "⑧ BTC 矿工哈希带 (7%)：30/60 日算力均线交叉 + MA10 复苏信号。",
          `⑨ Mayer 倍数 (4%)：${ccy} 现价 / 200 日均线，< 0.8 = 积累区。`,
          "⑩ Puell 倍数 (3%)：日矿工收入 / 365 日均值，< 0.5 = 矿工底部。",
          "",
          "信号带：85+ 世代级 · 70+ 强机会 · 50+ 成型 · 30+ 观察 · 否则无机会。",
          "三个 alert 信号叠加额外 +6 分（confluence boost）。",
          "",
          "约 60 秒刷新。不构成投资建议。",
        ].join("\n")
      : [
          `${ccy} Black Swan Opportunity Index (0–100) — 10 factors composited to identify capitulation, forced flushes, and price-value disconnects.`,
          "",
          `① Wick capitulation (20%): ${ccy} daily lower-wick ratio + 60-bar z-score.`,
          "② Fear extreme (18%): F&G index + 7-print panic acceleration.",
          `③ Leverage flush (13%): ${ccy} funding + OI 24-print delta (>=8% drop = flush).`,
          `④ Drawdown (12%): ${ccy} close vs 90d high.`,
          `⑤ Mean reversion (8%): ${ccy} 7-bar return z + 20-SMA gap.`,
          "⑥ Macro risk-off (10%): VIX spike across risk assets.",
          `⑦ Volume climax (5%): ${ccy} daily volume z-score.`,
          "⑧ BTC Hash Ribbon (7%): 30d/60d hashrate MA crossover + MA10 recovery signal.",
          `⑨ Mayer Multiple (4%): ${ccy} price / 200d SMA; < 0.8 = accumulation zone.`,
          "⑩ Puell Multiple (3%): daily miner revenue / 365d avg — < 0.5 = miner bottom.",
          "",
          "Bands: 85+ generational · 70+ strong · 50+ building · 30+ watch · else none.",
          "Three alert-tier signals stacked adds +6 confluence boost.",
          "",
          "Refreshes ~60s. Not investment advice.",
        ].join("\n")

  return (
    <div className="space-y-3 px-3 py-2.5 text-left">
      <p className="text-[10px] text-muted-foreground">
        {updatedHint ? `${updatedHint} · ` : ""}
        {t("blackSwan.hover.refreshHint")}
      </p>

      {payload.activeSignals.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground">{t("blackSwan.hover.activeTitle")}</p>
          <ul className="mt-1 space-y-1">
            {payload.activeSignals.map((sig) => (
              <li
                key={sig.code}
                className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10.5px] leading-snug", severityClass(sig.severity))}
              >
                {severityIcon(sig.severity)}
                <span className="font-medium">{locale === "zh" ? sig.labelZh : sig.labelEn}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.factors.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-foreground">{t("blackSwan.hover.factorsTitle")}</p>
          <div className="space-y-1.5">
            {payload.factors.map((f) => {
              const weightPct = Math.round(f.weight * 100)
              return (
                <div key={f.id} className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold text-foreground">
                      {locale === "zh" ? f.labelZh : f.labelEn}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {f.score.toFixed(1)} · {weightPct}% · w {f.weighted.toFixed(1)}
                    </p>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {f.lines.map((line, idx) => (
                      <li key={idx} className="text-[10.5px] leading-relaxed text-muted-foreground">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {payload.recentWicks.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{t("blackSwan.hover.wicksTitle")}</p>
          <ul className="space-y-1">
            {payload.recentWicks.slice(0, 6).map((w) => {
              const date = new Date(w.time).toISOString().slice(0, 10)
              const reboundTone =
                w.rebound24hPct === null
                  ? "text-muted-foreground"
                  : w.rebound24hPct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
              return (
                <li
                  key={w.time}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/55 bg-muted/15 px-2 py-1 text-[10.5px]"
                >
                  <span className="font-medium tabular-nums">{date}</span>
                  <span className="text-muted-foreground">
                    wick {(w.lowerWickRatio * 100).toFixed(0)}% · volZ {w.volumeZ.toFixed(1)}
                  </span>
                  <span className={cn("flex items-center gap-1 tabular-nums", reboundTone)}>
                    {w.rebound24hPct !== null && w.rebound24hPct >= 0 && <TrendingUp className="h-3 w-3" />}
                    {w.rebound24hPct === null ? "—" : `${w.rebound24hPct >= 0 ? "+" : ""}${w.rebound24hPct.toFixed(2)}%`}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="rounded-md border border-border/55 bg-muted/20 px-2 py-2">
        <p className="text-xs font-semibold text-foreground">{t("blackSwan.hover.modelTitle")}</p>
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{modelLines}</p>
        <p className="mt-2 text-[10px] text-muted-foreground/80">
          {Object.values(payload.upstream).join(" · ")}
        </p>
      </section>
    </div>
  )
}

export function BlackSwanOpportunityCard({
  className,
  instId = "BTC-USDT-SWAP",
}: {
  className?: string
  instId?: string
}) {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { locale, t } = useI18n()
  const ccy = instId.split("-")[0] ?? "BTC"

  useEffect(() => {
    let isActive = true

    async function load() {
      try {
        setError(null)
        const next = await fetchPayload(ccy)
        if (isActive) setPayload(next)
      } catch (e) {
        if (isActive) setError(e instanceof Error ? e.message : "load failed")
      } finally {
        if (isActive) setLoading(false)
      }
    }

    setPayload(null)
    setLoading(true)
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      isActive = false
      window.clearInterval(timer)
    }
  }, [ccy])

  const updatedHint = useMemo(() => {
    if (!payload?.updatedAt) return ""
    try {
      return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(payload.updatedAt)
    } catch {
      return ""
    }
  }, [payload?.updatedAt, locale])

  const valueText = loading ? "…" : error ? "—" : payload ? Math.round(payload.summary.opportunityScore) : "—"
  const toneClass = error
    ? "text-muted-foreground"
    : payload
      ? bandStyles(payload.summary.band)
      : "text-foreground"

  const signal = loading
    ? t("blackSwan.hover.loading")
    : error
      ? error
      : payload
        ? locale === "zh"
          ? payload.summary.signalZh
          : payload.summary.signalEn
        : null

  return (
    <ScoreIndexCard
      className={cn(className)}
      label={t("blackSwan.label", { ccy })}
      value={valueText}
      valueSuffix=" / 100"
      signal={signal}
      toneClassName={toneClass}
      valueAriaLabel={
        loading
          ? t("blackSwan.aria.loading", { ccy })
          : payload
            ? t("blackSwan.aria.value", { ccy, value: Math.round(payload.summary.opportunityScore) })
            : t("blackSwan.aria.idle", { ccy })
      }
      infoAriaLabel={t("blackSwan.hover.aria")}
      infoContent={<HoverContents payload={payload} loading={loading} error={error} updatedHint={updatedHint} />}
    />
  )
}
