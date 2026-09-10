"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
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
import { RefreshCw } from "lucide-react"

import { InfoPopover } from "@/components/info-popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { groupImportance, orderGroupsByImportance } from "@/lib/history-order"
import { cn } from "@/lib/utils"

export type AlignedHistoryUnit = "usd" | "cny" | "pct" | "ratio" | "raw" | "count"

export interface AlignedHistoryPoint {
  time: number
  value: number | null
}

export interface AlignedHistorySeries {
  key: string
  order?: number
  /** Higher = more important; drives sort order and pagination. */
  importance?: number
  tier?: "core" | "secondary"
  label: string
  color: string
  unit: AlignedHistoryUnit
  data: AlignedHistoryPoint[]
  info?: {
    title?: string
    description: string
    source?: string
  }
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
  containerEl: HTMLDivElement
}

interface HoverState {
  time: number
  x: number
}

interface HoverPaneTooltipItem {
  key: string
  order?: number
  label: string
  color: string
  time: string
  value: string
}

interface HoverPaneTooltip {
  key: number
  left: number
  top: number
  width: number
  items: HoverPaneTooltipItem[]
}

interface TimeAxisLabel {
  key: string
  label: string
  positionPct: number
  align: "start" | "center" | "end"
}

interface VisibleLogicalRange {
  from: number
  to: number
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
  expectedSeriesCount?: number
  maxSeriesPerPane?: number
  className?: string
}

const toUtc = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp
const LWC_VALUE_CAP = 8.9e13
const COMPACT_WIDTH = 560
const MAX_SERIES_PER_PANE = 2
const DAY_MS = 24 * 60 * 60 * 1000
const DESKTOP_TIME_LABEL_COUNT = 5
const COMPACT_TIME_LABEL_COUNT = 3
const INITIAL_RENDERED_PANES = 1
const RENDERED_PANE_CHUNK = 4
const MAX_PENDING_PANE_PLACEHOLDERS = 4

function formatRaw(value: number, unit: AlignedHistoryUnit): string {
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

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

type AlignedLineData = Array<LineData<Time> | WhitespaceData<Time>>
interface PreparedLineSeries {
  lineData: AlignedLineData
  rawByTime: Map<number, number>
  plotScale: number
}

function getFinitePointMap(points: AlignedHistoryPoint[]): Map<UTCTimestamp, number> {
  const validPoints = new Map<UTCTimestamp, number>()
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value)) continue
    validPoints.set(toUtc(point.time), point.value)
  }
  return validPoints
}

function getPlotScale(points: AlignedHistoryPoint[]): number {
  let maxAbs = 0
  for (const point of points) {
    if (point.value === null || !Number.isFinite(point.value)) continue
    maxAbs = Math.max(maxAbs, Math.abs(point.value))
  }
  if (maxAbs < LWC_VALUE_CAP) return 1
  return 1000 ** Math.ceil(Math.log(maxAbs / (LWC_VALUE_CAP / 2)) / Math.log(1000))
}

function toLineData(points: AlignedHistoryPoint[], timeline: number[], plotScale: number): AlignedLineData {
  const valuesByTime = getFinitePointMap(points)
  const timelineSeconds = Array.from(new Set([...timeline.map(toUtc), ...valuesByTime.keys()])).sort((a, b) => a - b)

  if (timelineSeconds.length === 0) {
    return Array.from(valuesByTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([time, value]) => ({ time, value: value / plotScale }))
  }

  return timelineSeconds.map((time) => {
    const value = valuesByTime.get(time)
    if (value === undefined) return { time }
    const scaled = value / plotScale
    return Math.abs(scaled) < LWC_VALUE_CAP ? { time, value: scaled } : { time }
  })
}

function prepareLineSeries(points: AlignedHistoryPoint[], timeline: number[]): PreparedLineSeries {
  const rawByTime = getFinitePointMap(points)
  const plotScale = getPlotScale(points)
  return {
    lineData: toLineData(points, timeline, plotScale),
    rawByTime,
    plotScale,
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

function getNearestValue(values: Map<number, number> | undefined, time: number): number | null {
  if (!values || values.size === 0) return null
  const exact = values.get(time)
  if (exact !== undefined) return exact

  let previousTime = -Infinity
  let previousValue: number | null = null
  let nextTime = Infinity
  let nextValue: number | null = null

  for (const [candidateTime, value] of values) {
    if (candidateTime <= time && candidateTime > previousTime) {
      previousTime = candidateTime
      previousValue = value
    }
    if (candidateTime > time && candidateTime < nextTime) {
      nextTime = candidateTime
      nextValue = value
    }
  }

  return previousValue ?? nextValue
}

function getTimelineForGroups(baseTimeline: number[] | undefined, groups: SeriesGroup[]): number[] {
  const timeline = new Set<number>(baseTimeline ?? [])
  for (const group of groups) {
    for (const series of group.specs) {
      for (const point of series.data) {
        if (Number.isFinite(point.time)) timeline.add(point.time)
      }
    }
  }
  return Array.from(timeline).sort((a, b) => a - b)
}

function getGroups(data: AlignedHistoryData, maxSeriesPerPane: number, enabledGroups?: Set<string>): SeriesGroup[] {
  const groups: SeriesGroup[] = []
  for (const group of orderGroupsByImportance(data.groups)) {
    if (enabledGroups && !enabledGroups.has(group.key)) continue
    const specs = group.series.filter((series) => series.data.length > 0)
    for (let index = 0; index < specs.length; index += maxSeriesPerPane) {
      const chunk = specs.slice(index, index + maxSeriesPerPane)
      groups.push({
        key: `${group.key}-${index / maxSeriesPerPane}`,
        label: group.label,
        paneIndex: groups.length,
        specs: chunk,
      })
    }
  }
  return groups
}

function getTimelineRange(timeline: number[]): { from: UTCTimestamp; to: UTCTimestamp } | null {
  if (timeline.length < 2) return null
  return { from: toUtc(timeline[0]), to: toUtc(timeline[timeline.length - 1]) }
}

function shouldShowTime(timeline: number[]): boolean {
  if (timeline.length < 2) return false
  const spanMs = timeline[timeline.length - 1] - timeline[0]
  return spanMs <= 3 * DAY_MS
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatTimeAxisLabel(time: number, spanMs: number, includeDateForShortRange: boolean): string {
  const date = new Date(time)
  const year = date.getUTCFullYear()
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const hour = pad2(date.getUTCHours())
  const minute = pad2(date.getUTCMinutes())
  if (spanMs <= DAY_MS) {
    return includeDateForShortRange ? `${month}-${day} ${hour}:${minute}` : `${hour}:${minute}`
  }
  if (spanMs <= 3 * DAY_MS) return `${month}-${day} ${hour}:${minute}`
  if (spanMs > 8 * 365 * DAY_MS) return String(year)
  if (spanMs > 370 * DAY_MS) return `${year}-${month}`
  return `${month}-${day}`
}

function formatHoverTime(time: number): string {
  const date = new Date(time * 1000)
  const year = date.getUTCFullYear()
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const hour = pad2(date.getUTCHours())
  const minute = pad2(date.getUTCMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function isSameUtcDate(a: number, b: number): boolean {
  const left = new Date(a)
  const right = new Date(b)
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  )
}

function getTimeAxisLabels(
  timeline: number[],
  isCompact: boolean,
  visibleLogicalRange: VisibleLogicalRange | null,
): TimeAxisLabel[] {
  if (timeline.length === 0) return []
  const labelCount = Math.min(isCompact ? COMPACT_TIME_LABEL_COUNT : DESKTOP_TIME_LABEL_COUNT, timeline.length)
  const rangeFrom =
    visibleLogicalRange && Number.isFinite(visibleLogicalRange.from)
      ? Math.max(0, Math.min(timeline.length - 1, visibleLogicalRange.from))
      : 0
  const rangeTo =
    visibleLogicalRange && Number.isFinite(visibleLogicalRange.to)
      ? Math.max(rangeFrom, Math.min(timeline.length - 1, visibleLogicalRange.to))
      : timeline.length - 1
  const startIndex = Math.max(0, Math.min(timeline.length - 1, Math.floor(rangeFrom)))
  const endIndex = Math.max(startIndex, Math.min(timeline.length - 1, Math.ceil(rangeTo)))
  const start = timeline[startIndex]
  const end = timeline[endIndex]
  const spanMs = Math.max(end - start, 1)
  const includeDateForShortRange = spanMs <= DAY_MS && !isSameUtcDate(start, end)
  const spanLogical = Math.max(rangeTo - rangeFrom, 1)
  const usedIndices = new Set<number>()

  return Array.from({ length: labelCount })
    .map((_, index) => {
      const logical = rangeFrom + (spanLogical * index) / Math.max(labelCount - 1, 1)
      const dataIndex = Math.max(0, Math.min(timeline.length - 1, Math.round(logical)))
      const positionPct = ((logical - rangeFrom) / spanLogical) * 100
      return { dataIndex, positionPct }
    })
    .filter(({ dataIndex }) => {
      if (usedIndices.has(dataIndex)) return false
      usedIndices.add(dataIndex)
      return true
    })
    .map(({ dataIndex, positionPct }) => {
      const time = timeline[dataIndex]
      const align = positionPct < 8 ? "start" : positionPct > 92 ? "end" : "center"
      return {
        key: `${time}-${dataIndex}-${Math.round(positionPct * 100)}`,
        label: formatTimeAxisLabel(time, spanMs, includeDateForShortRange),
        positionPct,
        align,
      }
    })
}

function HistoryPaneLoading({
  paneIndex,
  seriesCount,
  maxSeriesPerPane,
  loadingLabel,
}: {
  paneIndex: number
  seriesCount: number
  maxSeriesPerPane: number
  loadingLabel: string
}) {
  const rowCount = Math.max(1, Math.min(seriesCount, maxSeriesPerPane))
  return (
    <section
      data-history-loading-group
      data-history-loading-pane={paneIndex}
      className="border-t border-border/50 pt-px first:border-t-0 first:pt-0 sm:pt-0.5"
    >
      <div className="mb-px grid grid-cols-2 items-center gap-x-1.5 gap-y-px">
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            data-history-loading-series
            className="grid h-3.5 min-w-0 grid-cols-[1.35rem_auto_minmax(0,1fr)_4.1rem_2.8rem] items-center gap-0.5 sm:grid-cols-[1.55rem_auto_minmax(0,1fr)_4.5rem_3.2rem] sm:gap-1"
          >
            <span className="text-[8px] font-semibold leading-none text-muted-foreground sm:text-[9px]">
              #{String(paneIndex * maxSeriesPerPane + index + 1).padStart(2, "0")}
            </span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 min-w-0 animate-pulse rounded bg-muted" />
            <span className="h-2.5 animate-pulse rounded bg-muted" />
            <span className="h-2.5 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-[42px] w-full rounded-sm border border-dashed border-border/60 bg-muted/25 sm:h-[62px]">
        <div className="flex h-full items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {loadingLabel}
        </div>
      </div>
      <div className="h-3.5 w-full pt-px sm:h-4">
        <div className="h-full border-t border-slate-500/25 dark:border-slate-400/25" />
      </div>
    </section>
  )
}

function GroupFilterPanel({
  catalog, active, onToggle, onAll, onNone, open, onOpenChange,
}: {
  catalog: { key: string; label: string; count: number; importance: number }[]
  active: Set<string>
  onToggle: (key: string) => void
  onAll: () => void
  onNone: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const enabledCount = catalog.filter((g) => active.has(g.key)).length
  return (
    <aside className={cn("sticky top-14 z-10 max-h-[calc(100vh-4rem)] shrink-0 self-start overflow-y-auto rounded-md border border-border/60 bg-card/95 text-[11px] backdrop-blur", open ? "w-52" : "w-8")}>
      <div className="flex items-center justify-between px-1.5 py-1">
        {open && <span className="font-medium">分组筛选 <span className="text-muted-foreground">{enabledCount}/{catalog.length}</span></span>}
        <button type="button" onClick={() => onOpenChange(!open)} className="rounded px-1 text-muted-foreground hover:text-foreground" aria-label={open ? "收起筛选" : "展开筛选"}>
          {open ? "«" : "»"}
        </button>
      </div>
      {open && (
        <>
          <div className="flex gap-1 px-1.5 pb-1">
            <button type="button" onClick={onAll} className="rounded border border-border px-1.5 py-0.5 hover:text-foreground">全选</button>
            <button type="button" onClick={onNone} className="rounded border border-border px-1.5 py-0.5 hover:text-foreground">清空</button>
          </div>
          <div className="border-t border-border/60">
            {catalog.map((g) => (
              <label key={g.key} className="flex cursor-pointer items-center gap-1.5 px-1.5 py-1 hover:bg-muted/40">
                <input type="checkbox" checked={active.has(g.key)} onChange={() => onToggle(g.key)} className="accent-primary" />
                <span className="min-w-0 flex-1 truncate" title={g.label}>{g.label}</span>
                <span className="tabular-nums text-muted-foreground" title="曲线数 · 最高重要度">{g.count}<span className="opacity-60"> · R{Math.round(g.importance)}</span></span>
              </label>
            ))}
          </div>
          <p className="px-1.5 py-1 text-[10px] leading-snug text-muted-foreground">组按最高重要度排序;组内曲线也按重要度排。</p>
        </>
      )}
    </aside>
  )
}

function Pager({ page, pageCount, panesPerPage, onPage, onPanesPerPage, paneCount }: { page: number; pageCount: number; panesPerPage: number; onPage: (p: number) => void; onPanesPerPage: (n: number) => void; paneCount: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-[11px] text-muted-foreground">
      <span>按重要度排序 · 共 {paneCount} 个面板</span>
      <div className="flex items-center gap-1">
        <label>每页 <select value={Number.isFinite(panesPerPage) ? String(panesPerPage) : "all"} onChange={(e) => onPanesPerPage(e.target.value === "all" ? Infinity : Number(e.target.value))} className="rounded border border-border bg-transparent px-1 py-0.5">{[10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}<option value="all">全部</option></select> 面板</label>
        {Number.isFinite(panesPerPage) && (
          <>
            <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)} className="rounded border border-border px-1.5 py-0.5 disabled:opacity-40">‹ 上一页</button>
            <span className="tabular-nums">{page + 1} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} className="rounded border border-border px-1.5 py-0.5 disabled:opacity-40">下一页 ›</button>
          </>
        )}
      </div>
    </div>
  )
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
  expectedSeriesCount,
  maxSeriesPerPane = MAX_SERIES_PER_PANE,
  className,
}: AlignedHistoryCompareProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const chartsRef = useRef<PaneChart[]>([])
  const hiddenRef = useRef<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hoverState, setHoverState] = useState<HoverState | null>(null)
  const [cardWidth, setCardWidth] = useState(0)
  const [visibleLogicalRange, setVisibleLogicalRange] = useState<VisibleLogicalRange | null>(null)
  const [renderedPaneCount, setRenderedPaneCount] = useState(0)
  const [enabledGroups, setEnabledGroups] = useState<Set<string> | null>(null)
  const [page, setPage] = useState(0)
  const [panesPerPage, setPanesPerPage] = useState<number>(20)   // Infinity = 显示全部
  const [filterOpen, setFilterOpen] = useState(true)
  const groupCatalog = useMemo(
    () => (data ? orderGroupsByImportance(data.groups).map((g) => ({ key: g.key, label: g.label ?? g.key, count: g.series.filter((x) => x.data.length > 0).length, importance: groupImportance(g) })) : []),
    [data],
  )
  const activeGroups = useMemo(() => enabledGroups ?? new Set(groupCatalog.map((g) => g.key)), [enabledGroups, groupCatalog])
  const allPanes = useMemo(() => (data ? getGroups(data, maxSeriesPerPane, activeGroups) : []), [data, maxSeriesPerPane, activeGroups])
  const pageCount = Number.isFinite(panesPerPage) ? Math.max(1, Math.ceil(allPanes.length / panesPerPage)) : 1
  const safePage = Math.min(page, pageCount - 1)
  const groups = useMemo(
    () => (Number.isFinite(panesPerPage) ? allPanes.slice(safePage * panesPerPage, (safePage + 1) * panesPerPage) : allPanes).map((g, i) => ({ ...g, paneIndex: i })),
    [allPanes, safePage, panesPerPage],
  )
  const totalSeriesCount = useMemo(() => allPanes.reduce((count, group) => count + group.specs.length, 0), [allPanes])
  useEffect(() => { setPage(0) }, [activeGroups, panesPerPage])
  const isCompact = cardWidth > 0 && cardWidth < COMPACT_WIDTH
  const seriesCount = useMemo(() => groups.reduce((count, group) => count + group.specs.length, 0), [groups])
  const renderedGroups = useMemo(
    () => groups.slice(0, renderedPaneCount),
    [groups, renderedPaneCount],
  )
  const timeline = useMemo(
    () => (data ? getTimelineForGroups(data.timeline, renderedGroups) : []),
    [data, renderedGroups],
  )
  const renderedSeriesCount = useMemo(
    () => renderedGroups.reduce((count, group) => count + group.specs.length, 0),
    [renderedGroups],
  )

  useEffect(() => {
    if (groups.length === 0) {
      setRenderedPaneCount(0)
      return () => {}
    }

    setRenderedPaneCount((previous) => {
      const next = Math.min(Math.max(INITIAL_RENDERED_PANES, Number.isFinite(panesPerPage) ? panesPerPage : 20), groups.length)
      return previous === next ? previous : next
    })
  }, [groups, panesPerPage])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || renderedPaneCount >= groups.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        startTransition(() => {
          setRenderedPaneCount((previous) => Math.min(groups.length, previous + RENDERED_PANE_CHUNK))
        })
      },
      { rootMargin: "160px 0px", threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [groups.length, renderedPaneCount])

  useEffect(() => {
    hiddenRef.current = hidden
  }, [hidden])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const updateWidth = () => {
      const next = Math.round(card.getBoundingClientRect().width)
      setCardWidth((previous) => (previous === next ? previous : next))
    }
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
    if (!gridRef.current || !data || renderedSeriesCount === 0 || timeline.length === 0) return
    const grid = gridRef.current

    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
    const textColor = isDark ? "rgba(248,250,252,0.96)" : "rgba(15,23,42,0.96)"
    const axisColor = isDark ? "rgba(203,213,225,0.42)" : "rgba(71,85,105,0.38)"
    const gridColor = isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"
    const sharedRange = getTimelineRange(timeline)
    const timeVisible = shouldShowTime(timeline)
    const timelineAnchorData = toTimelineAnchorData(timeline)
    const sharedLogicalRange =
      timelineAnchorData.length > 1
        ? ({ from: 0 as Logical, to: (timelineAnchorData.length - 1) as Logical } satisfies LogicalRange)
        : null
    const nextLogicalRange = sharedLogicalRange ? { from: Number(sharedLogicalRange.from), to: Number(sharedLogicalRange.to) } : null
    setVisibleLogicalRange((previous) => {
      if (!previous && !nextLogicalRange) return previous
      if (previous && nextLogicalRange && previous.from === nextLogicalRange.from && previous.to === nextLogicalRange.to) return previous
      return nextLogicalRange
    })

    const panes: PaneChart[] = []
    renderedGroups.forEach((group) => {
      const containerEl = grid.querySelector<HTMLDivElement>(`[data-pane="${group.paneIndex}"]`)
      if (!containerEl) return
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
          borderVisible: true,
          borderColor: axisColor,
          scaleMargins: isCompact ? { top: 0.18, bottom: 0.18 } : { top: 0.1, bottom: 0.1 },
          entireTextOnly: true,
          minimumWidth: isCompact ? 52 : 84,
        },
        timeScale: {
          visible: false,
          borderVisible: false,
          borderColor: axisColor,
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
        const prepared = prepareLineSeries(spec.data, timeline)
        const series = chart.addSeries(LineSeries, {
          color: spec.color,
          lineWidth: group.specs.length === 1 ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: isCompact ? 2 : 3,
          priceFormat: {
            type: "custom",
            formatter: (value: BarPrice) => formatRaw(Number(value) * prepared.plotScale, spec.unit),
            minMove: 0.0001,
          },
        })
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
        containerEl,
      })
    })
    chartsRef.current = panes

    let syncing = false
    const syncRange = (sourceIndex: number) => (range: LogicalRange | null) => {
      if (syncing || !range) return
      const nextRange = { from: Number(range.from), to: Number(range.to) }
      setVisibleLogicalRange((previous) => {
        if (previous && previous.from === nextRange.from && previous.to === nextRange.to) return previous
        return nextRange
      })
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
        const value = getNearestValue(pane.rawByKey.get(spec.key), time)
        if (series && value !== null) return { series, value }
      }
      return { series: pane.anchorSeries, value: 0 }
    }
    const onCrosshair = (sourceIndex: number) => (param: MouseEventParams) => {
      if (crosshairSyncing) return
      crosshairSyncing = true
      try {
        if (!param.time || typeof param.time !== "number" || !param.point) {
          setHoverState((previous) => (previous === null ? previous : null))
          for (let index = 0; index < panes.length; index += 1) {
            if (index === sourceIndex) continue
            panes[index].chart.clearCrosshairPosition()
          }
          return
        }
        const sourcePane = panes[sourceIndex]
        const gridRect = grid.getBoundingClientRect()
        const paneRect = sourcePane.containerEl.getBoundingClientRect()
        const nextHoverState = {
          time: param.time,
          x: paneRect.left - gridRect.left + param.point.x,
        }
        setHoverState((previous) => {
          if (previous && previous.time === nextHoverState.time && previous.x === nextHoverState.x) return previous
          return nextHoverState
        })
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
  }, [data, isCompact, renderedGroups, renderedSeriesCount, timeline])

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
    for (const group of renderedGroups) {
      for (const series of group.specs) {
        const summary = summarize(series.data)
        if (summary) out.set(series.key, summary)
      }
    }
    return out
  }, [data, renderedGroups])

  const visibleSeriesCount = useMemo(() => {
    return renderedGroups.reduce(
      (count, group) =>
        count + group.specs.reduce((groupCount, spec) => groupCount + (hidden.has(spec.key) ? 0 : 1), 0),
      0,
    )
  }, [renderedGroups, hidden])
  const timeAxisLabels = useMemo(
    () => getTimeAxisLabels(timeline, isCompact, visibleLogicalRange),
    [isCompact, timeline, visibleLogicalRange],
  )
  const displaySeriesCount = Math.max(seriesCount, expectedSeriesCount ?? seriesCount)
  const isRenderingMorePanes = !!data && renderedPaneCount < groups.length
  const pendingSeriesCount = loading || isRenderingMorePanes ? Math.max(0, displaySeriesCount - renderedSeriesCount) : 0
  const pendingPaneCount = Math.min(MAX_PENDING_PANE_PLACEHOLDERS, Math.ceil(pendingSeriesCount / maxSeriesPerPane))

  const hoverPaneTooltips = useMemo<HoverPaneTooltip[]>(() => {
    const grid = gridRef.current
    if (!hoverState || !grid) return []

    const gridRect = grid.getBoundingClientRect()
    const tooltipWidth = Math.min(isCompact ? 260 : 340, Math.max(180, gridRect.width - 8))
    const left = Math.min(Math.max(hoverState.x + 8, 4), Math.max(4, gridRect.width - tooltipWidth - 4))
    const hoverTime = formatHoverTime(hoverState.time)

    return chartsRef.current.flatMap((pane) => {
      const items: HoverPaneTooltipItem[] = pane.specs
        .filter((spec) => !hidden.has(spec.key))
        .map((spec) => {
          const value = getNearestValue(pane.rawByKey.get(spec.key), hoverState.time)
          return {
            key: spec.key,
            order: spec.order,
            label: spec.label,
            color: spec.color,
            time: hoverTime,
            value: value === null ? "—" : formatRaw(value, spec.unit),
          }
        })

      if (items.length === 0) return []

      const paneRect = pane.containerEl.getBoundingClientRect()
      return [
        {
          key: pane.paneIndex,
          left,
          top: Math.max(0, paneRect.top - gridRect.top + 2),
          width: tooltipWidth,
          items,
        },
      ]
    })
  }, [hidden, hoverState, isCompact])

  return (
    <Card ref={cardRef} data-history-compare className={cn("gap-1 py-1.5", className)}>
      <CardHeader className="px-2.5 pb-0">
        <div className="grid h-5 grid-cols-[minmax(0,1fr)_7.75rem] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="flex h-5 min-w-0 items-center gap-1">
            <CardTitle data-history-title className="h-4 max-w-full truncate text-xs leading-4">
              {title}
            </CardTitle>
            <InfoPopover ariaLabel={title} title={title} description={infoDescription} source={infoSource} />
          </div>
          {data && seriesCount > 0 && (
            <span className="h-4 w-[7.75rem] overflow-hidden truncate text-right text-[9px] leading-4 text-muted-foreground sm:w-36">
              {visibleSeriesCount}/{totalSeriesCount} {seriesCountLabel}{pageCount > 1 ? ` · 第 ${safePage + 1}/${pageCount} 页` : ""}
              {loading && (
                <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
              )}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2.5 pt-0">
        {error ? (
          <p className="py-12 text-center text-xs text-destructive">{error}</p>
        ) : loading && (!data || seriesCount === 0 || timeline.length === 0) ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {loadingLabel}
            </div>
            <div className="relative flex flex-col gap-px sm:gap-0.5">
              {Array.from(
                {
                  length: Math.max(
                    1,
                    Math.ceil(Math.min(displaySeriesCount || maxSeriesPerPane * 3, maxSeriesPerPane * 6) / maxSeriesPerPane),
                  ),
                },
                (_, index) => (
                  <HistoryPaneLoading
                    key={index}
                    paneIndex={index}
                    seriesCount={Math.min(maxSeriesPerPane, Math.max(1, displaySeriesCount - index * maxSeriesPerPane))}
                    maxSeriesPerPane={maxSeriesPerPane}
                    loadingLabel={loadingLabel}
                  />
                ),
              )}
            </div>
          </div>
        ) : !data || seriesCount === 0 || timeline.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">{noDataLabel}</p>
        ) : (
          <div className="flex gap-2">
          <GroupFilterPanel
            catalog={groupCatalog}
            active={activeGroups}
            onToggle={(key) => setEnabledGroups((prev) => { const next = new Set(prev ?? groupCatalog.map((g) => g.key)); if (next.has(key)) next.delete(key); else next.add(key); return next })}
            onAll={() => setEnabledGroups(null)}
            onNone={() => setEnabledGroups(new Set())}
            open={filterOpen}
            onOpenChange={setFilterOpen}
          />
          <div className="min-w-0 flex-1">
          <Pager page={safePage} pageCount={pageCount} panesPerPage={panesPerPage} onPage={setPage} onPanesPerPage={setPanesPerPage} paneCount={allPanes.length} />
          <div ref={gridRef} className="relative flex flex-col gap-px sm:gap-0.5">
            {renderedGroups.map((group) => (
              <section
                key={group.paneIndex}
                data-history-group={group.key}
                className="border-t border-border/50 pt-px first:border-t-0 first:pt-0 sm:pt-0.5"
              >
                {group.label && (
                  <div className="mb-px h-3 overflow-hidden truncate text-[8px] font-semibold leading-3 text-muted-foreground sm:text-[9px]">
                    {group.label}
                  </div>
                )}
                <div
                  data-history-pane-legend
                  className="mb-px grid grid-cols-2 items-center gap-x-1.5 gap-y-px"
                >
                  {group.specs.map((spec) => {
                    const summary = summaries.get(spec.key)
                    const liveValue = summary?.last
                    const livePct = summary?.pct
                    const isHidden = hidden.has(spec.key)
                    const pctTone =
                      livePct === undefined
                        ? "text-muted-foreground"
                        : livePct >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                    return (
                      <div
                        key={spec.key}
                        data-history-series-key={spec.key}
                        data-history-series-order={spec.order}
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(spec.key)}
                          aria-pressed={!isHidden}
                          className={cn(
                            "inline-grid h-3.5 min-w-0 grid-cols-[1.35rem_auto_minmax(0,1fr)_4.1rem_2.8rem] items-center gap-0.5 text-left tabular-nums transition-opacity hover:text-foreground sm:grid-cols-[1.55rem_auto_minmax(0,1fr)_4.5rem_3.2rem] sm:gap-1",
                            isHidden ? "opacity-35" : "opacity-100",
                          )}
                        >
                          <span className="text-[8px] font-semibold leading-none text-muted-foreground sm:text-[9px]">
                            {spec.order ? `#${String(spec.order).padStart(2, "0")}` : ""}
                          </span>
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: spec.color }}
                          />
                          <span className="min-w-0 truncate text-[9px] font-medium leading-none sm:text-[10px]" title={spec.label}>
                            {spec.label}
                          </span>
                          <span className="w-[4.1rem] overflow-hidden truncate text-right text-[8px] font-semibold leading-none sm:w-[4.5rem] sm:text-[10px]">
                            {liveValue !== undefined ? formatRaw(liveValue, spec.unit) : "—"}
                          </span>
                          <span className={cn("w-[2.8rem] overflow-hidden truncate text-right text-[8px] leading-none sm:w-[3.2rem] sm:text-[9px]", pctTone)}>
                            {livePct !== undefined ? formatPct(livePct) : ""}
                          </span>
                        </button>
                        {spec.info && (
                          <InfoPopover
                            ariaLabel={spec.info.title ?? spec.label}
                            title={spec.info.title ?? spec.label}
                            description={spec.info.description}
                            source={spec.info.source}
                            className="h-3 w-3"
                            iconClassName="h-2.5 w-2.5"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div
                  data-pane={group.paneIndex}
                  className={cn(
                    "w-full",
                    group.specs.length > 2 ? "h-[72px] sm:h-[96px]" : "h-[42px] sm:h-[62px]",
                  )}
                />
                <div
                  data-history-time-axis
                  aria-hidden="true"
                  className="h-3.5 w-full pt-px sm:h-4"
                  style={{ paddingRight: isCompact ? 52 : 84 }}
                >
                  <div className="relative h-full border-t border-slate-500/45 dark:border-slate-400/35">
                    {timeAxisLabels.map((label) => (
                      <span
                        key={label.key}
                        data-history-time-label
                        className={cn(
                          "absolute top-0.5 whitespace-nowrap text-[9px] font-semibold leading-3 text-slate-700 dark:text-slate-200 sm:text-[10px]",
                          label.align === "center" && "-translate-x-1/2",
                          label.align === "end" && "-translate-x-full",
                        )}
                        style={{ left: `${label.positionPct}%` }}
                      >
                        {label.label}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            ))}
            {Array.from({ length: pendingPaneCount }, (_, index) => {
              const loadedBeforePane = renderedSeriesCount + index * maxSeriesPerPane
              return (
                <HistoryPaneLoading
                  key={`loading-${index}`}
                  paneIndex={renderedPaneCount + index}
                  seriesCount={Math.min(maxSeriesPerPane, Math.max(1, displaySeriesCount - loadedBeforePane))}
                  maxSeriesPerPane={maxSeriesPerPane}
                  loadingLabel={loadingLabel}
                />
              )
            })}
            {isRenderingMorePanes && <div ref={loadMoreRef} className="h-px" aria-hidden="true" />}
            {hoverPaneTooltips.map((tooltip) => (
              <div
                key={tooltip.key}
                data-history-hover-tooltip
                data-history-hover-pane={tooltip.key}
                className="pointer-events-none absolute z-20 px-1.5 py-1 text-[9px] text-foreground [text-shadow:0_0_4px_var(--background),0_1px_2px_var(--background)] sm:text-[10px]"
                style={{ left: tooltip.left, top: tooltip.top, width: tooltip.width }}
              >
                <div className="space-y-px">
                  {tooltip.items.map((item) => (
                    <div
                      key={item.key}
                      data-history-hover-item
                      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
                      <span className="truncate font-semibold tabular-nums">
                        {item.order ? `#${String(item.order).padStart(2, "0")} ` : ""}{item.label}:{item.value}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {pageCount > 1 && <Pager page={safePage} pageCount={pageCount} panesPerPage={panesPerPage} onPage={setPage} onPanesPerPage={setPanesPerPage} paneCount={allPanes.length} />}
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
