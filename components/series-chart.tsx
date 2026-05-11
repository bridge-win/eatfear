"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

export type SeriesChartUnit = "index" | "percent" | "usd" | "ratio" | "count"

export interface SeriesPoint {
  timestamp: number
  value: number
}

interface SeriesChartProps {
  data: SeriesPoint[]
  unit: SeriesChartUnit
  height?: number
  className?: string
  color?: string
  label?: string
  /** Hide left Y axis labels, used in tight cards */
  compact?: boolean
  /** Show subtle grid lines */
  showGrid?: boolean
}

/**
 * Unified series chart used across macro / crypto / stock dashboards.
 * Provides crosshair, formatted x / y axes, and unit-aware tooltips.
 */
export function SeriesChart({
  data,
  unit,
  height = 200,
  className,
  color,
  label = "Value",
  compact = false,
  showGrid = true,
}: SeriesChartProps) {
  const reactId = React.useId()
  const gradientId = `series-chart-gradient-${reactId.replace(/[:]/g, "")}`

  const trendUp = data.length > 1 ? data[data.length - 1].value >= data[0].value : true
  const strokeColor = color ?? (trendUp ? "rgb(22 163 74)" : "rgb(220 38 38)")

  const chartData = React.useMemo(
    () =>
      data.map((point) => ({
        timestamp: point.timestamp,
        value: point.value,
        dateLabel: formatDateLabel(point.timestamp, data.length),
      })),
    [data],
  )

  if (chartData.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-xs text-muted-foreground", className)}
        style={{ height }}
      >
        无数据
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: compact ? -8 : 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />}
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            fontSize={10}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => formatValue(value, unit, true)}
            width={compact ? 38 : 52}
            fontSize={10}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ stroke: strokeColor, strokeDasharray: "3 3", strokeWidth: 1 }}
            content={(props: SeriesTooltipInjectedProps) => (
              <SeriesChartTooltip {...props} unit={unit} label={label} />
            )}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.7}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: strokeColor, stroke: "white", strokeWidth: 1.2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface SeriesTooltipInjectedProps {
  active?: boolean
  payload?: Array<{ payload?: { value: number; timestamp: number } }>
}

interface SeriesChartTooltipProps extends SeriesTooltipInjectedProps {
  unit: SeriesChartUnit
  label: string
}

function SeriesChartTooltip({ active, payload, unit, label }: SeriesChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-[11px] shadow-md">
      <p className="text-muted-foreground">{formatDateLabel(point.timestamp, 365, true)}</p>
      <p className="font-semibold tabular-nums">
        {label}: {formatValue(point.value, unit, false)}
      </p>
    </div>
  )
}

export const formatValue = (value: number, unit: SeriesChartUnit, short = false): string => {
  if (!Number.isFinite(value)) return "-"

  if (unit === "percent") return `${value.toFixed(short ? 1 : 2)}%`
  if (unit === "ratio") return value.toFixed(short ? 2 : 4)

  if (unit === "usd") {
    const abs = Math.abs(value)
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(short ? 1 : 2)}T`
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(short ? 1 : 2)}B`
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(short ? 1 : 2)}M`
    if (abs >= 1e3) return `$${(value / 1e3).toFixed(short ? 1 : 2)}K`
    return `$${value.toFixed(short ? 0 : 2)}`
  }

  if (unit === "count") {
    const abs = Math.abs(value)
    if (abs >= 1e12) return `${(value / 1e12).toFixed(short ? 1 : 2)}T`
    if (abs >= 1e9) return `${(value / 1e9).toFixed(short ? 1 : 2)}B`
    if (abs >= 1e6) return `${(value / 1e6).toFixed(short ? 1 : 2)}M`
    if (abs >= 1e3) return `${(value / 1e3).toFixed(short ? 1 : 2)}K`
    return value.toFixed(0)
  }

  const abs = Math.abs(value)
  if (abs >= 1e3) {
    return value.toLocaleString("en-US", {
      maximumFractionDigits: short ? 0 : 2,
    })
  }
  return value.toFixed(short ? 1 : 2)
}

export const formatDateLabel = (timestamp: number, dataLength: number, verbose = false): string => {
  if (!timestamp) return ""
  const date = new Date(timestamp)
  if (verbose) {
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  if (dataLength <= 60) {
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    })
  }
  if (dataLength <= 365) {
    return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
  }
  return date.toLocaleDateString("zh-CN", { year: "2-digit", month: "2-digit" })
}
