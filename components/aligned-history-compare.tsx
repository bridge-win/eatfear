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
  color: string
  unit: AlignedHistoryUnit
  data: AlignedHistoryPoint[]
}

export interface AlignedHistoryGroup {
  key: string
  label?: string
  series: AlignedHistorySeries[]
}

export interface AlignedHistoryData {
  groups: AlignedHistoryGroup[]
  timeline?: number[]
}

interface SeriesGroup {
  key: string
  label?: string
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
const COMPACT_WIDTH = 560

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
interface PreparedLineSeries {
  lineData: AlignedLineData
  rawByTime: Map<number, number>
}

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

function prepareLineSeries(points: AlignedHistoryPoint[], timeline: number[]): PreparedLineSeries {
  const rawByTime = getValidPointMap(points)
  return {
    lineData: toLineData(points, timeline),
    rawByTime,
  }
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

function getTimeline(data: AlignedHistoryData): number[] {
  const timeline = new Set<number>(data.timeline ?? [])
  for (const group of data.groups) {
    for (const series of group.series) {
      for (const point of series.data) {
        if (Number.isFinite(point.time)) timeline.add(point.time)
      }
    }
  }
  return Array.from(timeline).sort((a, b) => a - b)
}

function getGroups(data: AlignedHistoryData): SeriesGroup[] {
  return data.groups
    .map((group, paneIndex) => ({
      key: group.key,
      label: group.label,
      paneIndex,
      specs: group.series.filter((series) =>
        series.data.some((point) => point.value !== null && Number.isFinite(point.value)),
      ),
    }))
    .filter((group) => group.specs.length > 0)
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
  const cardRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const chartsRef = useRef<PaneChart[]>([])
  const hiddenRef = useRef<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [cardWidth, setCardWidth] = useState(0)
  const groups = useMemo(() => (data ? getGroups(data) : []), [data])
  const timeline = useMemo(() => (data ? getTimeline(data) : []), [data])
  const isCompact = cardWidth > 0 && cardWidth < COMPACT_WIDTH
  const seriesCount = useMemo(() => groups.reduce((count, group) => count + group.specs.length, 0), [groups])

  useEffect(() => {
    hiddenRef.current = hidden
  }, [hidden])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const updateWidth = () => setCardWidth(Math.round(card.getBoundingClientRect().width))
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!data) return
    const validKeys = new Set(groups.flatMap((group) => group.specs.map((spec) => spec.key)))
    setHidden((previous) => {
      const next = new Set(Array.from(previous).filter((key) => validKeys.has(key)))
      return next.size === previous.size ? previous : next
    })
  }, [data, groups])

  useEffect(() => {
    if (!gridRef.current || !data || seriesCount === 0 || timeline.length === 0) return
    const grid = gridRef.current

    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
    const textColor = isDark ? "rgba(229,231,235,0.85)" : "rgba(30,41,59,0.85)"
    const gridColor = isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"
    const sharedRange = getTimelineRange(timeline)
    const timeVisible = shouldShowTime(timeline)
    const timelineAnchorData = toTimelineAnchorData(timeline)
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
          fontSize: isCompact ? 8 : 9,
          attributionLogo: false,
        },
        grid: { vertLines: { visible: false }, horzLines: { color: gridColor } },
        rightPriceScale: {
          visible: true,
          borderVisible: false,
          scaleMargins: isCompact ? { top: 0.18, bottom: 0.18 } : { top: 0.1, bottom: 0.1 },
          entireTextOnly: true,
          minimumWidth: isCompact ? 52 : 84,
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
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: false,
          pinch: true,
          axisPressedMouseMove: { time: true, price: false },
          axisDoubleClickReset: { time: true, price: false },
        },
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
          crosshairMarkerRadius: isCompact ? 2 : 3,
          priceFormat: {
            type: "custom",
            formatter: (value: BarPrice) => formatRaw(value, spec.unit),
            minMove: 0.0001,
          },
        })
        const prepared = prepareLineSeries(spec.data, timeline)
        series.setData(prepared.lineData)
        seriesByKey.set(spec.key, series)
        rawByKey.set(spec.key, prepared.rawByTime)
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
  }, [data, groups, isCompact, seriesCount, timeline])

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
    for (const group of groups) {
      for (const series of group.specs) {
        const summary = summarize(series.data)
        if (summary) out.set(series.key, summary)
      }
    }
    return out
  }, [data, groups])

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
    return groups.reduce(
      (count, group) =>
        count + group.specs.reduce((groupCount, spec) => groupCount + (hidden.has(spec.key) ? 0 : 1), 0),
      0,
    )
  }, [groups, hidden])

  return (
    <Card ref={cardRef} data-history-compare className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle data-history-title className="text-sm">
              {title}
            </CardTitle>
            <InfoTooltip title={title} description={infoDescription} source={infoSource} />
          </div>
          {data && seriesCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {hoverDateLabel ? `${hoverDateLabel} · ` : ""}
              {visibleSeriesCount}/{seriesCount} {seriesCountLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {error ? (
          <p className="py-12 text-center text-xs text-destructive">{error}</p>
        ) : loading && !data ? (
          <p className="py-12 text-center text-xs text-muted-foreground">{loadingLabel}</p>
        ) : !data || seriesCount === 0 || timeline.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">{noDataLabel}</p>
        ) : (
          <div ref={gridRef} className="flex flex-col gap-0.5 sm:gap-1">
            {groups.map((group, groupIndex) => (
              <section
                key={group.paneIndex}
                data-history-group={group.key}
                className="border-t border-border/60 pt-0.5 first:border-t-0 first:pt-0 sm:pt-1"
              >
                <div
                  data-history-pane-legend
                  className="mb-0.5 flex min-h-4 snap-x flex-nowrap items-center gap-x-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:gap-x-2 sm:gap-y-0.5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
                >
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
                          "inline-flex max-w-[220px] shrink-0 snap-start items-baseline gap-0.5 truncate text-left tabular-nums transition-opacity hover:text-foreground sm:max-w-full sm:shrink sm:gap-1",
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
                        <span className="shrink-0 text-[9px] font-semibold leading-none sm:text-[10px]">
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
                  className={cn(
                    "w-full",
                    groupIndex === groups.length - 1 ? "h-[86px] sm:h-[120px]" : "h-[74px] sm:h-[108px]",
                  )}
                />
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
