"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  type BarPrice,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Logical,
  type LogicalRange,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from "lightweight-charts"

import { InfoTooltip } from "@/components/info-tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type AlignedHistoryUnit = "usd" | "pct" | "ratio" | "raw" | "count"

export interface AlignedHistoryPoint {
  time: number
  value: number | null
}

export interface AlignedHistorySeries {
  key: string
  label: string
  paneIndex: number
  color: string
  unit: AlignedHistoryUnit
  data: AlignedHistoryPoint[]
}

export interface AlignedHistoryData {
  timeline: number[]
  series: AlignedHistorySeries[]
}

interface SeriesGroup {
  paneIndex: number
  specs: AlignedHistorySeries[]
}

interface PaneChart {
  paneIndex: number
  specs: AlignedHistorySeries[]
  chart: IChartApi
  anchorSeries: ISeriesApi<"Line">
  seriesByKey: Map<string, ISeriesApi<"Line">>
  rawByKey: Map<string, Map<number, number>>
}

export interface AlignedHistoryCompareProps {
  data: AlignedHistoryData | null
  title: string
  infoDescription: string
  infoSource: string
  loading: boolean
  error: string | null
  loadingLabel: string
  noDataLabel: string
  seriesCountLabel: string
  className?: string
}

const toUtc = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp
const LWC_VALUE_CAP = 8.9e13

function formatRaw(value: number, unit: AlignedHistoryUnit): string {
  if (!Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  switch (unit) {
    case "usd":
      if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
      if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
      if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
      if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
      return `$${value.toFixed(2)}`
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

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

type AlignedLineData = Array<LineData<Time> | WhitespaceData<Time>>

function getValidPointMap(points: AlignedHistoryPoint[]): Map<UTCTimestamp, number> {
  const validPoints = new Map<UTCTimestamp, number>()
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value) || Math.abs(point.value) >= LWC_VALUE_CAP) continue
    validPoints.set(toUtc(point.time), point.value)
  }
  return validPoints
}

function toLineData(points: AlignedHistoryPoint[], timeline: number[]): AlignedLineData {
  const valuesByTime = getValidPointMap(points)
  const timelineSeconds = Array.from(new Set([...timeline.map(toUtc), ...valuesByTime.keys()])).sort((a, b) => a - b)

  if (timelineSeconds.length === 0) {
    return Array.from(valuesByTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([time, value]) => ({ time, value }))
  }

  return timelineSeconds.map((time) => {
    const value = valuesByTime.get(time)
    return value === undefined ? { time } : { time, value }
  })
}

function toTimelineAnchorData(timeline: number[]): WhitespaceData<Time>[] {
  return Array.from(new Set(timeline.map(toUtc)))
    .sort((a, b) => a - b)
    .map((time) => ({ time }))
}

function summarize(points: AlignedHistoryPoint[]): { first: number; last: number; pct: number } | null {
  let first: number | null = null
  let last: number | null = null
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value)) continue
    if (first === null) first = point.value
    last = point.value
  }
  if (first === null || last === null) return null
  const pct = first !== 0 ? (last / first - 1) * 100 : 0
  return { first, last, pct }
}

function groupSeries(series: AlignedHistorySeries[]): SeriesGroup[] {
  const byPane = new Map<number, AlignedHistorySeries[]>()
  for (const spec of series) {
    const specs = byPane.get(spec.paneIndex)
    if (specs) {
      specs.push(spec)
    } else {
      byPane.set(spec.paneIndex, [spec])
    }
  }

  return Array.from(byPane.entries())
    .sort(([a], [b]) => a - b)
    .map(([paneIndex, specs]) => ({ paneIndex, specs }))
}

function getTimelineRange(timeline: number[]): { from: UTCTimestamp; to: UTCTimestamp } | null {
  if (timeline.length < 2) return null
  return { from: toUtc(timeline[0]), to: toUtc(timeline[timeline.length - 1]) }
}

function shouldShowTime(timeline: number[]): boolean {
  if (timeline.length < 2) return false
  const spanMs = timeline[timeline.length - 1] - timeline[0]
  return spanMs <= 3 * 24 * 60 * 60 * 1000
}

export function AlignedHistoryCompare({
  data,
  title,
  infoDescription,
  infoSource,
  loading,
  error,
  loadingLabel,
  noDataLabel,
  seriesCountLabel,
  className,
}: AlignedHistoryCompareProps) {
  const { locale } = useI18n()
  const gridRef = useRef<HTMLDivElement | null>(null)
  const chartsRef = useRef<PaneChart[]>([])
  const hiddenRef = useRef<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const groups = useMemo(() => (data ? groupSeries(data.series) : []), [data])

  useEffect(() => {
    hiddenRef.current = hidden
  }, [hidden])

  useEffect(() => {
    if (!gridRef.current || !data || data.series.length === 0) return
    const grid = gridRef.current

    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
    const textColor = isDark ? "rgba(229,231,235,0.85)" : "rgba(30,41,59,0.85)"
    const gridColor = isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"
    const sharedRange = getTimelineRange(data.timeline)
    const timeVisible = shouldShowTime(data.timeline)
    const timelineAnchorData = toTimelineAnchorData(data.timeline)
    const sharedLogicalRange =
      timelineAnchorData.length > 1
        ? ({ from: 0 as Logical, to: (timelineAnchorData.length - 1) as Logical } satisfies LogicalRange)
        : null

    const panes: PaneChart[] = []
    groups.forEach((group, groupIndex) => {
      const containerEl = grid.querySelector<HTMLDivElement>(`[data-pane="${group.paneIndex}"]`)
      if (!containerEl) return
      const showsSharedXAxis = groupIndex === groups.length - 1
      const chart = createChart(containerEl, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor,
          fontSize: 9,
          attributionLogo: false,
        },
        grid: { vertLines: { visible: false }, horzLines: { color: gridColor } },
        rightPriceScale: {
          visible: true,
          borderVisible: false,
          scaleMargins: { top: 0.1, bottom: 0.1 },
          entireTextOnly: true,
          minimumWidth: 84,
        },
        timeScale: {
          visible: showsSharedXAxis,
          borderVisible: false,
          timeVisible,
          secondsVisible: false,
          rightOffset: 0,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
        },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { width: 1 }, horzLine: { visible: false } },
        handleScroll: false,
        handleScale: false,
      })

      const anchorSeries = chart.addSeries(LineSeries, {
        color: "rgba(0,0,0,0)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceScaleId: "timeline-anchor",
      })
      anchorSeries.setData(timelineAnchorData)

      const seriesByKey = new Map<string, ISeriesApi<"Line">>()
      const rawByKey = new Map<string, Map<number, number>>()
      for (const spec of group.specs) {
        const series = chart.addSeries(LineSeries, {
          color: spec.color,
          lineWidth: group.specs.length === 1 ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 3,
          priceFormat: {
            type: "custom",
            formatter: (value: BarPrice) => formatRaw(value, spec.unit),
            minMove: 0.0001,
          },
        })
        const lineData = toLineData(spec.data, data.timeline)
        series.setData(lineData)
        seriesByKey.set(spec.key, series)

        const rawByTime = new Map<number, number>()
        for (const [time, value] of getValidPointMap(spec.data)) rawByTime.set(time, value)
        rawByKey.set(spec.key, rawByTime)
      }

      if (sharedRange) chart.timeScale().setVisibleRange(sharedRange)
      if (sharedLogicalRange) {
        chart.timeScale().setVisibleLogicalRange(sharedLogicalRange)
      } else {
        chart.timeScale().fitContent()
      }

      panes.push({
        paneIndex: group.paneIndex,
        specs: group.specs,
        chart,
        anchorSeries,
        seriesByKey,
        rawByKey,
      })
    })
    chartsRef.current = panes

    let syncing = false
    const syncRange = (sourceIndex: number) => (range: LogicalRange | null) => {
      if (syncing || !range) return
      syncing = true
      try {
        for (let index = 0; index < panes.length; index += 1) {
          if (index === sourceIndex) continue
          panes[index].chart.timeScale().setVisibleLogicalRange(range)
        }
      } finally {
        syncing = false
      }
    }
    panes.forEach((pane, index) => {
      pane.chart.timeScale().subscribeVisibleLogicalRangeChange(syncRange(index))
    })

    let crosshairSyncing = false
    const getCrosshairSeed = (pane: PaneChart, time: Time): { series: ISeriesApi<"Line">; value: number } | null => {
      if (typeof time !== "number") return null
      for (const spec of pane.specs) {
        if (hiddenRef.current.has(spec.key)) continue
        const series = pane.seriesByKey.get(spec.key)
        const value = pane.rawByKey.get(spec.key)?.get(time)
        if (series && value !== undefined) return { series, value }
      }
      return { series: pane.anchorSeries, value: 0 }
    }
    const onCrosshair = (sourceIndex: number) => (param: MouseEventParams) => {
      if (crosshairSyncing) return
      crosshairSyncing = true
      try {
        if (!param.time) {
          setHoverTime(null)
          for (let index = 0; index < panes.length; index += 1) {
            if (index === sourceIndex) continue
            panes[index].chart.clearCrosshairPosition()
          }
          return
        }
        setHoverTime(param.time as number)
        for (let index = 0; index < panes.length; index += 1) {
          if (index === sourceIndex) continue
          const seed = getCrosshairSeed(panes[index], param.time)
          if (seed) {
            panes[index].chart.setCrosshairPosition(seed.value, param.time, seed.series)
          } else {
            panes[index].chart.clearCrosshairPosition()
          }
        }
      } finally {
        crosshairSyncing = false
      }
    }
    panes.forEach((pane, index) => {
      pane.chart.subscribeCrosshairMove(onCrosshair(index))
    })

    return () => {
      chartsRef.current = []
      for (const pane of panes) pane.chart.remove()
    }
  }, [data, groups])

  useEffect(() => {
    for (const pane of chartsRef.current) {
      for (const spec of pane.specs) {
        pane.seriesByKey.get(spec.key)?.applyOptions({ visible: !hidden.has(spec.key) })
      }
    }
  }, [hidden])

  const toggle = (key: string) =>
    setHidden((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

  const summaries = useMemo(() => {
    const out = new Map<string, { first: number; last: number; pct: number }>()
    if (!data) return out
    for (const series of data.series) {
      const summary = summarize(series.data)
      if (summary) out.set(series.key, summary)
    }
    return out
  }, [data])

  const hoverRaws = useMemo(() => {
    const out = new Map<string, number>()
    if (hoverTime === null) return out
    for (const pane of chartsRef.current) {
      for (const spec of pane.specs) {
        const value = pane.rawByKey.get(spec.key)?.get(hoverTime)
        if (value !== undefined) out.set(spec.key, value)
      }
    }
    return out
  }, [hoverTime])

  const hoverDateLabel = useMemo(() => {
    if (hoverTime === null) return null
    return new Date(hoverTime * 1000).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "2-digit",
      month: "short",
      day: "2-digit",
    })
  }, [hoverTime, locale])

  const visibleSeriesCount = useMemo(() => {
    if (!data) return 0
    return data.series.reduce((count, spec) => count + (hidden.has(spec.key) ? 0 : 1), 0)
  }, [data, hidden])

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{title}</CardTitle>
            <InfoTooltip title={title} description={infoDescription} source={infoSource} />
          </div>
          {data && (
            <span className="text-[10px] text-muted-foreground">
              {hoverDateLabel ? `${hoverDateLabel} · ` : ""}
              {visibleSeriesCount}/{data.series.length} {seriesCountLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {error ? (
          <p className="py-12 text-center text-xs text-destructive">{error}</p>
        ) : loading && !data ? (
          <p className="py-12 text-center text-xs text-muted-foreground">{loadingLabel}</p>
        ) : !data || data.series.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">{noDataLabel}</p>
        ) : (
          <div ref={gridRef} className="flex flex-col gap-1">
            {groups.map((group, groupIndex) => (
              <section
                key={group.paneIndex}
                className="border-t border-border/60 pt-1 first:border-t-0 first:pt-0"
              >
                <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {group.specs.map((spec) => {
                    const summary = summaries.get(spec.key)
                    const hoverRaw = hoverRaws.get(spec.key)
                    const liveValue = hoverTime !== null ? hoverRaw : summary?.last
                    const livePct =
                      hoverTime !== null && hoverRaw === undefined
                        ? undefined
                        : hoverRaw !== undefined && summary && summary.first !== 0
                          ? (hoverRaw / summary.first - 1) * 100
                          : summary?.pct
                    const isHidden = hidden.has(spec.key)
                    const pctTone =
                      livePct === undefined
                        ? "text-muted-foreground"
                        : livePct >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                    return (
                      <button
                        key={spec.key}
                        type="button"
                        onClick={() => toggle(spec.key)}
                        aria-pressed={!isHidden}
                        className={cn(
                          "inline-flex max-w-full items-baseline gap-1 truncate text-left tabular-nums transition-opacity hover:text-foreground",
                          isHidden ? "opacity-35" : "opacity-100",
                        )}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: spec.color }}
                        />
                        <span className="truncate text-[10px] font-medium leading-none" title={spec.label}>
                          {spec.label}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold leading-none">
                          {liveValue !== undefined ? formatRaw(liveValue, spec.unit) : "—"}
                        </span>
                        <span className={cn("shrink-0 text-[9px] leading-none", pctTone)}>
                          {livePct !== undefined ? formatPct(livePct) : ""}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div
                  data-pane={group.paneIndex}
                  className={cn("w-full", groupIndex === groups.length - 1 ? "h-[120px]" : "h-[108px]")}
                />
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
