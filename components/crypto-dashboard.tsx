"use client"

import { useMemo, useState } from "react"

import { BlackSwanOpportunityCard } from "@/components/black-swan-opportunity-card"
import {
  CryptoHistoryCompare,
  getExpectedCryptoHistorySeriesCount,
  useCryptoHistoryPayload,
} from "@/components/crypto-history-compare"
import { CryptoIndicatorDetail } from "@/components/crypto-indicator-detail"
import { CryptoRealtimeCards } from "@/components/crypto-realtime-cards"
import { CryptoRegimeScoreCard } from "@/components/crypto-regime-score-card"
import { CyclePositionCard } from "@/components/cycle-position-card"
import { DashboardFrame } from "@/components/page-frame"
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
import { useT } from "@/lib/i18n"
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
  const cryptoHistory = useCryptoHistoryPayload(instId, range)
  const t = useT()

  const symbolOptions: SymbolOption[] = useMemo(
    () =>
      instruments.map((instrument) => ({
        id: instrument.instId,
        label: instrument.label,
        hint: t("symbol.perpHint", { base: instrument.base, source: "OKX" }),
      })),
    [instruments, t],
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
          <SymbolSelector value={instId} options={symbolOptions} onChange={setInstId} />
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </header>

      <div className="flex flex-wrap items-stretch gap-2">
        <BlackSwanOpportunityCard instId={instId} className="flex-1 min-w-[12rem]" />
        <CryptoRegimeScoreCard instId={instId} className="flex-1 min-w-[12rem]" />
        <CyclePositionCard className="flex-1 min-w-[12rem]" />
      </div>

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
        <TabsContent value="realtime" className="mt-3">
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
