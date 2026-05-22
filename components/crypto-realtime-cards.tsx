"use client"

import { RefreshCw } from "lucide-react"

import { getCryptoIndicatorDescription } from "@/components/crypto-indicator-info"
import type { CryptoHistoryPayload, CryptoHistorySeries } from "@/components/crypto-history-compare"
import { InfoPopover } from "@/components/info-popover"
import { useT } from "@/lib/i18n"
import { withRelevanceScore } from "@/lib/indicator-score"
import { cn } from "@/lib/utils"

interface CryptoRealtimeCardsProps {
  payload: CryptoHistoryPayload | null
  loading: boolean
  error: string | null
  onSelectSeries?: (key: string) => void
  className?: string
}

interface SeriesSummary {
  first: number
  last: number
  pct: number
  timestamp: number
}

function formatValue(value: number, unit: CryptoHistorySeries["unit"]): string {
  if (!Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  switch (unit) {
    case "usd":
    case "cny": {
      const prefix = unit === "cny" ? "¥" : "$"
      if (abs >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`
      if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(2)}K`
      return `${prefix}${value.toFixed(2)}`
    }
    case "pct":
      return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`
    case "ratio":
      return value.toFixed(3)
    case "count":
      if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`
      return value.toFixed(0)
    default:
      if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`
      return value.toFixed(2)
  }
}

function summarize(series: CryptoHistorySeries): SeriesSummary | null {
  let first: number | null = null
  let last: number | null = null
  let timestamp = 0
  for (const point of series.data) {
    if (point.value === null || !Number.isFinite(point.value)) continue
    if (first === null) first = point.value
    last = point.value
    timestamp = point.time
  }
  if (first === null || last === null) return null
  return {
    first,
    last,
    pct: first !== 0 ? (last / first - 1) * 100 : 0,
    timestamp,
  }
}

function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—"
  return new Date(timestamp).toISOString().slice(0, 10)
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

export function CryptoRealtimeCards({
  payload,
  loading,
  error,
  onSelectSeries,
  className,
}: CryptoRealtimeCardsProps) {
  const t = useT()

  if (error) {
    return (
      <div
        className={cn(
          "rounded-md border border-destructive/40 px-3 py-8 text-center text-xs text-destructive",
          className,
        )}
      >
        {error}
      </div>
    )
  }

  if (loading && !payload) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        {t("compare.loading")}
      </div>
    )
  }

  if (!payload || payload.series.length === 0) {
    return (
      <div className={cn("rounded-md border px-3 py-8 text-center text-xs text-muted-foreground", className)}>
        {t("chart.noData")}
      </div>
    )
  }

  return (
    <div
      data-crypto-realtime-grid
      className={cn("grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6", className)}
    >
      {payload.series.map((series) => {
        const label = withRelevanceScore(t(series.i18nKey), series.relevanceScore)
        const summary = summarize(series)
        const pctTone =
          !summary
            ? "text-muted-foreground"
            : summary.pct >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        const fullInfoDescription = getCryptoIndicatorDescription({ payload, series, t })
        return (
          <article
            key={series.key}
            data-crypto-realtime-card
            data-series-key={series.key}
            data-series-order={series.order}
            role={onSelectSeries ? "button" : undefined}
            tabIndex={onSelectSeries ? 0 : undefined}
            onClick={() => onSelectSeries?.(series.key)}
            onKeyDown={(event) => {
              if (!onSelectSeries) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelectSeries(series.key)
              }
            }}
            className={cn(
              "min-w-0 rounded-md border bg-card/80 px-2.5 py-2 shadow-sm",
              onSelectSeries && "cursor-pointer transition-colors hover:border-foreground/30 hover:bg-muted/30",
            )}
          >
            <header className="flex min-w-0 items-start justify-between gap-1.5">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground">
                    #{String(series.order).padStart(2, "0")}
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: series.color }} />
                  <h3 className="truncate text-[11px] font-medium leading-4" title={label}>
                    {label}
                  </h3>
                </div>
              </div>
              <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <InfoPopover
                  title={`#${String(series.order).padStart(2, "0")} ${label}`}
                  description={fullInfoDescription}
                  source={series.source}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  iconClassName="h-3 w-3"
                  contentClassName="w-[30rem]"
                />
              </span>
            </header>

            <div className="mt-2 flex items-end justify-between gap-1.5">
              <p className="min-w-0 truncate text-lg font-semibold leading-5 tabular-nums">
                {summary ? formatValue(summary.last, series.unit) : "—"}
              </p>
              <p className={cn("shrink-0 text-[10px] font-medium tabular-nums", pctTone)}>
                {summary ? formatPct(summary.pct) : "—"}
              </p>
            </div>
            <p className="mt-1 truncate text-[9px] text-muted-foreground">
              {summary ? formatDate(summary.timestamp) : "—"}
            </p>
          </article>
        )
      })}
    </div>
  )
}
