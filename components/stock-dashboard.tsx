"use client"

import { useEffect, useState } from "react"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CrashLeaderboard } from "@/components/crash-leaderboard"
import { SiteHeader } from "@/components/site-header"
import { StockPriceCard } from "@/components/stock-price-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CrashDetector } from "@/lib/crash-detector"
import { calculateCrashLeaderboard, fetchStockData, STOCK_CATEGORIES } from "@/lib/stock-service"
import type { CrashAlert, StockAsset } from "@/lib/types"

export function StockDashboard() {
  const [usStockAssets, setUsStockAssets] = useState<Map<string, StockAsset>>(new Map())
  const [hkStockAssets, setHkStockAssets] = useState<Map<string, StockAsset>>(new Map())
  const [vietnamStockAssets, setVietnamStockAssets] = useState<Map<string, StockAsset>>(new Map())
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    const stockInterval = setInterval(loadStockData, 60 * 1000)

    return () => {
      clearInterval(stockInterval)
    }
  }, [])

  const usStockArray = Array.from(usStockAssets.values())
  const hkStockArray = Array.from(hkStockAssets.values())
  const vietnamStockArray = Array.from(vietnamStockAssets.values())
  const crashLeaderboard = calculateCrashLeaderboard([...usStockArray, ...hkStockArray, ...vietnamStockArray])

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              美股、港股和越南概念股公开行情。数据来自 Yahoo Finance，通常延迟 15-30 分钟。
            </p>
          </div>

          <CrashAlertBanner crashes={crashes} />
          <CrashLeaderboard stocks={crashLeaderboard} />

          <Tabs defaultValue="us-stocks" className="w-full">
            <TabsList className="grid h-auto w-full max-w-3xl grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="us-stocks">美股 Top 50</TabsTrigger>
              <TabsTrigger value="hk-stocks">港股 Top 20</TabsTrigger>
              <TabsTrigger value="vietnam">越南概念股</TabsTrigger>
            </TabsList>
            <TabsContent value="us-stocks" className="mt-6">
              <StockGrid
                title="美股 Top 50"
                description="包含 S&P 500、NASDAQ 100、Dow Jones ETF 与主流大市值公司。"
                stocks={usStockArray}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="hk-stocks" className="mt-6">
              <StockGrid
                title="港股 Top 20"
                description="覆盖港股核心权重和大型互联网、金融、能源公司。"
                stocks={hkStockArray}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="vietnam" className="mt-6">
              <StockGrid
                title="越南概念股"
                description="包含 VNM ETF 及具备亚洲成长资产暴露的相关股票。"
                stocks={vietnamStockArray}
                isLoading={isLoading}
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
}: {
  title: string
  description: string
  stocks: StockAsset[]
  isLoading: boolean
}) {
  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {stocks.length === 0 ? (
        <p className="text-muted-foreground">{isLoading ? "Loading stock data..." : "No stock data available."}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stocks.map((asset) => (
            <StockPriceCard key={asset.symbol} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}
