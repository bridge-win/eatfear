"use client"

import { useMemo, useState } from "react"

import { BlackSwanOpportunityCard } from "@/components/black-swan-opportunity-card"
import { CryptoBuyWindowCard } from "@/components/crypto-buy-window-card"
import { PanicWindowBanner } from "@/components/panic-window-banner"
import { SmartMoneyTracker } from "@/components/smart-money-tracker"
import {
  CryptoHistoryCompare,
  getExpectedCryptoHistorySeriesCount,
  useCryptoHistoryPayload,
} from "@/components/crypto-history-compare"
import { CryptoIndicatorDetail } from "@/components/crypto-indicator-detail"
import { getCryptoIndicatorDescription } from "@/components/crypto-indicator-info"
import { CryptoRealtimeCards } from "@/components/crypto-realtime-cards"
import { CryptoRegimeScoreCard } from "@/components/crypto-regime-score-card"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { CyclePositionCard } from "@/components/cycle-position-card"
import { OpportunityRadar } from "@/components/opportunity-radar"
import { OptionsMaxPainCard } from "@/components/options-max-pain-card"
import { DashboardFrame } from "@/components/page-frame"
import { WatchlistStar } from "@/components/watchlist-star"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeRangeSelector } from "@/components/time-range-selector"
import {
  isDashboardTabValue,
  jsonFetcher,
  usePersistentState,
  usePersistentSWR,
  type DashboardTabValue,
} from "@/lib/client-persistence"
import { useDelayedIdleRender } from "@/lib/client-performance"
import { useT } from "@/lib/i18n"
import { buildTradingOpportunities, type OpportunityInputSeries } from "@/lib/opportunity-engine"
import { isTimeRangeId, type TimeRangeId } from "@/lib/time-range"
import type { CryptoInstrument } from "@/lib/types"

const CRYPTO_DEFAULT_RANGE: TimeRangeId = "1y"

const FALLBACK_INSTRUMENTS: CryptoInstrument[] = [
  { instId: "BTC-USDT-SWAP", base: "BTC", quote: "USDT", label: "BTC-USDT-PERP" },
  { instId: "ETH-USDT-SWAP", base: "ETH", quote: "USDT", label: "ETH-USDT-PERP" },
  { instId: "SOL-USDT-SWAP", base: "SOL", quote: "USDT", label: "SOL-USDT-PERP" },
  { instId: "XRP-USDT-SWAP", base: "XRP", quote: "USDT", label: "XRP-USDT-PERP" },
  { instId: "BNB-USDT-SWAP", base: "BNB", quote: "USDT", label: "BNB-USDT-PERP" },
  { instId: "DOGE-USDT-SWAP", base: "DOGE", quote: "USDT", label: "DOGE-USDT-PERP" },
]

interface CryptoInstrumentsPayload {
  instruments?: CryptoInstrument[]
}

function isInstrumentId(value: string): value is string {
  return /^[A-Z0-9]+-USDT-SWAP$/.test(value)
}

export interface CryptoDashboardProps {
  initialInstruments?: CryptoInstrument[]
}

export function CryptoDashboard({
  initialInstruments,
}: CryptoDashboardProps = {}) {
  const [instId, setInstId] = usePersistentState<string>("crypto:inst-id", "BTC-USDT-SWAP", isInstrumentId)
  const [range, setRange] = usePersistentState("crypto:range", CRYPTO_DEFAULT_RANGE, isTimeRangeId)
  const [tab, setTab] = usePersistentState<DashboardTabValue>("crypto:tab", "history", isDashboardTabValue)
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null)
  const canHydrateDashboard = useDelayedIdleRender(`crypto:${instId}:${range}:hydrate`, 2_000, 1_000)
  const instrumentsPayload = usePersistentSWR<CryptoInstrumentsPayload>(
    "crypto:instruments",
    "/api/crypto/instruments",
    jsonFetcher,
    {
      fallbackData: {
        instruments: initialInstruments && initialInstruments.length > 0 ? initialInstruments : FALLBACK_INSTRUMENTS,
      },
      refreshInterval: 60 * 60 * 1000,
    },
  )
  const instruments =
    instrumentsPayload.data?.instruments && instrumentsPayload.data.instruments.length > 0
      ? instrumentsPayload.data.instruments
      : FALLBACK_INSTRUMENTS
  const cryptoHistory = useCryptoHistoryPayload(instId, range, canHydrateDashboard)
  const t = useT()
  const optionsCurrency = useMemo(() => {
    const base = instId.split("-")[0]
    return base === "BTC" || base === "ETH" ? base : null
  }, [instId])

  const symbolOptions: SymbolOption[] = useMemo(
    () =>
      instruments.map((instrument) => ({
        id: instrument.instId,
        label: instrument.label,
        hint: t("symbol.perpHint", { base: instrument.base, source: "OKX" }),
      })),
    [instruments, t],
  )
  const opportunityInputs = useMemo<OpportunityInputSeries[]>(() => {
    const payload = cryptoHistory.payload
    if (!payload) return []
    return payload.series.map((series) => {
      const finitePoints = series.data.filter(
        (point): point is { time: number; value: number } =>
          point.value !== null && Number.isFinite(point.value),
      )
      const latest = finitePoints[finitePoints.length - 1]
      const first = finitePoints[0]
      const changePercent = latest && first && first.value !== 0
        ? (latest.value / first.value - 1) * 100
        : null
      return {
        key: series.key,
        label: getCryptoSeriesLabel(t, series),
        source: series.source,
        description: getCryptoIndicatorDescription({ payload, series, t }),
        value: latest?.value ?? null,
        changePercent,
        timestamp: latest?.time ?? null,
        data: series.data,
        relevanceScore: series.relevanceScore,
      }
    })
  }, [cryptoHistory.payload, t])
  const opportunities = useMemo(
    () =>
      buildTradingOpportunities({
        assetClass: "crypto",
        marketName: instId.split("-")[0] ?? "BTC",
        series: opportunityInputs,
      }),
    [instId, opportunityInputs],
  )

  return (
    <DashboardFrame>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("crypto.title")}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("crypto.subtitle", { source: "OKX" })}
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-1.5">
          <WatchlistStar symbol={instId.split("-")[0] ?? "BTC"} assetClass="crypto" className="mt-0.5" />
          <SymbolSelector value={instId} options={symbolOptions} onChange={setInstId} />
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </header>

      {canHydrateDashboard && <PanicWindowBanner />}

      {canHydrateDashboard && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <BlackSwanOpportunityCard instId={instId} className="h-full min-w-0" />
          <CryptoRegimeScoreCard instId={instId} className="h-full min-w-0" />
          <CyclePositionCard className="h-full min-w-0" />
          <CryptoBuyWindowCard className="h-full min-w-0" />
        </div>
      )}

      {canHydrateDashboard && optionsCurrency && <OptionsMaxPainCard currency={optionsCurrency} />}

      <OpportunityRadar
        assetClass="crypto"
        title={{ zh: "交易机会雷达", en: "Trading Opportunity Radar" }}
        subtitle={{
          zh: "把趋势、流动性、衍生品拥挤、恐慌反转和宏观确认合成可解释机会卡。",
          en: "Synthesizes trend, liquidity, derivatives crowding, panic reversals, and macro confirmation into explainable setups.",
        }}
        opportunities={opportunities}
        loading={cryptoHistory.loading}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isDashboardTabValue(next)) setTab(next)
        }}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full max-w-xs grid-cols-2">
          <TabsTrigger value="realtime" className="text-xs">{t("crypto.tab.realtime")}</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">{t("crypto.tab.history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="realtime" className="mt-3 space-y-3">
          {canHydrateDashboard && <SmartMoneyTracker ccy={instId.split("-")[0]} range={range} variant="cards" />}
          {selectedSeriesKey && cryptoHistory.payload ? (
            <CryptoIndicatorDetail
              payload={cryptoHistory.payload}
              selectedKey={selectedSeriesKey}
              onBack={() => setSelectedSeriesKey(null)}
            />
          ) : (
            <CryptoRealtimeCards
              payload={cryptoHistory.payload}
              loading={cryptoHistory.loading}
              error={cryptoHistory.error}
              expectedCount={getExpectedCryptoHistorySeriesCount(instId)}
              onSelectSeries={setSelectedSeriesKey}
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <CryptoHistoryCompare
            instId={instId}
            range={range}
            payload={cryptoHistory.payload}
            loading={cryptoHistory.loading}
            error={cryptoHistory.error}
          />
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
