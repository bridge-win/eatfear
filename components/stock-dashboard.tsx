"use client"

import { useEffect, useMemo, useState } from "react"

import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CrashLeaderboard } from "@/components/crash-leaderboard"
import { KpiStrip, type KpiTile } from "@/components/kpi-strip"
import { formatValue as formatSeriesValue, type SeriesChartUnit } from "@/components/series-chart"
import { SiteHeader } from "@/components/site-header"
import { StockPriceCard } from "@/components/stock-price-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeRangeSelector } from "@/components/time-range-selector"
import {
  buildIndicatorInfo,
  formatPercentDelta,
  getDeltaTone,
  type MacroApiResponse,
} from "@/lib/dashboard-shared"
import { CrashDetector } from "@/lib/crash-detector"
import { useT } from "@/lib/i18n"
import { calculateCrashLeaderboard, fetchStockData, STOCK_CATEGORIES } from "@/lib/stock-service"
import { type TimeRangeId } from "@/lib/time-range"

const STOCK_DEFAULT_RANGE: TimeRangeId = "1y"
import type { CrashAlert, MacroIndicator, StockAsset } from "@/lib/types"

const STOCK_KPI_SYMBOLS = [
  "^GSPC",
  "^IXIC",
  "^DJI",
  "^RUT",
  "^HSI",
  "^N225",
  "^VIX",
  "DX-Y.NYB",
  "GC=F",
  "CL=F",
]

const KPI_SPARK_POINTS = 30
const STOCK_REFRESH_MS = 60 * 1000
const MACRO_REFRESH_MS = 5 * 60 * 1000

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
  const t = useT()

  useEffect(() => {
    const crashDetector = new CrashDetector()

    async function loadStockData() {
      const [usData, hkData, vietnamData] = await Promise.all([
        fetchStockData(STOCK_CATEGORIES.us.stocks.map((stock) => stock.symbol)),
        fetchStockData(STOCK_CATEGORIES.hk.stocks.map((stock) => stock.symbol)),
        fetchStockData(STOCK_CATEGORIES.vietnam.stocks.map((stock) => stock.symbol)),
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
    const stockInterval = setInterval(loadStockData, STOCK_REFRESH_MS)
    return () => clearInterval(stockInterval)
  }, [])

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
    const interval = setInterval(loadMacro, MACRO_REFRESH_MS)
    return () => {
      isActive = false
      controller.abort()
      clearInterval(interval)
    }
  }, [range])

  const kpiTiles: KpiTile[] = useMemo(() => {
    const map = new Map(macroIndicators.map((indicator) => [indicator.symbol, indicator]))
    return STOCK_KPI_SYMBOLS.map((symbol): KpiTile | null => {
      const indicator = map.get(symbol)
      if (!indicator) return null
      return {
        id: indicator.symbol,
        label: indicator.name,
        value: formatSeriesValue(indicator.value, indicator.unit as SeriesChartUnit, true),
        delta: formatPercentDelta(indicator.changePercent),
        deltaTone: getDeltaTone(indicator.change),
        helper: indicator.symbol,
        sparkline: indicator.history.slice(-KPI_SPARK_POINTS).map((point) => point.value),
        info: buildIndicatorInfo(indicator),
      }
    }).filter((tile): tile is KpiTile => tile !== null)
  }, [macroIndicators])

  const usStockArray = Array.from(usStockAssets.values())
  const hkStockArray = Array.from(hkStockAssets.values())
  const vietnamStockArray = Array.from(vietnamStockAssets.values())
  const crashLeaderboard = calculateCrashLeaderboard([...usStockArray, ...hkStockArray, ...vietnamStockArray])

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-3">
        <div className="space-y-3">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t("stock.title")}</h1>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t("stock.subtitle")}</p>
            </div>
            <TimeRangeSelector value={range} onChange={setRange} />
          </header>

          <KpiStrip tiles={kpiTiles} />

          <CrashAlertBanner crashes={crashes} />
          <CrashLeaderboard stocks={crashLeaderboard} />

          <Tabs defaultValue="us-stocks" className="w-full">
            <TabsList className="grid h-auto w-full max-w-2xl grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="us-stocks" className="text-xs">{t("stock.tab.us")}</TabsTrigger>
              <TabsTrigger value="hk-stocks" className="text-xs">{t("stock.tab.hk")}</TabsTrigger>
              <TabsTrigger value="vietnam" className="text-xs">{t("stock.tab.vietnam")}</TabsTrigger>
            </TabsList>
            <TabsContent value="us-stocks" className="mt-3">
              <StockGrid
                title={t("stock.tab.us")}
                description={t("stock.us.desc")}
                stocks={usStockArray}
                isLoading={isLoading}
                loadingLabel={t("stock.loading")}
                emptyLabel={t("stock.empty")}
              />
            </TabsContent>
            <TabsContent value="hk-stocks" className="mt-3">
              <StockGrid
                title={t("stock.tab.hk")}
                description={t("stock.hk.desc")}
                stocks={hkStockArray}
                isLoading={isLoading}
                loadingLabel={t("stock.loading")}
                emptyLabel={t("stock.empty")}
              />
            </TabsContent>
            <TabsContent value="vietnam" className="mt-3">
              <StockGrid
                title={t("stock.tab.vietnam")}
                description={t("stock.vietnam.desc")}
                stocks={vietnamStockArray}
                isLoading={isLoading}
                loadingLabel={t("stock.loading")}
                emptyLabel={t("stock.empty")}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function StockGrid({
  title,
  description,
  stocks,
  isLoading,
  loadingLabel,
  emptyLabel,
}: {
  title: string
  description: string
  stocks: StockAsset[]
  isLoading: boolean
  loadingLabel: string
  emptyLabel: string
}) {
  return (
    <div>
      <h2 className="mb-0.5 text-base font-semibold">{title}</h2>
      <p className="mb-2 text-[11px] text-muted-foreground">{description}</p>
      {stocks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{isLoading ? loadingLabel : emptyLabel}</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stocks.map((asset) => (
            <StockPriceCard key={asset.symbol} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}
