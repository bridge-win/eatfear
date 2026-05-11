"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CryptoPriceCard } from "@/components/crypto-price-card"
import { StockPriceCard } from "@/components/stock-price-card"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { MarketStatsPanel } from "@/components/market-stats-panel"
import { FearGreedGauge } from "@/components/fear-greed-gauge"
import { CrashLeaderboard } from "@/components/crash-leaderboard"
import { BinanceWebSocketService, fetchFearGreedIndex, fetchMarketStats } from "@/lib/crypto-service"
import { fetchStockData, calculateCrashLeaderboard, STOCK_CATEGORIES } from "@/lib/stock-service"
import { CrashDetector } from "@/lib/crash-detector"
import { ClientAlertChecker } from "@/lib/client-alert-checker"
import { useToast } from "@/hooks/use-toast"
import type { CryptoAsset, StockAsset, FearGreedIndex, MarketStats, CrashAlert, Subscription } from "@/lib/types"
import { TrendingDown, User, LogOut } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [cryptoAssets, setCryptoAssets] = useState<Map<string, CryptoAsset>>(new Map())
  const [usStockAssets, setUsStockAssets] = useState<Map<string, StockAsset>>(new Map())
  const [hkStockAssets, setHkStockAssets] = useState<Map<string, StockAsset>>(new Map())
  const [vietnamStockAssets, setVietnamStockAssets] = useState<Map<string, StockAsset>>(new Map())
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(null)
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const supabase = createClient()
    let wsService: BinanceWebSocketService | null = null
    const crashDetector = new CrashDetector()
    const alertChecker = new ClientAlertChecker()

    alertChecker.onAlert((alert) => {
      toast({
        variant: "destructive",
        title: `🚨 Price Alert: ${alert.assetName}`,
        description: `${alert.assetSymbol} dropped ${alert.dropPercentage.toFixed(2)}% to $${alert.currentPrice.toLocaleString()}`,
      })
    })

    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.push("/auth/login")
        return
      }
      setUser(data.user)
      setIsLoading(false)

      loadSubscriptions()
    })

    wsService = new BinanceWebSocketService()
    wsService.connect((asset) => {
      setCryptoAssets((prev) => {
        const updated = new Map(prev)
        updated.set(asset.symbol, asset)
        return updated
      })

      crashDetector.updatePrice(asset.symbol, asset.price)
      const detectedCrashes = crashDetector.detectCrashes(asset, "crypto")

      if (detectedCrashes.length > 0) {
        setCrashes((prev) => {
          const existing = prev.filter(
            (c) => !detectedCrashes.some((dc) => dc.symbol === c.symbol && dc.timeframe === c.timeframe),
          )
          return [...existing, ...detectedCrashes]
        })
      }

      alertChecker.checkCryptoPrice(asset.symbol, asset.price, asset.changePercent24h)
    })

    loadStockData()

    fetchFearGreedIndex().then(setFearGreed)

    fetchMarketStats().then(setMarketStats)

    const stockInterval = setInterval(() => {
      loadStockData()
    }, 60 * 1000)

    const marketInterval = setInterval(
      () => {
        fetchFearGreedIndex().then(setFearGreed)
        fetchMarketStats().then(setMarketStats)
      },
      5 * 60 * 1000,
    )

    async function loadSubscriptions() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)

      if (!error && data) {
        setSubscriptions(data)
      }
    }

    async function loadStockData() {
      // Load US stocks
      const usSymbols = STOCK_CATEGORIES.us.stocks.map((s) => s.symbol)
      const usData = await fetchStockData(usSymbols)
      setUsStockAssets(usData)

      // Load HK stocks
      const hkSymbols = STOCK_CATEGORIES.hk.stocks.map((s) => s.symbol)
      const hkData = await fetchStockData(hkSymbols)
      setHkStockAssets(hkData)

      // Load Vietnam concept stocks
      const vietnamSymbols = STOCK_CATEGORIES.vietnam.stocks.map((s) => s.symbol)
      const vietnamData = await fetchStockData(vietnamSymbols)
      setVietnamStockAssets(vietnamData)

      // Process all stocks for crash detection
      const allStockData = new Map([...usData, ...hkData, ...vietnamData])
      allStockData.forEach((stock) => {
        crashDetector.updatePrice(stock.symbol, stock.price)
        const assetType = stock.symbol.includes(".HK") ? "hk_stock" : "stock"
        const detectedCrashes = crashDetector.detectCrashes(stock, assetType)

        if (detectedCrashes.length > 0) {
          setCrashes((prev) => {
            const existing = prev.filter(
              (c) => !detectedCrashes.some((dc) => dc.symbol === c.symbol && dc.timeframe === c.timeframe),
            )
            return [...existing, ...detectedCrashes]
          })
        }

        alertChecker.checkStockPrice(stock.symbol, stock.name, stock.price, stock.changePercentToday)
      })
    }

    return () => {
      if (wsService) wsService.disconnect()
      clearInterval(stockInterval)
      clearInterval(marketInterval)
    }
  }, [router, toast])

  const handleSubscribeToggle = async (symbol: string, assetType: "crypto" | "stock" | "hk_stock" | "vietnam_stock") => {
    if (!user) return

    const supabase = createClient()
    const isSubscribed = subscriptions.some((s) => s.asset_symbol === symbol && s.asset_type === assetType)

    if (isSubscribed) {
      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("asset_symbol", symbol)
        .eq("asset_type", assetType)

      if (!error) {
        setSubscriptions((prev) => prev.filter((s) => !(s.asset_symbol === symbol && s.asset_type === assetType)))
      }
    } else {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          asset_symbol: symbol,
          asset_type: assetType,
          threshold_percent: assetType === "crypto" ? 5.0 : 3.0,
        })
        .select()
        .single()

      if (!error && data) {
        setSubscriptions((prev) => [...prev, data])
      }
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  const cryptoArray = Array.from(cryptoAssets.values())
  const usStockArray = Array.from(usStockAssets.values())
  const hkStockArray = Array.from(hkStockAssets.values())
  const vietnamStockArray = Array.from(vietnamStockAssets.values())
  const allStockArray = [...usStockArray, ...hkStockArray, ...vietnamStockArray]
  const crashLeaderboard = calculateCrashLeaderboard(allStockArray)

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">eatfear</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/profile">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Market Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time market monitoring with crash detection. Click the bell icon to subscribe to alerts.
            </p>
          </div>

          <CrashAlertBanner crashes={crashes} />

          <div className="grid gap-6 md:grid-cols-2">
            <MarketStatsPanel stats={marketStats} />
            <FearGreedGauge index={fearGreed} />
          </div>

          <CrashLeaderboard stocks={crashLeaderboard} />

          <Tabs defaultValue="crypto" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="crypto">加密货币</TabsTrigger>
              <TabsTrigger value="us-stocks">美股 Top 50</TabsTrigger>
              <TabsTrigger value="hk-stocks">港股 Top 20</TabsTrigger>
              <TabsTrigger value="vietnam">越南概念股</TabsTrigger>
            </TabsList>
            <TabsContent value="crypto" className="mt-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Top Cryptocurrencies</h2>
                {cryptoArray.length === 0 ? (
                  <p className="text-muted-foreground">Connecting to market data...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {cryptoArray.map((asset) => (
                      <CryptoPriceCard
                        key={asset.symbol}
                        asset={asset}
                        isSubscribed={subscriptions.some(
                          (s) => s.asset_symbol === asset.symbol && s.asset_type === "crypto",
                        )}
                        onSubscribeToggle={(symbol) => handleSubscribeToggle(symbol, "crypto")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="us-stocks" className="mt-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">美股 Top 50</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  数据延迟 15-30 分钟，每 60 秒更新一次
                </p>
                {usStockArray.length === 0 ? (
                  <p className="text-muted-foreground">Loading stock data...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {usStockArray.map((asset) => (
                      <StockPriceCard
                        key={asset.symbol}
                        asset={asset}
                        isSubscribed={subscriptions.some(
                          (s) => s.asset_symbol === asset.symbol && s.asset_type === "stock",
                        )}
                        onSubscribeToggle={(symbol) => handleSubscribeToggle(symbol, "stock")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="hk-stocks" className="mt-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">港股 Top 20</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  数据延迟 15-30 分钟，每 60 秒更新一次
                </p>
                {hkStockArray.length === 0 ? (
                  <p className="text-muted-foreground">Loading stock data...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {hkStockArray.map((asset) => (
                      <StockPriceCard
                        key={asset.symbol}
                        asset={asset}
                        isSubscribed={subscriptions.some(
                          (s) => s.asset_symbol === asset.symbol && s.asset_type === "hk_stock",
                        )}
                        onSubscribeToggle={(symbol) => handleSubscribeToggle(symbol, "hk_stock")}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="vietnam" className="mt-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">越南概念股</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  包含 VNM ETF 及中概股，数据延迟 15-30 分钟
                </p>
                {vietnamStockArray.length === 0 ? (
                  <p className="text-muted-foreground">Loading stock data...</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {vietnamStockArray.map((asset) => (
                      <StockPriceCard
                        key={asset.symbol}
                        asset={asset}
                        isSubscribed={subscriptions.some(
                          (s) => s.asset_symbol === asset.symbol && s.asset_type === "vietnam_stock",
                        )}
                        onSubscribeToggle={(symbol) => handleSubscribeToggle(symbol, "vietnam_stock")}
                      />
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
