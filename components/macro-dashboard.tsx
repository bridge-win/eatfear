"use client"

import { useEffect, useMemo, useState } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { MarketIndicatorCards, type MarketIndicatorItem } from "@/components/market-indicator-cards"
import { MarketIndicatorDetail } from "@/components/market-indicator-detail"
import { OpportunityRadar } from "@/components/opportunity-radar"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardFrame } from "@/components/page-frame"
import { TimeRangeSelector } from "@/components/time-range-selector"
import {
  isDashboardTabValue,
  jsonFetcher,
  usePersistentState,
  usePersistentSWR,
  writeStoredJson,
  type DashboardTabValue,
} from "@/lib/client-persistence"
import { useDeferredRender } from "@/lib/client-performance"
import { buildIndicatorInfo, type MacroApiResponse } from "@/lib/dashboard-shared"
import { DEFAULT_MACRO_INDICATOR_REFRESH_MS, getConfiguredMacroIndicatorMetas } from "@/lib/macro-indicator-config"
import { useT } from "@/lib/i18n"
import { withRelevanceScore } from "@/lib/indicator-score"
import { buildTradingOpportunities, type OpportunityInputSeries } from "@/lib/opportunity-engine"
import { getTimeRange, isTimeRangeId, type TimeRangeId } from "@/lib/time-range"
import type { MacroIndicator } from "@/lib/types"

const MACRO_DEFAULT_RANGE: TimeRangeId = "10y"
const MACRO_INITIAL_HISTORY_LIMIT = 12
const EXPECTED_MACRO_INDICATOR_COUNT = getConfiguredMacroIndicatorMetas().length

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
    const label = withRelevanceScore(indicator.name, indicator.relevanceScore)
    return [{
      key: indicator.symbol,
      order: index + 1,
      label,
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

function buildMacroApiUrl(range: TimeRangeId, options: { limit?: number; offset?: number } = {}): string {
  const params = new URLSearchParams({ range })
  if (options.limit !== undefined) params.set("limit", String(options.limit))
  if (options.offset !== undefined) params.set("offset", String(options.offset))
  return `/api/macro?${params.toString()}`
}

function mergeMacroPayloads(
  priority: MacroApiResponse | undefined,
  rest: MacroApiResponse | undefined,
): MacroApiResponse | null {
  if (!priority && !rest) return null
  const base = priority ?? rest
  if (!base) return null

  const indicatorsBySymbol = new Map<string, MacroIndicator>()
  for (const payload of [priority, rest]) {
    for (const indicator of payload?.indicators ?? []) {
      indicatorsBySymbol.set(indicator.symbol, indicator)
    }
  }
  const indicators = Array.from(indicatorsBySymbol.values()).sort(sortMacroIndicators)
  const refreshMs = Math.max(
    30_000,
    Math.min(
      priority?.refreshMs ?? DEFAULT_MACRO_INDICATOR_REFRESH_MS,
      rest?.refreshMs ?? DEFAULT_MACRO_INDICATOR_REFRESH_MS,
    ),
  )

  return {
    ...base,
    indicators,
    refreshMs,
    requested: EXPECTED_MACRO_INDICATOR_COUNT,
    returned: indicators.length,
    updatedAt: Math.max(priority?.updatedAt ?? 0, rest?.updatedAt ?? 0, base.updatedAt),
    fredEnabled: priority?.fredEnabled ?? rest?.fredEnabled,
  }
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
  const [range, setRange] = usePersistentState("macro:range", MACRO_DEFAULT_RANGE, isTimeRangeId)
  const [tab, setTab] = usePersistentState<DashboardTabValue>("macro:tab", "history", isDashboardTabValue)
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null)
  const t = useT()
  const fullStorageKey = `macro:${range}:full`
  const initialPayload = useMemo<MacroApiResponse | undefined>(() => {
    if (!initialIndicators || initialIndicators.length === 0) return undefined
    const rangeOption = getTimeRange(MACRO_DEFAULT_RANGE)
    return {
      indicators: initialIndicators,
      range: MACRO_DEFAULT_RANGE,
      interval: rangeOption.yahooInterval,
      updatedAt: initialUpdatedAt ?? Date.now(),
      fredEnabled: initialFredEnabled ?? undefined,
      requested: initialMeta?.requested ?? EXPECTED_MACRO_INDICATOR_COUNT,
      returned: initialMeta?.returned ?? initialIndicators.length,
      refreshMs: DEFAULT_MACRO_INDICATOR_REFRESH_MS,
    }
  }, [initialFredEnabled, initialIndicators, initialMeta, initialUpdatedAt])
  const priority = usePersistentSWR<MacroApiResponse>(
    `macro:${range}:priority:${MACRO_INITIAL_HISTORY_LIMIT}`,
    buildMacroApiUrl(range, { limit: MACRO_INITIAL_HISTORY_LIMIT }),
    jsonFetcher,
    { revalidateIfStale: true },
  )
  const rest = usePersistentSWR<MacroApiResponse>(
    `macro:${range}:rest:${MACRO_INITIAL_HISTORY_LIMIT}`,
    buildMacroApiUrl(range, { offset: MACRO_INITIAL_HISTORY_LIMIT }),
    jsonFetcher,
    {
      refreshInterval: (payload) => payload?.refreshMs ?? DEFAULT_MACRO_INDICATOR_REFRESH_MS,
    },
  )
  const fullCache = usePersistentSWR<MacroApiResponse>(
    fullStorageKey,
    null,
    jsonFetcher,
    { fallbackData: range === MACRO_DEFAULT_RANGE ? initialPayload : undefined },
  )
  const mergedPayload = useMemo(() => mergeMacroPayloads(priority.data, rest.data), [priority.data, rest.data])
  const hasCompleteNetworkPayload = priority.data !== undefined && rest.data !== undefined
  const networkPayload = hasCompleteNetworkPayload ? mergedPayload : null
  const payload = networkPayload ?? fullCache.data ?? priority.data ?? initialPayload

  useEffect(() => {
    if (mergedPayload && hasCompleteNetworkPayload) writeStoredJson(fullStorageKey, mergedPayload)
  }, [fullStorageKey, hasCompleteNetworkPayload, mergedPayload])

  const indicators = payload?.indicators ?? []
  const updatedAt = payload?.updatedAt ?? null
  const fredEnabled = payload?.fredEnabled ?? null
  const meta = payload
    ? {
        requested: payload.requested ?? EXPECTED_MACRO_INDICATOR_COUNT,
        returned: payload.returned ?? indicators.length,
      }
    : initialMeta
  const isLoading = payload
    ? priority.isValidating || rest.isValidating || (!mergedPayload && !fullCache.data && rest.isLoading)
    : fullCache.isLoading || priority.isLoading || rest.isLoading
  const error = payload ? null : priority.error?.message ?? rest.error?.message ?? fullCache.error?.message ?? null

  const macroItems = useMemo(() => buildMacroItems(indicators), [indicators])
  const opportunityInputs = useMemo<OpportunityInputSeries[]>(
    () =>
      macroItems.map((item) => ({
        key: item.key,
        label: item.label,
        source: item.source,
        description: item.description,
        value: item.value,
        changePercent: item.changePercent,
        timestamp: item.timestamp,
        data: item.data,
      })),
    [macroItems],
  )
  const opportunities = useMemo(
    () =>
      buildTradingOpportunities({
        assetClass: "macro",
        marketName: "Macro",
        series: opportunityInputs,
      }),
    [opportunityInputs],
  )
  const canRenderHistory = useDeferredRender(`${tab}:${range}:${payload ? "ready" : "empty"}`, 1_000)
  const macroHistoryData = useMemo(
    () => (canRenderHistory ? buildMacroHistoryData(macroItems) : null),
    [canRenderHistory, macroItems],
  )

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

      <OpportunityRadar
        assetClass="macro"
        title={{ zh: "宏观机会雷达", en: "Macro Opportunity Radar" }}
        subtitle={{
          zh: "把利率、美元、信用、VIX、M2、通胀与就业合成风险资产顺风/逆风和冲击风险。",
          en: "Combines rates, USD, credit, VIX, M2, inflation, and labor data into risk-asset tailwind/headwind and shock-risk reads.",
        }}
        opportunities={opportunities}
        loading={isLoading}
      />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="text-xs text-destructive">{error}</CardContent>
        </Card>
      )}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isDashboardTabValue(next)) setTab(next)
        }}
        className="w-full"
      >
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
              expectedCount={meta?.requested ?? EXPECTED_MACRO_INDICATOR_COUNT}
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
            loading={isLoading || !canRenderHistory}
            error={error}
            loadingLabel={t("macro.loading")}
            noDataLabel={t("chart.noData")}
            seriesCountLabel={t("compare.seriesCount")}
            expectedSeriesCount={meta?.requested ?? EXPECTED_MACRO_INDICATOR_COUNT}
          />
        </TabsContent>
      </Tabs>
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
