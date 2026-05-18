"use client"

import { useEffect, useMemo, useState } from "react"

import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CrashLeaderboard } from "@/components/crash-leaderboard"
import { KpiStrip, type KpiTile } from "@/components/kpi-strip"
import { DashboardFrame } from "@/components/page-frame"
import { formatValue as formatSeriesValue, type SeriesChartUnit } from "@/components/series-chart"
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
import type { CrashAlert, MacroIndicator, StockAsset } from "@/lib/types"

const STOCK_DEFAULT_RANGE: TimeRangeId = "1y"

const STOCK_KPI_SYMBOLS = [
  "ES=F",
  "NQ=F",
  "^GSPC",
  "^NDX",
  "^IXIC",
  "^RUT",
  "^SOX",
  "SMH",
  "XLK",
  "XLF",
  "KRE",
  "XLE",
  "^VIX",
  "^VXN",
  "^VVIX",
  "^SKEW",
  "FRED:DGS10",
  "FRED:DGS2",
  "FRED:T10Y2Y",
  "FRED:DFII10",
  "FRED:BAMLH0A0HYM2",
  "FRED:NFCI",
  "DX-Y.NYB",
  "HYG",
  "LQD",
  "TLT",
  "^DJI",
  "^HSI",
  "^N225",
  "GC=F",
  "CL=F",
  "HG=F",
]

const US_STOCK_DISPLAY_PRIORITY = [
  "SPY",
  "QQQ",
  "DIA",
  "NVDA",
  "TSLA",
  "AAPL",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL",
  "AMD",
  "AVGO",
  "JPM",
  "GS",
  "XOM",
  "CAT",
] as const

const HK_STOCK_DISPLAY_PRIORITY = [
  "0700.HK",
  "9988.HK",
  "3690.HK",
  "0388.HK",
  "1299.HK",
  "0005.HK",
  "0941.HK",
  "0883.HK",
] as const

const VIETNAM_STOCK_DISPLAY_PRIORITY = [
  "VNM",
  "FUTU",
  "BABA",
  "PDD",
  "JD",
  "LI",
  "NIO",
  "XPEV",
] as const

const KPI_SPARK_POINTS = 30
const STOCK_REFRESH_MS = 60 * 1000
const MACRO_REFRESH_MS = 5 * 60 * 1000

const sortStockAssets = <T extends readonly string[]>(assets: StockAsset[], priority: T) => {
  const order = new Map<string, number>(priority.map((symbol, index) => [symbol, index]))
  return assets
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      const priorityDelta =
        (order.get(a.asset.symbol) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.asset.symbol) ?? Number.MAX_SAFE_INTEGER)
      if (priorityDelta !== 0) return priorityDelta
      return a.index - b.index
    })
    .map(({ asset }) => asset)
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

  const usStockArray = useMemo(
    () => sortStockAssets(Array.from(usStockAssets.values()), US_STOCK_DISPLAY_PRIORITY),
    [usStockAssets],
  )
  const hkStockArray = useMemo(
    () => sortStockAssets(Array.from(hkStockAssets.values()), HK_STOCK_DISPLAY_PRIORITY),
    [hkStockAssets],
  )
  const vietnamStockArray = useMemo(
    () => sortStockAssets(Array.from(vietnamStockAssets.values()), VIETNAM_STOCK_DISPLAY_PRIORITY),
    [vietnamStockAssets],
  )
  const crashLeaderboard = calculateCrashLeaderboard([...usStockArray, ...hkStockArray, ...vietnamStockArray])

  return (
    <DashboardFrame>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("stock.title")}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("stock.subtitle")}</p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </header>

      <CrashAlertBanner crashes={crashes} />

      <KpiStrip tiles={kpiTiles} />
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
    </DashboardFrame>
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
