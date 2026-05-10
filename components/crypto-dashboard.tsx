"use client"

import { useEffect, useState } from "react"
import { BtcVolatilitySystem } from "@/components/btc-volatility-system"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CryptoPriceCard } from "@/components/crypto-price-card"
import { FearGreedGauge } from "@/components/fear-greed-gauge"
import { MarketStatsPanel } from "@/components/market-stats-panel"
import { SiteHeader } from "@/components/site-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchCryptoMarketSnapshot, fetchFearGreedIndex, fetchMarketStats } from "@/lib/crypto-service"
import { CrashDetector } from "@/lib/crash-detector"
import type { CrashAlert, CryptoAsset, FearGreedIndex, MarketStats } from "@/lib/types"

export function CryptoDashboard() {
  const [cryptoAssets, setCryptoAssets] = useState<Map<string, CryptoAsset>>(new Map())
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(null)
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true)

  useEffect(() => {
    const crashDetector = new CrashDetector()

    async function loadCryptoMarkets() {
      const assets = await fetchCryptoMarketSnapshot()

      if (assets.size > 0) {
        setCryptoAssets(assets)

        assets.forEach((asset) => {
          crashDetector.updatePrice(asset.symbol, asset.price)
          const detectedCrashes = crashDetector.detectCrashes(asset, "crypto")

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

      setIsLoadingMarkets(false)
    }

    loadCryptoMarkets()
    fetchFearGreedIndex().then(setFearGreed)
    fetchMarketStats().then(setMarketStats)

    const cryptoInterval = setInterval(loadCryptoMarkets, 15 * 1000)
    const marketInterval = setInterval(() => {
      fetchFearGreedIndex().then(setFearGreed)
      fetchMarketStats().then(setMarketStats)
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(cryptoInterval)
      clearInterval(marketInterval)
    }
  }, [])

  const cryptoArray = Array.from(cryptoAssets.values())

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-4">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crypto Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              OKX 公开行情 + BTC 永续衍生品历史曲线；Binance 在本机网络返回 451 时不再阻塞首屏。
            </p>
          </div>

          <CrashAlertBanner crashes={crashes} />

          <div className="grid gap-4 md:grid-cols-2">
            <MarketStatsPanel stats={marketStats} />
            <FearGreedGauge index={fearGreed} />
          </div>

          <Tabs defaultValue="btc-volatility" className="w-full">
            <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
              <TabsTrigger value="btc-volatility">BTC 极端波动</TabsTrigger>
              <TabsTrigger value="crypto">加密货币</TabsTrigger>
            </TabsList>
            <TabsContent value="btc-volatility" className="mt-6">
              <BtcVolatilitySystem />
            </TabsContent>
            <TabsContent value="crypto" className="mt-6">
              <div>
                <h2 className="mb-3 text-xl font-bold">Top Cryptocurrencies</h2>
                {cryptoArray.length === 0 ? (
                  <p className="text-muted-foreground">
                    {isLoadingMarkets ? "Loading OKX spot market snapshot..." : "No crypto market data available."}
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {cryptoArray.map((asset) => (
                      <CryptoPriceCard key={asset.symbol} asset={asset} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
