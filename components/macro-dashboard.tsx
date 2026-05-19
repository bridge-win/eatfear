"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistoryGroup,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoTooltip } from "@/components/info-tooltip"
import { KpiStrip, type KpiTile } from "@/components/kpi-strip"
import { DashboardFrame } from "@/components/page-frame"
import { formatValue as formatSeriesValue, type SeriesChartUnit } from "@/components/series-chart"
import { TimeRangeSelector } from "@/components/time-range-selector"
import {
  buildIndicatorInfo,
  buildInfoSource,
  formatPercentDelta,
  getDeltaTone,
  stripSymbolPrefix,
  type MacroApiResponse,
} from "@/lib/dashboard-shared"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import type { MacroGroup, MacroIndicator } from "@/lib/types"
import { cn } from "@/lib/utils"

const MACRO_DEFAULT_RANGE: TimeRangeId = "10y"

const KPI_PRIORITY_LIMIT = 12
const KPI_SPARK_POINTS = 40
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

const GROUP_ORDER: MacroGroup[] = [
  "Rates",
  "Liquidity",
  "Credit",
  "Equity",
  "Volatility",
  "FX",
  "Commodity",
  "Inflation",
  "Employment",
  "Growth",
  "RealEstate",
  "Crypto",
  "OnChain",
  "Sentiment",
  "CrossAsset",
]

const GROUP_KEY: Record<MacroGroup, string> = {
  Rates: "macro.group.Rates",
  Inflation: "macro.group.Inflation",
  Employment: "macro.group.Employment",
  Liquidity: "macro.group.Liquidity",
  Credit: "macro.group.Credit",
  Equity: "macro.group.Equity",
  Volatility: "macro.group.Volatility",
  FX: "macro.group.FX",
  Commodity: "macro.group.Commodity",
  Growth: "macro.group.Growth",
  RealEstate: "macro.group.RealEstate",
  Crypto: "macro.group.Crypto",
  OnChain: "macro.group.OnChain",
  Sentiment: "macro.group.Sentiment",
  CrossAsset: "macro.group.CrossAsset",
}

const MACRO_KPI_SYMBOLS = [
  "FRED:DFF",
  "FRED:DGS10",
  "FRED:DGS2",
  "FRED:DFII10",
  "FRED:T10Y2Y",
  "FRED:BAMLH0A0HYM2",
  "FRED:NFCI",
  "DX-Y.NYB",
  "^GSPC",
  "^NDX",
  "^VIX",
  "^SOX",
  "GC=F",
  "CL=F",
  "FRED:CPIAUCSL",
  "FRED:UNRATE",
] as const

const MACRO_SERIES_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#4f46e5",
  "#65a30d",
  "#c026d3",
  "#0f766e",
  "#ca8a04",
  "#7c3aed",
  "#0284c7",
  "#db2777",
] as const

const getGroupPaneIndex = (group: MacroGroup) => {
  const index = GROUP_ORDER.findIndex((groupId) => groupId === group)
  return index === -1 ? GROUP_ORDER.length : index
}

const getMacroSeriesColor = (indicator: MacroIndicator, index: number) => {
  const seed = [...indicator.symbol].reduce((sum, char) => sum + char.charCodeAt(0), index)
  return MACRO_SERIES_COLORS[seed % MACRO_SERIES_COLORS.length]
}

const toAlignedUnit = (unit: MacroIndicator["unit"]): AlignedHistoryUnit => {
  switch (unit) {
    case "percent":
      return "pct"
    case "usd":
      return "usd"
    case "ratio":
      return "ratio"
    case "count":
      return "count"
    default:
      return "raw"
  }
}

const buildMacroHistoryData = (indicators: MacroIndicator[]): AlignedHistoryData | null => {
  if (indicators.length === 0) return null

  const sortedIndicators = [...indicators].sort((a, b) => {
    const groupDelta = getGroupPaneIndex(a.group) - getGroupPaneIndex(b.group)
    if (groupDelta !== 0) return groupDelta
    return (a.priority ?? 999) - (b.priority ?? 999)
  })
  const grouped = new Map<MacroGroup, AlignedHistorySeries[]>()

  sortedIndicators.forEach((indicator, index) => {
    const data = indicator.history
      .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
      .map((point) => ({ time: point.timestamp, value: point.value }))

    if (data.length === 0) return

    const series: AlignedHistorySeries = {
      key: indicator.symbol,
      label: indicator.name,
      color: getMacroSeriesColor(indicator, index),
      unit: toAlignedUnit(indicator.unit),
      data,
    }
    const group = grouped.get(indicator.group)
    if (group) {
      group.push(series)
    } else {
      grouped.set(indicator.group, [series])
    }
  })

  const groups: AlignedHistoryGroup[] = GROUP_ORDER.map((group) => {
    const series = grouped.get(group) ?? []
    return {
      key: group,
      label: group,
      series,
    }
  }).filter((group) => group.series.length > 0)

  return groups.length > 0 ? { groups } : null
}

export interface MacroDashboardProps {
  initialIndicators?: MacroIndicator[]
  initialUpdatedAt?: number | null
  initialFredEnabled?: boolean | null
  initialMeta?: { requested: number; returned: number } | null
}

export function MacroDashboard({
  initialIndicators,
  initialUpdatedAt = null,
  initialFredEnabled = null,
  initialMeta = null,
}: MacroDashboardProps = {}) {
  const [indicators, setIndicators] = useState<MacroIndicator[]>(initialIndicators ?? [])
  const [updatedAt, setUpdatedAt] = useState<number | null>(initialUpdatedAt)
  const [isLoading, setIsLoading] = useState(!(initialIndicators && initialIndicators.length > 0))
  const [error, setError] = useState<string | null>(null)
  const [fredEnabled, setFredEnabled] = useState<boolean | null>(initialFredEnabled)
  const [range, setRange] = useState<TimeRangeId>(MACRO_DEFAULT_RANGE)
  const [meta, setMeta] = useState<{ requested: number; returned: number } | null>(initialMeta)
  const t = useT()

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    setIsLoading(true)

    async function loadMacroData() {
      try {
        const response = await fetch(`/api/macro?range=${range}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Macro API returned ${response.status}`)
        }
        const payload = (await response.json()) as MacroApiResponse
        if (!isActive) return

        setIndicators(payload.indicators)
        setUpdatedAt(payload.updatedAt)
        setFredEnabled(payload.fredEnabled ?? null)
        setMeta({ requested: payload.requested ?? 0, returned: payload.returned ?? 0 })
        setError(null)
      } catch (requestError) {
        if (isActive && (requestError as Error).name !== "AbortError") {
          setError(requestError instanceof Error ? requestError.message : "Failed to load macro data")
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadMacroData()
    const interval = setInterval(loadMacroData, REFRESH_INTERVAL_MS)

    return () => {
      isActive = false
      controller.abort()
      clearInterval(interval)
    }
  }, [range])

  const groupedIndicators = useMemo(() => {
    const grouped = new Map<MacroGroup, MacroIndicator[]>()
    for (const indicator of indicators) {
      const bucket = grouped.get(indicator.group)
      if (bucket) {
        bucket.push(indicator)
      } else {
        grouped.set(indicator.group, [indicator])
      }
    }
    return grouped
  }, [indicators])

  const kpiTiles: KpiTile[] = useMemo(() => {
    const indicatorBySymbol = new Map(indicators.map((indicator) => [indicator.symbol, indicator]))
    const selectedIndicators: MacroIndicator[] = []
    const selectedSymbols = new Set<string>()

    for (const symbol of MACRO_KPI_SYMBOLS) {
      const indicator = indicatorBySymbol.get(symbol)
      if (!indicator) continue
      selectedIndicators.push(indicator)
      selectedSymbols.add(symbol)
    }

    const fallbackIndicators = indicators
      .filter((indicator) => !selectedSymbols.has(indicator.symbol))
      .filter((indicator) => (indicator.priority ?? 999) <= KPI_PRIORITY_LIMIT)

    return [...selectedIndicators, ...fallbackIndicators]
      .slice(0, KPI_PRIORITY_LIMIT)
      .map((indicator) => ({
        id: indicator.symbol,
        label: indicator.name,
        value: formatSeriesValue(indicator.value, indicator.unit as SeriesChartUnit, true),
        delta: formatPercentDelta(indicator.changePercent),
        deltaTone: getDeltaTone(indicator.change),
        helper: `${indicator.source} · #${indicator.priority ?? "-"}`,
        sparkline: indicator.history.slice(-KPI_SPARK_POINTS).map((point) => point.value),
        info: buildIndicatorInfo(indicator),
      }))
  }, [indicators])

  const macroHistoryData = useMemo(() => buildMacroHistoryData(indicators), [indicators])

  return (
    <DashboardFrame>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("macro.title")}</h1>
          <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">{t("macro.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <TimeRangeSelector value={range} onChange={setRange} />
          <span className="rounded-full border px-2.5 py-0.5 text-[10px] text-muted-foreground">
            {meta
              ? t("macro.indicators", { returned: meta.returned, requested: meta.requested })
              : t("regime.hover.loading")}
          </span>
          <span className="rounded-full border px-2.5 py-0.5 text-[10px] text-muted-foreground">
            {updatedAt
              ? t("macro.updated", { time: new Date(updatedAt).toLocaleTimeString() })
              : "—"}
          </span>
        </div>
      </header>

      {fredEnabled === false && <FredHint />}

      <KpiStrip tiles={kpiTiles} />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="text-xs text-destructive">{error}</CardContent>
        </Card>
      )}

      {isLoading && indicators.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          {t("macro.loading")}
        </div>
      ) : (
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid h-auto w-full max-w-xs grid-cols-2">
            <TabsTrigger value="realtime" className="text-xs">
              {t("macro.tab.realtime")}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              {t("macro.tab.history")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="mt-3">
            <IndicatorSections
              groupedIndicators={groupedIndicators}
              renderIndicator={(indicator) => <RealtimeTile key={indicator.symbol} indicator={indicator} />}
              gridClassName="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
            />
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <AlignedHistoryCompare
              data={macroHistoryData}
              title={t("macro.historyCompare.title")}
              infoDescription={t("macro.historyCompare.info")}
              infoSource="FRED · Yahoo Finance · CoinGecko · DefiLlama · Blockchain.com · Alternative.me · TradingView Lightweight Charts"
              loading={isLoading}
              error={error}
              loadingLabel={t("macro.loading")}
              noDataLabel={t("chart.noData")}
              seriesCountLabel={t("compare.seriesCount")}
            />
          </TabsContent>
        </Tabs>
      )}
    </DashboardFrame>
  )
}

function FredHint() {
  const t = useT()
  return (
    <Card className="border-amber-300 bg-amber-50/60 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <CardContent className="px-3 text-[11px]">
        <p className="font-medium">{t("macro.fredHint.title")}</p>
        <p className="mt-0.5 leading-relaxed">{t("macro.fredHint.body")}</p>
      </CardContent>
    </Card>
  )
}

interface IndicatorSectionsProps {
  groupedIndicators: Map<MacroGroup, MacroIndicator[]>
  renderIndicator: (indicator: MacroIndicator) => React.ReactNode
  gridClassName: string
}

function IndicatorSections({ groupedIndicators, renderIndicator, gridClassName }: IndicatorSectionsProps) {
  const t = useT()
  return (
    <div className="space-y-3">
      {GROUP_ORDER.map((groupId) => {
        const group = groupedIndicators.get(groupId)
        if (!group || group.length === 0) return null
        return (
          <section key={groupId} className="space-y-1.5">
            <header className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(GROUP_KEY[groupId])}
              </h2>
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
                {group.length}
              </Badge>
            </header>
            <div className={gridClassName}>{group.map(renderIndicator)}</div>
          </section>
        )
      })}
    </div>
  )
}

function RealtimeTile({ indicator }: { indicator: MacroIndicator }) {
  const isPositive = indicator.change >= 0
  return (
    <div className="rounded-md border bg-card/80 px-2.5 py-1.5 shadow-sm">
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-foreground">{indicator.name}</p>
          <p className="truncate text-[9px] text-muted-foreground">
            {stripSymbolPrefix(indicator.symbol)} · <span className="opacity-80">{indicator.source}</span>
          </p>
        </div>
        {indicator.description && (
          <InfoTooltip
            title={indicator.name}
            description={indicator.description}
            source={buildInfoSource(indicator)}
          />
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold tabular-nums">
          {formatSeriesValue(indicator.value, indicator.unit as SeriesChartUnit, true)}
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-0.5 text-[10px] font-medium tabular-nums",
            isPositive ? "text-green-600" : "text-red-600",
          )}
        >
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatPercentDelta(indicator.changePercent)}
        </span>
      </div>
    </div>
  )
}
