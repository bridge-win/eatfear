"use client"

import { useEffect, useMemo, useState } from "react"

import { ApiKeyWarning, type ApiKeyStatus } from "@/components/api-key-warning"
import { BtcVolatilitySystem } from "@/components/btc-volatility-system"
import { CrashAlertBanner } from "@/components/crash-alert-banner"
import { CryptoHistoryCompare } from "@/components/crypto-history-compare"
import { DataSourceSelector, type DataSourceId, getDataSource } from "@/components/data-source-selector"
import { FearGreedScoreCard } from "@/components/fear-greed-score-card"
import { MiningCostCard } from "@/components/mining-cost-card"
import { DashboardFrame } from "@/components/page-frame"
import { SmartMoneyTracker } from "@/components/smart-money-tracker"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { fetchCryptoMarketSnapshot, fetchFearGreedIndex } from "@/lib/crypto-service"
import { CrashDetector } from "@/lib/crash-detector"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import type { CrashAlert, CryptoInstrument, FearGreedIndex } from "@/lib/types"

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
export interface CryptoDashboardProps {
  initialFearGreed?: FearGreedIndex | null
  initialInstruments?: CryptoInstrument[]
}

export function CryptoDashboard({
  initialFearGreed = null,
  initialInstruments,
}: CryptoDashboardProps = {}) {
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(initialFearGreed)
  const [crashes, setCrashes] = useState<CrashAlert[]>([])
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
    }

    loadCryptoMarkets()
    fetchFearGreedIndex().then(setFearGreed).catch(() => undefined)

    const cryptoInterval = setInterval(loadCryptoMarkets, CRYPTO_REFRESH_MS)

    return () => {
      clearInterval(cryptoInterval)
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
          <div className="flex flex-wrap gap-2">
            <FearGreedScoreCard index={fearGreed} />
          </div>
          <BtcVolatilitySystem
            instId={instId}
            range={range}
            dataSource={dataSource}
            onApiKeyStatusChange={setApiKeyStatus}
          />
          <SmartMoneyTracker ccy={instId.split("-")[0] ?? "BTC"} range={range} variant="cards" />
          <MiningCostCard range={range} variant="cards" />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <CryptoHistoryCompare instId={instId} range={range} />
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
