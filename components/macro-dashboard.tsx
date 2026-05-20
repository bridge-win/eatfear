"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { MarketIndicatorCards, type MarketIndicatorItem } from "@/components/market-indicator-cards"
import { MarketIndicatorDetail } from "@/components/market-indicator-detail"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardFrame } from "@/components/page-frame"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { buildIndicatorInfo, type MacroApiResponse } from "@/lib/dashboard-shared"
import { DEFAULT_MACRO_INDICATOR_REFRESH_MS } from "@/lib/macro-indicator-config"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import type { MacroIndicator } from "@/lib/types"

const MACRO_DEFAULT_RANGE: TimeRangeId = "10y"

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

const getMacroSortRank = (indicator: MacroIndicator) =>
  indicator.displayOrder ?? indicator.macroRank ?? 100_000 + (indicator.priority ?? 999)

const sortMacroIndicators = (a: MacroIndicator, b: MacroIndicator) => {
  const rankDelta = getMacroSortRank(a) - getMacroSortRank(b)
  if (rankDelta !== 0) return rankDelta
  return (a.priority ?? 999) - (b.priority ?? 999)
}

const getMacroSeriesColor = (indicator: MacroIndicator, index: number) => {
  if (indicator.color) return indicator.color
  const seed = [...indicator.symbol].reduce((sum, char) => sum + char.charCodeAt(0), index)
  return MACRO_SERIES_COLORS[seed % MACRO_SERIES_COLORS.length]
}

const toAlignedUnit = (unit: MacroIndicator["unit"]): AlignedHistoryUnit => {
  switch (unit) {
    case "percent":
      return "pct"
    case "usd":
    case "cny":
      return unit
    case "ratio":
      return "ratio"
    case "count":
      return "count"
    default:
      return "raw"
  }
}

const buildMacroItems = (indicators: MacroIndicator[]): MarketIndicatorItem[] => {
  return [...indicators].sort(sortMacroIndicators).flatMap((indicator, index) => {
    const data = indicator.history
      .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
      .map((point) => ({ time: point.timestamp, value: point.value }))

    if (data.length === 0) return []

    const info = buildIndicatorInfo(indicator)
    return [{
      key: indicator.symbol,
      order: index + 1,
      label: indicator.name,
      color: getMacroSeriesColor(indicator, index),
      unit: toAlignedUnit(indicator.unit),
      value: Number.isFinite(indicator.value) ? indicator.value : null,
      changePercent: Number.isFinite(indicator.changePercent) ? indicator.changePercent : null,
      timestamp: indicator.lastUpdate,
      source: info?.source ?? `${indicator.source}${indicator.frequency ? ` · ${indicator.frequency}` : ""}`,
      description: info?.description ?? indicator.description ?? "Macro indicator.",
      data,
    }]
  }).map((item, index) => ({ ...item, order: index + 1 }))
}

const buildMacroHistoryData = (items: MarketIndicatorItem[]): AlignedHistoryData | null => {
  if (items.length === 0) return null
  const series: AlignedHistorySeries[] = items.map((item) => ({
    key: item.key,
    order: item.order,
    label: item.label,
    color: item.color,
    unit: item.unit,
    data: item.data,
    info: {
      title: `#${String(item.order).padStart(2, "0")} ${item.label}`,
      description: item.description,
      source: item.source,
    },
  }))

  return { groups: [{ key: "macro", series }] }
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
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null)
  const refreshMsRef = useRef(DEFAULT_MACRO_INDICATOR_REFRESH_MS)
  const t = useT()

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
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
        refreshMsRef.current = payload.refreshMs ?? DEFAULT_MACRO_INDICATOR_REFRESH_MS
        setError(null)
      } catch (requestError) {
        if (isActive && (requestError as Error).name !== "AbortError") {
          setError(requestError instanceof Error ? requestError.message : "Failed to load macro data")
        }
      } finally {
        if (!isActive) return
        setIsLoading(false)
        timer = setTimeout(loadMacroData, refreshMsRef.current)
      }
    }

    loadMacroData()

    return () => {
      isActive = false
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [range])

  const macroItems = useMemo(() => buildMacroItems(indicators), [indicators])
  const macroHistoryData = useMemo(() => buildMacroHistoryData(macroItems), [macroItems])

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
            {selectedIndicatorKey && macroItems.length > 0 ? (
              <MarketIndicatorDetail
                items={macroItems}
                selectedKey={selectedIndicatorKey}
                backLabel={t("macro.detail.back")}
                subtitle={t("macro.detail.subtitle")}
                searchPlaceholder={t("macro.detail.search")}
                emptyMessage={t("macro.detail.empty")}
                addCompareLabel={t("macro.detail.addCompare")}
                chartTitle={t("macro.detail.chartTitle")}
                chartInfo={t("macro.detail.chartInfo")}
                chartInfoSource="FRED · IMF/World Bank via FRED · Yahoo Finance · aligned timeline"
                loadingLabel={t("macro.loading")}
                noDataLabel={t("chart.noData")}
                seriesCountLabel={t("compare.seriesCount")}
                onBack={() => setSelectedIndicatorKey(null)}
              />
            ) : (
              <MarketIndicatorCards
                items={macroItems}
                loading={isLoading}
                error={error}
                loadingLabel={t("macro.loading")}
                noDataLabel={t("chart.noData")}
                onSelectItem={setSelectedIndicatorKey}
                dataPrefix="macro"
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <AlignedHistoryCompare
              data={macroHistoryData}
              title={t("macro.historyCompare.title")}
              infoDescription={t("macro.historyCompare.info")}
              infoSource="FRED · IMF/World Bank via FRED · Yahoo Finance · TradingView Lightweight Charts"
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
