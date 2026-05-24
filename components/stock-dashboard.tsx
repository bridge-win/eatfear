"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { MarketIndicatorCards, type MarketIndicatorItem } from "@/components/market-indicator-cards"
import { MarketIndicatorDetail } from "@/components/market-indicator-detail"
import { DashboardFrame } from "@/components/page-frame"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeRangeSelector } from "@/components/time-range-selector"
import {
  isDashboardTabValue,
  usePersistentState,
  usePersistentSWR,
  writeStoredJson,
  type DashboardTabValue,
} from "@/lib/client-persistence"
import { buildIndicatorInfo, type MacroApiResponse } from "@/lib/dashboard-shared"
import { CrashDetector } from "@/lib/crash-detector"
import { useT } from "@/lib/i18n"
import { withRelevanceScore } from "@/lib/indicator-score"
import {
  DEFAULT_STOCK_MACRO_REFRESH_MS,
  DEFAULT_STOCK_REFRESH_MS,
  getEnabledStockIndicators,
  type StockIndicatorConfig,
  type StockIndicatorGroup,
} from "@/lib/stock-indicator-config"
import { fetchStockData } from "@/lib/stock-service"
import { getRangeDays, getTimeRange, isTimeRangeId, type TimeRangeId } from "@/lib/time-range"
import type { CrashAlert, MacroIndicator, StockAsset } from "@/lib/types"

const STOCK_DEFAULT_RANGE: TimeRangeId = "1y"
const STOCK_INITIAL_HISTORY_LIMIT = 12

const STOCK_HISTORY_COLORS = [
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
] as const

const STOCK_INDICATORS = getEnabledStockIndicators()
const STOCK_DATA_REFRESH_MS = Math.max(
  30_000,
  Math.min(
    ...STOCK_INDICATORS.filter((entry) => entry.kind === "stock").map((entry) => entry.refreshMs),
    DEFAULT_STOCK_REFRESH_MS,
  ),
)
const STOCK_MACRO_DATA_REFRESH_MS = Math.max(
  30_000,
  Math.min(
    ...STOCK_INDICATORS.filter((entry) => entry.kind === "macro").map((entry) => entry.refreshMs),
    DEFAULT_STOCK_MACRO_REFRESH_MS,
  ),
)
const STOCK_PRIORITY_INDICATORS = STOCK_INDICATORS
  .filter((entry) => entry.kind === "macro")
  .slice(0, STOCK_INITIAL_HISTORY_LIMIT)
const STOCK_PRIORITY_KEYS = new Set(STOCK_PRIORITY_INDICATORS.map((entry) => entry.key))
const STOCK_REST_INDICATORS = STOCK_INDICATORS.filter((entry) => !STOCK_PRIORITY_KEYS.has(entry.key))
const STOCK_PRIORITY_MACRO_SYMBOLS = STOCK_PRIORITY_INDICATORS
  .filter((entry) => entry.kind === "macro")
  .map((entry) => entry.symbol)
const STOCK_DASHBOARD_REFRESH_MS = Math.min(STOCK_DATA_REFRESH_MS, STOCK_MACRO_DATA_REFRESH_MS)

const getStockSymbolsForGroup = (
  indicators: StockIndicatorConfig[],
  group: Exclude<StockIndicatorGroup, "macro">,
): string[] =>
  indicators
    .filter((entry) => entry.kind === "stock" && entry.group === group)
    .map((entry) => entry.symbol)

function buildMacroApiUrl(range: TimeRangeId, symbols?: string[]): string {
  const params = new URLSearchParams({ range })
  if (symbols && symbols.length > 0) params.set("symbols", symbols.join(","))
  return `/api/macro?${params.toString()}`
}

function stockAssetArrayToMap(stocks: StockAsset[] | undefined): Map<string, StockAsset> {
  return new Map((stocks ?? []).map((stock) => [stock.symbol, stock]))
}

const getStockSeriesColor = (symbol: string, index: number) => {
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), index)
  return STOCK_HISTORY_COLORS[seed % STOCK_HISTORY_COLORS.length]
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

const stockSparklineToData = (asset: StockAsset, range: TimeRangeId) => {
  const values = asset.sparkline?.filter((value) => Number.isFinite(value)) ?? []
  if (values.length < 2) return []

  const now = Date.now()
  const days = getRangeDays(range)
  const start = now - days * 86_400_000
  const step = values.length > 1 ? (now - start) / (values.length - 1) : 0

  return values.map((value, index) => ({
    time: Math.round(start + step * index),
    value,
  }))
}

const buildStockIndicatorItems = ({
  range,
  macroIndicators,
  stockAssets,
}: {
  range: TimeRangeId
  macroIndicators: MacroIndicator[]
  stockAssets: Map<string, StockAsset>
}): MarketIndicatorItem[] => {
  const macroBySymbol = new Map(macroIndicators.map((indicator) => [indicator.symbol, indicator]))
  return STOCK_INDICATORS.flatMap((config, index): MarketIndicatorItem[] => {
    const color = getStockSeriesColor(config.key, index)
    if (config.kind === "macro") {
      const indicator = macroBySymbol.get(config.symbol)
      if (!indicator || indicator.history.length === 0) return []
      const info = buildIndicatorInfo(indicator)
      const relevanceScore = config.relevanceScore ?? indicator.relevanceScore
      const label = withRelevanceScore(config.label ?? indicator.name, relevanceScore)
      return [{
        key: config.key,
        order: index + 1,
        label,
        color,
        unit: toAlignedUnit(indicator.unit),
        value: Number.isFinite(indicator.value) ? indicator.value : null,
        changePercent: Number.isFinite(indicator.changePercent) ? indicator.changePercent : null,
        timestamp: indicator.lastUpdate,
        source: info?.source ?? `${indicator.source}${indicator.frequency ? ` · ${indicator.frequency}` : ""}`,
        description: config.description ?? info?.description ?? indicator.description ?? "Equity macro factor.",
        data: indicator.history.map((point) => ({ time: point.timestamp, value: point.value })),
      }]
    }

    const asset = stockAssets.get(config.symbol)
    if (!asset) return []
    const data = stockSparklineToData(asset, range)
    if (data.length === 0) return []
    const labelBase = config.label ? `${config.symbol} · ${config.label}` : `${asset.symbol} · ${asset.name}`
    return [{
      key: config.key,
      order: index + 1,
      label: withRelevanceScore(labelBase, config.relevanceScore),
      color,
      unit: "usd",
      value: Number.isFinite(asset.price) ? asset.price : null,
      changePercent: Number.isFinite(asset.changePercentToday) ? asset.changePercentToday : null,
      timestamp: asset.lastUpdate,
      source: config.source ?? "Yahoo Finance",
      description:
        config.description ??
        "意义：股票/ETF 历史价格用于观察趋势、相对强弱和风险偏好。\n影响方向：价格上行代表该资产资金偏好改善；下行代表该资产承压。",
      data,
    }]
  }).map((item, index) => ({ ...item, order: index + 1 }))
}

const buildStockHistoryData = (items: MarketIndicatorItem[]): AlignedHistoryData | null => {
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

  return { groups: [{ key: "stock", series }] }
}

interface StockDashboardPayload {
  us: StockAsset[]
  hk: StockAsset[]
  vietnam: StockAsset[]
  macro: MacroApiResponse | null
  updatedAt: number
}

type StockDashboardStage = "priority" | "rest"

const buildStockDashboardKey = (range: TimeRangeId, stage: StockDashboardStage): string => {
  return `stock-dashboard:${range}:${stage}`
}

function parseStockDashboardKey(key: string): { range: TimeRangeId; stage: StockDashboardStage } {
  const [, range, stage] = key.split(":")
  if (!range || !isTimeRangeId(range)) throw new Error(`Invalid stock dashboard range: ${range ?? ""}`)
  return { range, stage: stage === "rest" ? "rest" : "priority" }
}

async function fetchStockMacroPayload(range: TimeRangeId, symbols?: string[]): Promise<MacroApiResponse | null> {
  try {
    const response = await fetch(buildMacroApiUrl(range, symbols))
    if (!response.ok) return null
    return (await response.json()) as MacroApiResponse
  } catch {
    return null
  }
}

async function fetchStockDashboardPayload(key: string): Promise<StockDashboardPayload> {
  const { range, stage } = parseStockDashboardKey(key)
  const rangeOption = getTimeRange(range)
  const indicators =
    stage === "priority" ? STOCK_PRIORITY_INDICATORS : STOCK_REST_INDICATORS
  const usSymbols = getStockSymbolsForGroup(indicators, "us")
  const hkSymbols = getStockSymbolsForGroup(indicators, "hk")
  const vietnamSymbols = getStockSymbolsForGroup(indicators, "vietnam")
  const macroSymbols = indicators.filter((entry) => entry.kind === "macro").map((entry) => entry.symbol)
  const stockOptions = {
    sparkRange: rangeOption.yahooRange,
    sparkInterval: rangeOption.yahooInterval,
  }
  const [usData, hkData, vietnamData, macro] = await Promise.all([
    fetchStockData(usSymbols, stockOptions),
    fetchStockData(hkSymbols, stockOptions),
    fetchStockData(vietnamSymbols, stockOptions),
    macroSymbols.length > 0 ? fetchStockMacroPayload(range, macroSymbols) : Promise.resolve(null),
  ])

  return {
    us: Array.from(usData.values()),
    hk: Array.from(hkData.values()),
    vietnam: Array.from(vietnamData.values()),
    macro,
    updatedAt: Date.now(),
  }
}

function mergeStockAssets(left: StockAsset[] | undefined, right: StockAsset[] | undefined): StockAsset[] {
  return Array.from(new Map([...(left ?? []), ...(right ?? [])].map((stock) => [stock.symbol, stock])).values())
}

function mergeStockMacroPayloads(
  priority: MacroApiResponse | null | undefined,
  rest: MacroApiResponse | null | undefined,
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
  const indicators = Array.from(indicatorsBySymbol.values())
  return {
    ...base,
    indicators,
    requested: STOCK_INDICATORS.filter((entry) => entry.kind === "macro").length,
    returned: indicators.length,
    refreshMs: STOCK_MACRO_DATA_REFRESH_MS,
    updatedAt: Math.max(priority?.updatedAt ?? 0, rest?.updatedAt ?? 0, base.updatedAt),
  }
}

function mergeStockDashboardPayloads(
  priority: StockDashboardPayload | undefined,
  rest: StockDashboardPayload | undefined,
): StockDashboardPayload | null {
  if (!priority && !rest) return null
  const base = priority ?? rest
  if (!base) return null
  return {
    us: mergeStockAssets(priority?.us, rest?.us),
    hk: mergeStockAssets(priority?.hk, rest?.hk),
    vietnam: mergeStockAssets(priority?.vietnam, rest?.vietnam),
    macro: mergeStockMacroPayloads(priority?.macro, rest?.macro),
    updatedAt: Math.max(priority?.updatedAt ?? 0, rest?.updatedAt ?? 0, base.updatedAt),
  }
}

export interface StockDashboardProps {
  initialUsStocks?: StockAsset[]
  initialHkStocks?: StockAsset[]
  initialVietnamStocks?: StockAsset[]
  initialMacroIndicators?: MacroIndicator[]
}

export function StockDashboard({
  initialUsStocks,
  initialHkStocks,
  initialVietnamStocks,
  initialMacroIndicators,
}: StockDashboardProps = {}) {
  const [range, setRange] = usePersistentState("stock:range", STOCK_DEFAULT_RANGE, isTimeRangeId)
  const [tab, setTab] = usePersistentState<DashboardTabValue>("stock:tab", "history", isDashboardTabValue)
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null)
  const crashDetectorRef = useRef(new CrashDetector())
  const t = useT()
  const fullStorageKey = `stock:${range}:full`

  const initialPayload = useMemo<StockDashboardPayload | undefined>(() => {
    const hasStocks =
      (initialUsStocks?.length ?? 0) > 0 ||
      (initialHkStocks?.length ?? 0) > 0 ||
      (initialVietnamStocks?.length ?? 0) > 0
    const hasMacro = (initialMacroIndicators?.length ?? 0) > 0
    if (!hasStocks && !hasMacro) return undefined

    const rangeOption = getTimeRange(STOCK_DEFAULT_RANGE)
    return {
      us: initialUsStocks ?? [],
      hk: initialHkStocks ?? [],
      vietnam: initialVietnamStocks ?? [],
      macro: hasMacro
        ? {
            indicators: initialMacroIndicators ?? [],
            range: STOCK_DEFAULT_RANGE,
            interval: rangeOption.yahooInterval,
            updatedAt: Date.now(),
            requested: STOCK_PRIORITY_MACRO_SYMBOLS.length,
            returned: initialMacroIndicators?.length ?? 0,
            refreshMs: STOCK_MACRO_DATA_REFRESH_MS,
          }
        : null,
      updatedAt: Date.now(),
    }
  }, [initialHkStocks, initialMacroIndicators, initialUsStocks, initialVietnamStocks])

  const priority = usePersistentSWR<StockDashboardPayload>(
    `stock:${range}:priority:${STOCK_INITIAL_HISTORY_LIMIT}`,
    buildStockDashboardKey(range, "priority"),
    fetchStockDashboardPayload,
    { revalidateIfStale: true },
  )
  const rest = usePersistentSWR<StockDashboardPayload>(
    `stock:${range}:rest:${STOCK_INITIAL_HISTORY_LIMIT}`,
    buildStockDashboardKey(range, "rest"),
    fetchStockDashboardPayload,
    {
      refreshInterval: STOCK_DASHBOARD_REFRESH_MS,
    },
  )
  const fullCache = usePersistentSWR<StockDashboardPayload>(
    fullStorageKey,
    null,
    fetchStockDashboardPayload,
    { fallbackData: range === STOCK_DEFAULT_RANGE ? initialPayload : undefined },
  )
  const mergedPayload = useMemo(() => mergeStockDashboardPayloads(priority.data, rest.data), [priority.data, rest.data])
  const hasCompleteNetworkPayload = priority.data !== undefined && rest.data !== undefined
  const networkPayload = hasCompleteNetworkPayload ? mergedPayload : null
  const payload = networkPayload ?? fullCache.data ?? priority.data ?? initialPayload

  useEffect(() => {
    if (mergedPayload && hasCompleteNetworkPayload) writeStoredJson(fullStorageKey, mergedPayload)
  }, [fullStorageKey, hasCompleteNetworkPayload, mergedPayload])

  const macroIndicators = payload?.macro?.indicators ?? []
  const isLoading = payload
    ? priority.isValidating || rest.isValidating || (!mergedPayload && !fullCache.data && rest.isLoading)
    : fullCache.isLoading || priority.isLoading || rest.isLoading
  const error = payload ? null : priority.error?.message ?? rest.error?.message ?? fullCache.error?.message ?? null

  const stockAssets = useMemo(
    () =>
      new Map([
        ...stockAssetArrayToMap(payload?.us),
        ...stockAssetArrayToMap(payload?.hk),
        ...stockAssetArrayToMap(payload?.vietnam),
      ]),
    [payload?.hk, payload?.us, payload?.vietnam],
  )

  useEffect(() => {
    const detectedCrashes: CrashAlert[] = []
    stockAssets.forEach((stock) => {
      crashDetectorRef.current.updatePrice(stock.symbol, stock.price)
      const assetType = stock.symbol.includes(".HK") ? "hk_stock" : "stock"
      detectedCrashes.push(...crashDetectorRef.current.detectCrashes(stock, assetType))
    })
    if (detectedCrashes.length === 0) return

    setCrashes((previous) => {
      const existing = previous.filter(
        (crash) =>
          !detectedCrashes.some(
            (detectedCrash) =>
              detectedCrash.symbol === crash.symbol && detectedCrash.timeframe === crash.timeframe,
          ),
      )
      return [...existing, ...detectedCrashes]
    })
  }, [stockAssets])
  const stockItems = useMemo(
    () => buildStockIndicatorItems({ range, macroIndicators, stockAssets }),
    [range, macroIndicators, stockAssets],
  )
  const stockHistoryData = useMemo(
    () => buildStockHistoryData(stockItems),
    [stockItems],
  )

  return (
    <DashboardFrame>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("stock.title")}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("stock.subtitle")}</p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </header>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isDashboardTabValue(next)) setTab(next)
        }}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full max-w-xs grid-cols-2">
          <TabsTrigger value="realtime" className="text-xs">{t("stock.tab.realtime")}</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">{t("stock.tab.history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="realtime" className="mt-3 space-y-3">
          <CrashAlertBanner crashes={crashes} />
          {selectedIndicatorKey && stockItems.length > 0 ? (
            <MarketIndicatorDetail
              items={stockItems}
              selectedKey={selectedIndicatorKey}
              backLabel={t("stock.detail.back")}
              subtitle={t("stock.detail.subtitle")}
              searchPlaceholder={t("stock.detail.search")}
              emptyMessage={t("stock.detail.empty")}
              addCompareLabel={t("stock.detail.addCompare")}
              chartTitle={t("stock.detail.chartTitle")}
              chartInfo={t("stock.detail.chartInfo")}
              chartInfoSource="Yahoo Finance · FRED · aligned timeline"
              loadingLabel={t("stock.loading")}
              noDataLabel={t("chart.noData")}
              seriesCountLabel={t("compare.seriesCount")}
              onBack={() => setSelectedIndicatorKey(null)}
            />
          ) : (
            <MarketIndicatorCards
              items={stockItems}
              loading={isLoading}
              error={error}
              loadingLabel={t("stock.loading")}
              noDataLabel={t("stock.empty")}
              expectedCount={STOCK_INDICATORS.length}
              onSelectItem={setSelectedIndicatorKey}
              dataPrefix="stock"
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <AlignedHistoryCompare
            data={stockHistoryData}
            title={t("stock.historyCompare.title")}
            infoDescription={t("stock.historyCompare.info")}
            infoSource="Yahoo Finance · FRED · TradingView Lightweight Charts"
            loading={isLoading}
            error={error}
            loadingLabel={t("stock.loading")}
            noDataLabel={t("chart.noData")}
            seriesCountLabel={t("compare.seriesCount")}
            expectedSeriesCount={STOCK_INDICATORS.length}
          />
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
