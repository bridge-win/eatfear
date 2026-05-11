"use client"

import { useEffect, useMemo, useState } from "react"

import { BtcVolatilitySystem } from "@/components/btc-volatility-system"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CryptoPriceCard } from "@/components/crypto-price-card"
import { KpiStrip, type KpiTile } from "@/components/kpi-strip"
import { formatValue as formatSeriesValue } from "@/components/series-chart"
import { SiteHeader } from "@/components/site-header"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { formatPercentDelta, getDeltaTone } from "@/lib/dashboard-shared"
import { fetchCryptoMarketSnapshot, fetchFearGreedIndex, fetchMarketStats } from "@/lib/crypto-service"
import { CrashDetector } from "@/lib/crash-detector"
import { DEFAULT_TIME_RANGE, type TimeRangeId } from "@/lib/time-range"
import type { CrashAlert, CryptoAsset, CryptoInstrument, FearGreedIndex, MarketStats } from "@/lib/types"

const FALLBACK_INSTRUMENTS: CryptoInstrument[] = [
  { instId: "BTC-USDT-SWAP", base: "BTC", quote: "USDT", label: "BTC-USDT-PERP" },
  { instId: "ETH-USDT-SWAP", base: "ETH", quote: "USDT", label: "ETH-USDT-PERP" },
  { instId: "SOL-USDT-SWAP", base: "SOL", quote: "USDT", label: "SOL-USDT-PERP" },
  { instId: "XRP-USDT-SWAP", base: "XRP", quote: "USDT", label: "XRP-USDT-PERP" },
  { instId: "BNB-USDT-SWAP", base: "BNB", quote: "USDT", label: "BNB-USDT-PERP" },
  { instId: "DOGE-USDT-SWAP", base: "DOGE", quote: "USDT", label: "DOGE-USDT-PERP" },
]

const CRYPTO_REFRESH_MS = 15 * 1000
const STATS_REFRESH_MS = 5 * 60 * 1000

const formatUsd = (value: number) => formatSeriesValue(value, "usd", true)

export function CryptoDashboard() {
  const [cryptoAssets, setCryptoAssets] = useState<Map<string, CryptoAsset>>(new Map())
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(null)
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true)
  const [instruments, setInstruments] = useState<CryptoInstrument[]>(FALLBACK_INSTRUMENTS)
  const [instId, setInstId] = useState<string>("BTC-USDT-SWAP")
  const [range, setRange] = useState<TimeRangeId>(DEFAULT_TIME_RANGE)

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
    fetchFearGreedIndex().then(setFearGreed).catch(() => undefined)
    fetchMarketStats().then(setMarketStats).catch(() => undefined)

    const cryptoInterval = setInterval(loadCryptoMarkets, CRYPTO_REFRESH_MS)
    const marketInterval = setInterval(() => {
      fetchFearGreedIndex().then(setFearGreed).catch(() => undefined)
      fetchMarketStats().then(setMarketStats).catch(() => undefined)
    }, STATS_REFRESH_MS)

    return () => {
      clearInterval(cryptoInterval)
      clearInterval(marketInterval)
    }
  }, [])

  useEffect(() => {
    let isActive = true
    fetch("/api/crypto/instruments")
      .then((response) => response.json())
      .then((payload: { instruments?: CryptoInstrument[] }) => {
        if (isActive && payload.instruments && payload.instruments.length > 0) {
          setInstruments(payload.instruments)
        }
      })
      .catch(() => {
        // keep fallback list
      })
    return () => {
      isActive = false
    }
  }, [])

  const symbolOptions: SymbolOption[] = useMemo(
    () =>
      instruments.map((instrument) => ({
        id: instrument.instId,
        label: instrument.label,
        hint: `${instrument.base} 永续合约 · OKX`,
      })),
    [instruments],
  )

  const cryptoArray = Array.from(cryptoAssets.values())

  const kpiTiles: KpiTile[] = useMemo(() => {
    const tiles: KpiTile[] = []

    const spotTileSpecs: Array<{ id: string; key: string; label: string; helper: string; description?: string }> = [
      { id: "btc", key: "BTCUSDT", label: "BTC Spot", helper: "OKX BTC-USDT", description: "Bitcoin 现货报价（OKX）。加密市场总市值的核心锚。" },
      { id: "eth", key: "ETHUSDT", label: "ETH Spot", helper: "OKX ETH-USDT", description: "Ethereum 现货。DeFi/L2 生态主导链。" },
      { id: "sol", key: "SOLUSDT", label: "SOL Spot", helper: "OKX SOL-USDT" },
    ]
    for (const spec of spotTileSpecs) {
      const asset = cryptoAssets.get(spec.key)
      if (!asset) continue
      tiles.push({
        id: spec.id,
        label: spec.label,
        value: formatUsd(asset.price),
        delta: formatPercentDelta(asset.changePercent24h),
        deltaTone: getDeltaTone(asset.changePercent24h),
        helper: spec.helper,
        info: spec.description ? { description: spec.description } : undefined,
      })
    }

    if (marketStats) {
      tiles.push({
        id: "mcap",
        label: "Total Market Cap",
        value: formatUsd(marketStats.totalMarketCap),
        delta: formatPercentDelta(marketStats.marketCapChange24h),
        deltaTone: getDeltaTone(marketStats.marketCapChange24h),
        helper: "CoinGecko 24h",
        info: { description: "全部加密货币 24h 总市值。", source: "CoinGecko" },
      })
      tiles.push({
        id: "btcd",
        label: "BTC Dominance",
        value: `${marketStats.btcDominance.toFixed(2)}%`,
        helper: "BTC 占总市值",
        info: {
          description: "BTC 市值 / 加密总市值。下降 = 山寨季；上升 = 资金回归 BTC。",
          source: "CoinGecko",
        },
      })
      tiles.push({
        id: "vol",
        label: "24h Volume",
        value: formatUsd(marketStats.volume24h),
        helper: "全市场成交额",
      })
    }

    if (fearGreed) {
      tiles.push({
        id: "fgi",
        label: "Fear & Greed",
        value: `${fearGreed.value}`,
        helper: fearGreed.classification,
        deltaTone: fearGreed.value < 30 ? "down" : fearGreed.value > 70 ? "up" : "neutral",
        info: {
          description:
            "Alternative.me 综合波动率、动量、社交、调查等多维度的恐慌贪婪指数（0-100）。\n< 25 极度恐慌；> 75 极度贪婪。",
          source: "Alternative.me",
        },
      })
    }

    return tiles
  }, [cryptoAssets, marketStats, fearGreed])

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-3">
        <div className="space-y-3">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Crypto Dashboard</h1>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                现货 + 永续衍生品（OKX 公开接口）。右上角支持 symbol 检索切换 · 时间周期默认 1M / 1H 线。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <SymbolSelector value={instId} options={symbolOptions} onChange={setInstId} />
              <TimeRangeSelector value={range} onChange={setRange} />
            </div>
          </header>

          <KpiStrip tiles={kpiTiles} />

          <CrashAlertBanner crashes={crashes} />

          <Tabs defaultValue="volatility" className="w-full">
            <TabsList className="grid h-auto w-full max-w-md grid-cols-2">
              <TabsTrigger value="volatility" className="text-xs">极端波动监控</TabsTrigger>
              <TabsTrigger value="markets" className="text-xs">现货行情</TabsTrigger>
            </TabsList>
            <TabsContent value="volatility" className="mt-3">
              <BtcVolatilitySystem instId={instId} range={range} />
            </TabsContent>
            <TabsContent value="markets" className="mt-3">
              <h2 className="mb-2 text-sm font-semibold">Top Cryptocurrencies (OKX Spot)</h2>
              {cryptoArray.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isLoadingMarkets ? "Loading OKX spot market snapshot..." : "No crypto market data available."}
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {cryptoArray.map((asset) => (
                    <CryptoPriceCard key={asset.symbol} asset={asset} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
