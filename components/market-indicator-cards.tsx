"use client"

import { RefreshCw } from "lucide-react"

import type { AlignedHistoryPoint, AlignedHistoryUnit } from "@/components/aligned-history-compare"
import { InfoPopover } from "@/components/info-popover"
import { cn } from "@/lib/utils"

export interface MarketIndicatorItem {
  key: string
  order: number
  label: string
  color: string
  unit: AlignedHistoryUnit
  value: number | null
  changePercent: number | null
  timestamp: number | null
  source: string
  description: string
  data: AlignedHistoryPoint[]
}

interface MarketIndicatorCardsProps {
  items: MarketIndicatorItem[]
  loading: boolean
  error: string | null
  loadingLabel: string
  noDataLabel: string
  expectedCount?: number
  onSelectItem?: (key: string) => void
  className?: string
  dataPrefix?: string
}

export function formatMarketValue(value: number | null, unit: AlignedHistoryUnit): string {
  if (value === null || !Number.isFinite(value)) return "—"
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

function formatDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatDate(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp) || timestamp <= 0) return "—"
  return new Date(timestamp).toISOString().slice(0, 10)
}

function LoadingCard({ index, dataPrefix }: { index: number; dataPrefix: string }) {
  return (
    <article
      data-market-realtime-card={dataPrefix}
      data-market-loading-card
      data-indicator-order={index + 1}
      className="min-w-0 rounded-md border bg-card/60 px-2.5 py-2 shadow-sm"
    >
      <header className="flex min-w-0 items-start justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
          <span className="h-3 w-28 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
      </header>
      <div className="mt-2 flex items-end justify-between gap-1.5">
        <span className="h-5 w-20 animate-pulse rounded bg-muted" />
        <span className="h-3 w-10 animate-pulse rounded bg-muted" />
      </div>
      <p className="mt-1 h-2.5 w-16 animate-pulse rounded bg-muted" />
    </article>
  )
}

export function MarketIndicatorCards({
  items,
  loading,
  error,
  loadingLabel,
  noDataLabel,
  expectedCount,
  onSelectItem,
  className,
  dataPrefix = "market",
}: MarketIndicatorCardsProps) {
  if (error) {
    return (
      <div className={cn("rounded-md border border-destructive/40 px-3 py-8 text-center text-xs text-destructive", className)}>
        {error}
      </div>
    )
  }

  const placeholderCount = loading ? Math.max(0, (expectedCount ?? items.length) - items.length) : 0
  const emptyPlaceholderCount = Math.max(6, Math.min(expectedCount ?? 6, 12))

  if (loading && items.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          {loadingLabel}
        </div>
        <div
          data-market-realtime-grid={dataPrefix}
          className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
        >
          {Array.from({ length: emptyPlaceholderCount }, (_, index) => (
            <LoadingCard key={`loading-${index}`} index={index} dataPrefix={dataPrefix} />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return <div className={cn("rounded-md border px-3 py-8 text-center text-xs text-muted-foreground", className)}>{noDataLabel}</div>
  }

  return (
    <div
      data-market-realtime-grid={dataPrefix}
      className={cn("grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6", className)}
    >
      {items.map((item) => {
        const isPositive = (item.changePercent ?? 0) >= 0
        return (
          <article
            key={item.key}
            data-market-realtime-card={dataPrefix}
            data-indicator-key={item.key}
            data-indicator-order={item.order}
            role={onSelectItem ? "button" : undefined}
            tabIndex={onSelectItem ? 0 : undefined}
            onClick={() => onSelectItem?.(item.key)}
            onKeyDown={(event) => {
              if (!onSelectItem) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelectItem(item.key)
              }
            }}
            className={cn(
              "min-w-0 rounded-md border bg-card/80 px-2.5 py-2 shadow-sm",
              onSelectItem && "cursor-pointer transition-colors hover:border-foreground/30 hover:bg-muted/30",
            )}
          >
            <header className="flex min-w-0 items-start justify-between gap-1.5">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[9px] font-semibold tabular-nums text-muted-foreground">
                    #{String(item.order).padStart(2, "0")}
                  </span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <h3 className="truncate text-[11px] font-medium leading-4" title={item.label}>
                    {item.label}
                  </h3>
                </div>
              </div>
              <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <InfoPopover
                  title={`#${String(item.order).padStart(2, "0")} ${item.label}`}
                  description={item.description}
                  source={item.source}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  iconClassName="h-3 w-3"
                  contentClassName="w-[30rem]"
                />
              </span>
            </header>
            <div className="mt-2 flex items-end justify-between gap-1.5">
              <p className="min-w-0 truncate text-lg font-semibold leading-5 tabular-nums">
                {formatMarketValue(item.value, item.unit)}
              </p>
              <p
                className={cn(
                  "shrink-0 text-[10px] font-medium tabular-nums",
                  isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {formatDelta(item.changePercent)}
              </p>
            </div>
            <p className="mt-1 truncate text-[9px] text-muted-foreground">{formatDate(item.timestamp)}</p>
          </article>
        )
      })}
      {Array.from({ length: placeholderCount }, (_, index) => (
        <LoadingCard key={`loading-${index}`} index={items.length + index} dataPrefix={dataPrefix} />
      ))}
    </div>
  )
}
