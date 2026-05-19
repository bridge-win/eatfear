"use client"

import { useEffect, useMemo, useState } from "react"

import { ApiKeyWarning, type ApiKeyStatus } from "@/components/api-key-warning"
import { BtcVolatilitySystem } from "@/components/btc-volatility-system"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CryptoHistoryCompare } from "@/components/crypto-history-compare"
import { CryptoPriceCard } from "@/components/crypto-price-card"
import { CryptoRegimeScoreCard } from "@/components/crypto-regime-score-card"
import { DataSourceSelector, type DataSourceId, getDataSource } from "@/components/data-source-selector"
import { FearGreedScoreCard } from "@/components/fear-greed-score-card"
import { KpiStrip, type KpiTile } from "@/components/kpi-strip"
import { MiningCostCard } from "@/components/mining-cost-card"
import { DashboardFrame } from "@/components/page-frame"
import { SmartMoneyTracker } from "@/components/smart-money-tracker"
import { formatValue as formatSeriesValue } from "@/components/series-chart"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { formatPercentDelta, getDeltaTone } from "@/lib/dashboard-shared"
import { fetchCryptoMarketSnapshot, fetchFearGreedIndex, fetchMarketStats } from "@/lib/crypto-service"
import { CrashDetector } from "@/lib/crash-detector"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import type { CrashAlert, CryptoAsset, CryptoInstrument, FearGreedIndex, MarketStats } from "@/lib/types"

const CRYPTO_DEFAULT_RANGE: TimeRangeId = "1y"

/* Mount Smart Money / Mining-Cost cards beneath the volatility tab so they share the global range. */

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

const CRYPTO_MARKET_PRIORITY = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "DOGEUSDT",
  "LINKUSDT",
  "AVAXUSDT",
  "SUIUSDT",
] as const

const formatUsd = (value: number) => formatSeriesValue(value, "usd", true)

const getCryptoDisplayPriority = (symbol: string) => {
  const index = CRYPTO_MARKET_PRIORITY.findIndex((prioritySymbol) => prioritySymbol === symbol)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

const compareCryptoAssets = (a: CryptoAsset, b: CryptoAsset) => {
  const priorityDelta = getCryptoDisplayPriority(a.symbol) - getCryptoDisplayPriority(b.symbol)
  if (priorityDelta !== 0) return priorityDelta
  return (b.volume24h ?? 0) - (a.volume24h ?? 0)
}

export interface CryptoDashboardProps {
  initialFearGreed?: FearGreedIndex | null
  initialMarketStats?: MarketStats | null
  initialInstruments?: CryptoInstrument[]
}

export function CryptoDashboard({
  initialFearGreed = null,
  initialMarketStats = null,
  initialInstruments,
}: CryptoDashboardProps = {}) {
  const [cryptoAssets, setCryptoAssets] = useState<Map<string, CryptoAsset>>(new Map())
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(initialFearGreed)
  const [marketStats, setMarketStats] = useState<MarketStats | null>(initialMarketStats)
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true)
  const [instruments, setInstruments] = useState<CryptoInstrument[]>(
    initialInstruments && initialInstruments.length > 0 ? initialInstruments : FALLBACK_INSTRUMENTS,
  )
  const [instId, setInstId] = useState<string>("BTC-USDT-SWAP")
  const [range, setRange] = useState<TimeRangeId>(CRYPTO_DEFAULT_RANGE)
  const [dataSource, setDataSource] = useState<DataSourceId>("okx")
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const t = useT()

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

  const currentSource = getDataSource(dataSource)

  const symbolOptions: SymbolOption[] = useMemo(
    () =>
      instruments.map((instrument) => ({
        id: instrument.instId,
        label: instrument.label,
        hint: t("symbol.perpHint", { base: instrument.base, source: currentSource.name }),
      })),
    [instruments, currentSource.name, t],
  )

  const cryptoArray = useMemo(
    () => Array.from(cryptoAssets.values()).sort(compareCryptoAssets),
    [cryptoAssets],
  )

  const kpiTiles: KpiTile[] = useMemo(() => {
    const tiles: KpiTile[] = []
    const btcAsset = cryptoAssets.get("BTCUSDT")
    const ethAsset = cryptoAssets.get("ETHUSDT")

    const spotTileSpecs: Array<{ id: string; key: string; label: string; helper: string; description?: string }> = [
      { id: "btc", key: "BTCUSDT", label: t("kpi.btc"), helper: "OKX BTC-USDT", description: t("kpi.btc.info") },
      { id: "eth", key: "ETHUSDT", label: t("kpi.eth"), helper: "OKX ETH-USDT", description: t("kpi.eth.info") },
      {
        id: "sol",
        key: "SOLUSDT",
        label: t("kpi.sol"),
        helper: "OKX SOL-USDT",
        description: t("kpi.sol.info"),
      },
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

    if (btcAsset && ethAsset && btcAsset.price > 0) {
      const ethBtc = ethAsset.price / btcAsset.price
      const relativeStrength = ethAsset.changePercent24h - btcAsset.changePercent24h
      tiles.push({
        id: "eth-btc",
        label: t("kpi.ethBtc"),
        value: ethBtc.toFixed(4),
        delta: formatPercentDelta(relativeStrength),
        deltaTone: getDeltaTone(relativeStrength),
        helper: t("kpi.ethBtc.helper"),
        info: { description: t("kpi.ethBtc.info"), source: "OKX Spot" },
      })
    }

    if (marketStats) {
      tiles.push({
        id: "vol",
        label: t("kpi.vol"),
        value: formatUsd(marketStats.volume24h),
        helper: t("kpi.vol.helper"),
        info: {
          description: t("kpi.vol.info"),
          source: "CoinGecko",
        },
      })
      tiles.push({
        id: "btcd",
        label: t("kpi.btcd"),
        value: `${marketStats.btcDominance.toFixed(2)}%`,
        helper: t("kpi.btcd.helper"),
        info: {
          description: t("kpi.btcd.info"),
          source: "CoinGecko",
        },
      })
      tiles.push({
        id: "mcap",
        label: t("kpi.mcap"),
        value: formatUsd(marketStats.totalMarketCap),
        delta: formatPercentDelta(marketStats.marketCapChange24h),
        deltaTone: getDeltaTone(marketStats.marketCapChange24h),
        helper: "CoinGecko 24h",
        info: { description: t("kpi.mcap.info"), source: "CoinGecko" },
      })
    }

    if (fearGreed) {
      tiles.push({
        id: "fgi",
        label: t("kpi.fgi"),
        value: `${fearGreed.value}`,
        helper: fearGreed.classification,
        deltaTone: fearGreed.value < 30 ? "down" : fearGreed.value > 70 ? "up" : "neutral",
        info: {
          description: t("kpi.fgi.info"),
          source: "Alternative.me",
        },
      })
    }

    return tiles
  }, [cryptoAssets, marketStats, fearGreed, t])

  return (
    <DashboardFrame>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("crypto.title")}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("crypto.subtitle", { source: currentSource.name })}
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-1.5">
          <DataSourceSelector value={dataSource} onChange={setDataSource} />
          <SymbolSelector value={instId} options={symbolOptions} onChange={setInstId} />
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </header>

      {apiKeyStatus && (apiKeyStatus.missing || apiKeyStatus.invalid || apiKeyStatus.rateLimited) && (
        <ApiKeyWarning
          source={currentSource.name}
          status={apiKeyStatus}
          onDismiss={() => setApiKeyStatus(null)}
        />
      )}

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid h-auto w-full max-w-xs grid-cols-2">
          <TabsTrigger value="realtime" className="text-xs">{t("crypto.tab.realtime")}</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">{t("crypto.tab.history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="realtime" className="mt-3 space-y-3">
          <CrashAlertBanner crashes={crashes} />
          <KpiStrip tiles={kpiTiles} />
          <div className="flex flex-wrap gap-2">
            <FearGreedScoreCard index={fearGreed} />
            <CryptoRegimeScoreCard />
          </div>
          <BtcVolatilitySystem
            instId={instId}
            range={range}
            dataSource={dataSource}
            onApiKeyStatusChange={setApiKeyStatus}
          />
          <SmartMoneyTracker ccy={instId.split("-")[0] ?? "BTC"} range={range} />
          <MiningCostCard range={range} />
          <div>
            <h2 className="mb-2 text-sm font-semibold">{t("crypto.markets.heading")}</h2>
            {cryptoArray.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {isLoadingMarkets ? t("crypto.markets.loading") : t("crypto.markets.empty")}
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {cryptoArray.map((asset) => (
                  <CryptoPriceCard key={asset.symbol} asset={asset} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <CryptoHistoryCompare instId={instId} range={range} />
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
