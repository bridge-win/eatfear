"use client"

import { useMemo } from "react"
import { ShieldAlert, TrendingDown } from "lucide-react"

import { InfoTooltip } from "@/components/info-tooltip"
import { usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SignalZone } from "@/lib/api-routes/stock/panic-signal/route"

const REFRESH_MS = 5 * 60 * 1000

interface PanicSignalPayload {
  updatedAt: number
  compositeScore: number
  windowBand: "active" | "watch" | "none"
  signals: {
    vix: { value: number | null; zone: SignalZone; thresholds: { extreme: number; elevated: number }; unit: string }
    hySpread: { value: number | null; zone: SignalZone; thresholds: { extreme: number; elevated: number }; unit: string }
    spxDrawdown: { value: number | null; zone: SignalZone; thresholds: { extreme: number; elevated: number }; unit: string }
  }
  upstream: Record<string, string>
}

async function fetcher(url: string): Promise<PanicSignalPayload> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Panic signal unavailable")
  return res.json() as Promise<PanicSignalPayload>
}

function zonePill(zone: SignalZone, locale: string): { label: string; className: string } {
  switch (zone) {
    case "extreme_buy":
      return {
        label: locale === "zh" ? "极端买入区" : "Extreme Buy",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      }
    case "elevated":
      return {
        label: locale === "zh" ? "偏高恐慌" : "Elevated",
        className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      }
    case "watch":
      return {
        label: locale === "zh" ? "关注" : "Watch",
        className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
      }
    default:
      return {
        label: locale === "zh" ? "正常" : "Neutral",
        className: "bg-muted/40 text-muted-foreground border-border/50",
      }
  }
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "—"
  switch (unit) {
    case "bps":
      return `${Math.round(value)} bps`
    case "pct":
      return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
    default:
      return value.toFixed(1)
  }
}

function SignalRow({
  name,
  value,
  unit,
  zone,
  thresholds,
}: {
  name: string
  value: number | null
  unit: string
  zone: SignalZone
  thresholds: { extreme: number; elevated: number }
}) {
  const { locale } = useI18n()
  const pill = zonePill(zone, locale)
  const thresholdStr =
    unit === "bps"
      ? `>${thresholds.elevated} bps`
      : unit === "pct"
        ? `<${thresholds.elevated}%`
        : `>${thresholds.elevated}`

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-foreground">{name}</p>
        <p className="text-[10px] text-muted-foreground">{thresholdStr}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[12px] font-mono tabular-nums text-foreground">{formatValue(value, unit)}</span>
        <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", pill.className)}>
          {pill.label}
        </span>
      </div>
    </div>
  )
}

export function StockPanicSignalCard({ className }: { className?: string }) {
  const { locale } = useI18n()

  const swr = usePersistentSWR<PanicSignalPayload>(
    "stock:panic-signal",
    "/api/stock/panic-signal",
    fetcher,
    { refreshInterval: REFRESH_MS },
  )

  const payload = swr.data ?? null
  const loading = swr.isLoading && !payload

  const { windowBand, signals } = payload ?? {}

  const bandConfig = useMemo(() => {
    if (!windowBand || windowBand === "none") return null
    if (windowBand === "active") {
      return {
        label: locale === "zh" ? "历史性偏低估区间" : "Historically Attractive",
        sub: locale === "zh"
          ? "多项恐慌指标同时偏高。历史上此类条件对应较好的6–12个月远期收益，但不是择时信号——指标可能持续数月而价格继续下跌（如2008年）。倾向分批加仓而非一次抄底。"
          : "Multiple panic gauges elevated together. Such conditions historically map to above-average 6–12 month forward returns — but this is not a timing signal: gauges can stay extreme for months while prices fall further (e.g. 2008). Lean in via staged buying, don't try to call the bottom.",
        className: "border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
      }
    }
    return {
      label: locale === "zh" ? "信号观察中" : "Signals to Watch",
      sub: locale === "zh" ? "部分恐慌指标偏高，持续监控中。" : "Some panic indicators elevated. Monitoring.",
      className: "border-amber-500/40 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    }
  }, [windowBand, locale])

  const tooltipContent = locale === "zh"
    ? [
        "美股恐慌条件监测（0–100分，远期胜率视角，非择时信号）",
        "",
        "① VIX ≥ 40（权重45%）：自1990年起，VIX收盘高于40后，标普500在12个月后约90%概率上涨（均值约+30%）——并非“100%”。2008年VIX持续高于40达8个月，期间标普继续下跌约50%，是典型失败案例。",
        "② 高收益债利差（权重30%）：ICE BofA高收益债OAS长期中位数约400–500bps，因此400bps是常态而非“偏高”。真正的压力区在800bps以上（2011、2016），恐慌区在1000bps以上（2008达2182、2020达1087）。利差见顶通常滞后于股市见底，是压力计而非抄底信号。",
        "③ 标普500从52周高点回撤 ≥ 20%（权重25%）：正式熊市区域。",
        "",
        "重要：以上指标可能持续数月处于极值而价格继续下跌（结构性熊市）。研究显示，对多数人而言定投/分批买入长期胜过抄底择时。请视为“偏低估的条件区间”，倾向加快定投，而非一次性抄底。",
        "来源：Yahoo Finance、FRED（BAMLH0A0HYM2）、Wells Fargo、Hartford Funds、Vanguard",
        "约5分钟刷新。不构成投资建议。",
      ].join("\n")
    : [
        "US Equity Panic-Conditions Monitor (0–100; forward-odds view, not a timing signal)",
        "",
        "① VIX ≥ 40 (45% weight): Since 1990, the S&P 500 has been higher 12 months after a >40 close ~90% of the time (avg ~+30%) — NOT 100%. In 2008 VIX stayed above 40 for ~8 months while stocks fell another ~50% (the textbook failure case).",
        "② HY Spread (30% weight): ICE BofA HY OAS has a long-run median of ~400–500 bps, so 400 is baseline, not 'elevated'. Real distress is 800+ bps (2011, 2016); panic is 1000+ (2008: 2182, 2020: 1087). Spread peaks LAG equity bottoms — this is a stress gauge, not an exhaustion/buy trigger.",
        "③ SPX 52-week drawdown ≥ 20% (25% weight): Official bear-market territory.",
        "",
        "Important: these gauges can stay at extremes for months while prices keep falling (structural bears). Research shows dollar-cost averaging beats dip-timing for most people. Read this as 'historically attractive conditions' — accelerate scheduled buying, don't try to call the bottom.",
        "Sources: Yahoo Finance, FRED (BAMLH0A0HYM2), Wells Fargo, Hartford Funds, Vanguard",
        "Refreshes ~5 min. Not investment advice.",
      ].join("\n")

  return (
    <div className={cn("rounded-lg border bg-card/95 px-3 py-2.5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold tracking-tight text-foreground">
            {locale === "zh" ? "美股恐慌条件监测" : "Panic Conditions"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {payload && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {locale === "zh" ? "综合分" : "Score"}: {payload.compositeScore}
            </span>
          )}
          <InfoTooltip description={tooltipContent} />
        </div>
      </div>

      {loading ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{locale === "zh" ? "加载中…" : "Loading…"}</p>
      ) : !signals ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{locale === "zh" ? "数据不可用" : "Data unavailable"}</p>
      ) : (
        <>
          {bandConfig && (
            <div className={cn("mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5", bandConfig.className)}>
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold">{bandConfig.label}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed opacity-80">{bandConfig.sub}</p>
              </div>
            </div>
          )}
          <div className="mt-1 divide-y divide-border/50">
            <SignalRow
              name={locale === "zh" ? "VIX 恐慌指数" : "VIX Fear Index"}
              value={signals.vix.value}
              unit={signals.vix.unit}
              zone={signals.vix.zone}
              thresholds={signals.vix.thresholds}
            />
            <SignalRow
              name={locale === "zh" ? "高收益债利差" : "HY Credit Spread"}
              value={signals.hySpread.value}
              unit={signals.hySpread.unit}
              zone={signals.hySpread.zone}
              thresholds={signals.hySpread.thresholds}
            />
            <SignalRow
              name={locale === "zh" ? "标普500回撤" : "SPX Drawdown"}
              value={signals.spxDrawdown.value}
              unit={signals.spxDrawdown.unit}
              zone={signals.spxDrawdown.zone}
              thresholds={signals.spxDrawdown.thresholds}
            />
          </div>
        </>
      )}
    </div>
  )
}
