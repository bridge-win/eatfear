"use client"

import { useEffect, useMemo, useState } from "react"

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
import { buildIndicatorInfo, type MacroApiResponse } from "@/lib/dashboard-shared"
import { CrashDetector } from "@/lib/crash-detector"
import { useT } from "@/lib/i18n"
import { withRelevanceScore } from "@/lib/indicator-score"
import {
  DEFAULT_STOCK_MACRO_REFRESH_MS,
  DEFAULT_STOCK_REFRESH_MS,
  getEnabledStockIndicators,
  getEnabledStockSymbols,
} from "@/lib/stock-indicator-config"
import { fetchStockData } from "@/lib/stock-service"
import { getRangeDays, getTimeRange, type TimeRangeId } from "@/lib/time-range"
import type { CrashAlert, MacroIndicator, StockAsset } from "@/lib/types"

const STOCK_DEFAULT_RANGE: TimeRangeId = "1y"

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
  const [usStockAssets, setUsStockAssets] = useState<Map<string, StockAsset>>(
    () => new Map((initialUsStocks ?? []).map((s) => [s.symbol, s])),
  )
  const [hkStockAssets, setHkStockAssets] = useState<Map<string, StockAsset>>(
    () => new Map((initialHkStocks ?? []).map((s) => [s.symbol, s])),
  )
  const [vietnamStockAssets, setVietnamStockAssets] = useState<Map<string, StockAsset>>(
    () => new Map((initialVietnamStocks ?? []).map((s) => [s.symbol, s])),
  )
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [isLoading, setIsLoading] = useState(
    !(initialUsStocks && initialHkStocks && initialVietnamStocks),
  )
  const [macroIndicators, setMacroIndicators] = useState<MacroIndicator[]>(initialMacroIndicators ?? [])
  const [range, setRange] = useState<TimeRangeId>(STOCK_DEFAULT_RANGE)
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    const crashDetector = new CrashDetector()
    const rangeOption = getTimeRange(range)

    async function loadStockData() {
      const usSymbols = getEnabledStockSymbols("us")
      const hkSymbols = getEnabledStockSymbols("hk")
      const vietnamSymbols = getEnabledStockSymbols("vietnam")
      const [usData, hkData, vietnamData] = await Promise.all([
        fetchStockData(usSymbols, {
          sparkRange: rangeOption.yahooRange,
          sparkInterval: rangeOption.yahooInterval,
        }),
        fetchStockData(hkSymbols, {
          sparkRange: rangeOption.yahooRange,
          sparkInterval: rangeOption.yahooInterval,
        }),
        fetchStockData(vietnamSymbols, {
          sparkRange: rangeOption.yahooRange,
          sparkInterval: rangeOption.yahooInterval,
        }),
      ])

      setUsStockAssets(usData)
      setHkStockAssets(hkData)
      setVietnamStockAssets(vietnamData)
      setIsLoading(false)

      const allStockData = new Map([...usData, ...hkData, ...vietnamData])
      allStockData.forEach((stock) => {
        crashDetector.updatePrice(stock.symbol, stock.price)
        const assetType = stock.symbol.includes(".HK") ? "hk_stock" : "stock"
        const detectedCrashes = crashDetector.detectCrashes(stock, assetType)
        if (detectedCrashes.length > 0) {
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
        }
      })
    }

    loadStockData()
    const stockInterval = setInterval(loadStockData, STOCK_DATA_REFRESH_MS)
    return () => clearInterval(stockInterval)
  }, [range])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    async function loadMacro() {
      try {
        const response = await fetch(`/api/macro?range=${range}`, { signal: controller.signal })
        if (!response.ok) return
        const payload = (await response.json()) as MacroApiResponse
        if (isActive) setMacroIndicators(payload.indicators ?? [])
      } catch {
        // ignore — KPI strip is optional
      }
    }

    loadMacro()
    const interval = setInterval(loadMacro, STOCK_MACRO_DATA_REFRESH_MS)
    return () => {
      isActive = false
      controller.abort()
      clearInterval(interval)
    }
  }, [range])

  const stockAssets = useMemo(
    () => new Map([...usStockAssets, ...hkStockAssets, ...vietnamStockAssets]),
    [usStockAssets, hkStockAssets, vietnamStockAssets],
  )
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

      <Tabs defaultValue="history" className="w-full">
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
              error={null}
              loadingLabel={t("stock.loading")}
              noDataLabel={t("stock.empty")}
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
            error={null}
            loadingLabel={t("stock.loading")}
            noDataLabel={t("chart.noData")}
            seriesCountLabel={t("compare.seriesCount")}
          />
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
