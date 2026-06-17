"use client"

import { useMemo } from "react"
import { ShieldAlert, TrendingDown } from "lucide-react"

import { InfoTooltip } from "@/components/info-tooltip"
import { usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SignalZone } from "@/app/api/stock/panic-signal/route"

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
        label: locale === "zh" ? "买入窗口开启" : "Buy Window Active",
        sub: locale === "zh"
          ? "多项恐慌信号同时触发，历史数据显示此类时点后12个月正收益概率极高。"
          : "Multiple panic signals triggered. Historical data shows high probability of positive returns 12 months forward.",
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
        "美股恐慌窗口监测（0–100分）",
        "",
        "① VIX ≥ 40（权重45%）：学术研究和实证数据均显示，VIX高于40时买入标普500，随后12个月100%正收益（2016–2024）。",
        "② 高收益债利差 ≥ 600bps（权重30%）：ICE BofA高收益债OAS超过600bps意味着信用市场承压、强制抛售接近尾声，历史上常在股市底部附近。",
        "③ 标普500从52周高点回撤 ≥ 20%（权重25%）：正式熊市区域，结合其他信号放大买入信号。",
        "",
        "窗口触发条件：2个以上信号进入极端买入区，或同时有多个偏高信号叠加。",
        "来源：Yahoo Finance、FRED（BAMLH0A0HYM2）",
        "约5分钟刷新。不构成投资建议。",
      ].join("\n")
    : [
        "US Equity Panic Window Monitor (0–100)",
        "",
        "① VIX ≥ 40 (45% weight): Academic studies and empirical data show buying the S&P 500 when VIX exceeds 40 yields 100% positive 12-month returns (2016–2024).",
        "② HY Spread ≥ 600 bps (30% weight): ICE BofA HY OAS above 600 bps signals forced selling near exhaustion and historically precedes equity recoveries.",
        "③ SPX 52-week drawdown ≥ 20% (25% weight): Official bear market territory — amplifies other buy signals.",
        "",
        "Window triggers when 2+ signals reach extreme or multiple signals are elevated.",
        "Sources: Yahoo Finance, FRED (BAMLH0A0HYM2)",
        "Refreshes ~5 min. Not investment advice.",
      ].join("\n")

  return (
    <div className={cn("rounded-lg border bg-card/95 px-3 py-2.5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold tracking-tight text-foreground">
            {locale === "zh" ? "美股恐慌买入窗口" : "Panic Buy Window"}
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
