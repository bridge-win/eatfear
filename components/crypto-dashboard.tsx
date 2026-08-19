"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { BlackSwanOpportunityCard } from "@/components/black-swan-opportunity-card"
import { CryptoBuyWindowCard } from "@/components/crypto-buy-window-card"
import { PanicWindowBanner } from "@/components/panic-window-banner"
import { SmartMoneyTracker } from "@/components/smart-money-tracker"
import {
  CryptoHistoryCompare,
  type CryptoQuantSignals,
  getExpectedCryptoHistorySeriesCount,
  useCryptoHistoryPayload,
} from "@/components/crypto-history-compare"
import { CryptoIndicatorDetail } from "@/components/crypto-indicator-detail"
import { getCryptoIndicatorDescription } from "@/components/crypto-indicator-info"
import { CryptoRealtimeCards } from "@/components/crypto-realtime-cards"
import { CryptoRegimeScoreCard } from "@/components/crypto-regime-score-card"
import { EuphoriaOpportunityCard } from "@/components/euphoria-opportunity-card"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { CyclePositionCard } from "@/components/cycle-position-card"
import { MarketManipulationMonitor } from "@/components/market-manipulation-monitor"
import { OpportunityRadar } from "@/components/opportunity-radar"
import { OptionsMaxPainCard } from "@/components/options-max-pain-card"
import { DashboardFrame } from "@/components/page-frame"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CryptoIntervalSelect,
  CustomTimeWindowPicker,
  TimeRangeSelect,
  type TimeRangeSelectValue,
} from "@/components/time-range-selector"
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
import {
  getDefaultCryptoIntervalForRange,
  getRangeStartMs,
  isCryptoHistoryInterval,
  isTimeRangeId,
  type CryptoHistoryInterval,
  type TimeRangeId,
} from "@/lib/time-range"
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

const QUANT_SIGNAL_KEYS: Array<{
  key: keyof Omit<CryptoQuantSignals, "cascadeInProgress">
  labelKey: string
}> = [
  { key: "crowdingScore", labelKey: "compare.s.crowdingScore" },
  { key: "extensionScore", labelKey: "compare.s.extensionScore" },
  { key: "trendScore", labelKey: "compare.s.trendScore" },
  { key: "cascadeScore", labelKey: "compare.s.cascadeScore" },
  { key: "exhaustionScore", labelKey: "compare.s.exhaustionScore" },
]

interface CryptoInstrumentsPayload {
  instruments?: CryptoInstrument[]
}

function isInstrumentId(value: string): value is string {
  return /^[A-Z0-9]+-USDT-SWAP$/.test(value)
}

function isDatetimeLocalValue(value: string): value is string {
  return value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
}

/* Must be module-level: usePersistentState re-runs its restore effect whenever
   the validator identity changes, and an inline validator makes the restore
   and write effects fight each other, flip-flopping state on every render. */
function isBooleanFlag(value: string): value is "true" | "false" {
  return value === "true" || value === "false"
}

function toDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(timestamp - offsetMs).toISOString().slice(0, 16)
}

function toTimestamp(value: string): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatSignalScore(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(0) : "—"
}

function QuantSignalRail({ ccy, signals }: { ccy: string; signals?: CryptoQuantSignals }) {
  const t = useT()
  return (
    <section className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
      {QUANT_SIGNAL_KEYS.map((item) => {
        const value = signals?.[item.key] ?? null
        const danger = item.key === "cascadeScore" && signals?.cascadeInProgress
        return (
          <div
            key={item.key}
            className="min-w-0 rounded-md border bg-background/70 px-2.5 py-2"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                {t(item.labelKey, { ccy })}
              </span>
              {danger && (
                <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
                  Active
                </span>
              )}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums tracking-normal">
              {formatSignalScore(value)}
            </div>
          </div>
        )
      })}
    </section>
  )
}

export interface CryptoDashboardProps {
  initialInstruments?: CryptoInstrument[]
}

export function CryptoDashboard({
  initialInstruments,
}: CryptoDashboardProps = {}) {
  const [instId, setInstId] = usePersistentState<string>("crypto:inst-id", "BTC-USDT-SWAP", isInstrumentId)
  const [range, setRange] = usePersistentState("crypto:range", CRYPTO_DEFAULT_RANGE, isTimeRangeId)
  const [interval, setInterval] = usePersistentState<CryptoHistoryInterval>(
    "crypto:history-interval",
    getDefaultCryptoIntervalForRange(CRYPTO_DEFAULT_RANGE),
    isCryptoHistoryInterval,
  )
  const [customActiveValue, setCustomActiveValue] = usePersistentState<"true" | "false">(
    "crypto:custom-window-active",
    "false",
    isBooleanFlag,
  )
  const customActive = customActiveValue === "true"
  const [customStart, setCustomStart] = usePersistentState<string>(
    "crypto:custom-window-start",
    toDatetimeLocalValue(getRangeStartMs(CRYPTO_DEFAULT_RANGE)),
    isDatetimeLocalValue,
  )
  const [customEnd, setCustomEnd] = usePersistentState<string>(
    "crypto:custom-window-end",
    toDatetimeLocalValue(Date.now()),
    isDatetimeLocalValue,
  )
  const [tab, setTab] = usePersistentState<DashboardTabValue>("crypto:tab", "history", isDashboardTabValue)
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null)
  /* Draft values keep native datetime inputs responsive while applied values
     change only after the user pauses editing. */
  const [draftStart, setDraftStart] = useState(customStart)
  const [draftEnd, setDraftEnd] = useState(customEnd)
  const customWindowEditPending = useRef(false)
  useEffect(() => {
    setDraftStart(customStart)
  }, [customStart])
  useEffect(() => {
    setDraftEnd(customEnd)
  }, [customEnd])
  useEffect(() => {
    if (customActive) return
    /* Persistent state restores after mount. Defer preset synchronization by
       one task so a restored custom window can cancel this update instead of
       being overwritten by the default preset. */
    const handle = globalThis.setTimeout(() => {
      const endMs = Date.now()
      const nextStart = toDatetimeLocalValue(getRangeStartMs(range, endMs))
      const nextEnd = toDatetimeLocalValue(endMs)
      setCustomStart(nextStart)
      setCustomEnd(nextEnd)
      setDraftStart(nextStart)
      setDraftEnd(nextEnd)
    }, 0)
    return () => globalThis.clearTimeout(handle)
  }, [customActive, range, setCustomEnd, setCustomStart])
  useEffect(() => {
    if (!customWindowEditPending.current) return
    const handle = globalThis.setTimeout(() => {
      if (!customWindowEditPending.current) return
      const nextStartMs = toTimestamp(draftStart)
      const nextEndMs = toTimestamp(draftEnd)
      if (nextStartMs === null || nextEndMs === null || nextEndMs <= nextStartMs) return
      customWindowEditPending.current = false
      setCustomStart(draftStart)
      setCustomEnd(draftEnd)
      setCustomActiveValue("true")
    }, 500)
    return () => globalThis.clearTimeout(handle)
  }, [draftEnd, draftStart, setCustomActiveValue, setCustomEnd, setCustomStart])
  const customStartMs = customActive ? toTimestamp(customStart) : null
  const customEndMs = customActive ? toTimestamp(customEnd) : null
  const validCustomWindow =
    customActive &&
    customStartMs !== null &&
    customEndMs !== null &&
    customEndMs > customStartMs
  const historySelection = useMemo(
    () => ({
      interval,
      startMs: validCustomWindow ? customStartMs : null,
      endMs: validCustomWindow ? customEndMs : null,
    }),
    [customEndMs, customStartMs, interval, validCustomWindow],
  )
  /* Hydration staggers heavy sections on first load and instrument/range
     switches only. Interval or custom-window edits must not de-hydrate the
     dashboard: unmounting sections above the pickers makes the page jump and
     steals focus from the datetime inputs. */
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
  const cryptoHistory = useCryptoHistoryPayload(instId, range, historySelection, canHydrateDashboard)
  const t = useT()

  const handleRangeChange = (next: TimeRangeSelectValue) => {
    if (next === "custom") {
      setCustomActiveValue("true")
      return
    }
    const nowMs = Date.now()
    const nextStart = toDatetimeLocalValue(getRangeStartMs(next, nowMs))
    const nextEnd = toDatetimeLocalValue(nowMs)
    customWindowEditPending.current = false
    setCustomActiveValue("false")
    setRange(next)
    setInterval(getDefaultCryptoIntervalForRange(next))
    /* Two-way binding: a preset selection drives the custom pickers to the
       window it implies, so start/end always show the active window. */
    setCustomStart(nextStart)
    setCustomEnd(nextEnd)
    setDraftStart(nextStart)
    setDraftEnd(nextEnd)
  }

  const handleCustomStartChange = (next: string) => {
    customWindowEditPending.current = true
    setDraftStart(next)
  }

  const handleCustomEndChange = (next: string) => {
    customWindowEditPending.current = true
    setDraftEnd(next)
  }
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
      <header className="flex flex-wrap items-start justify-between gap-2 xl:flex-nowrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("crypto.title")}</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("crypto.subtitle", { source: "OKX" })}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
          <SymbolSelector value={instId} options={symbolOptions} onChange={setInstId} />
          <TimeRangeSelect
            label={t("timeRange.rangeLabel")}
            customLabel={t("timeRange.customOption")}
            value={customActive ? "custom" : range}
            onChange={handleRangeChange}
          />
          <CryptoIntervalSelect label={t("timeRange.intervalLabel")} value={interval} onChange={setInterval} />
          <CustomTimeWindowPicker
            startLabel={t("timeRange.startLabel")}
            endLabel={t("timeRange.endLabel")}
            startValue={draftStart}
            endValue={draftEnd}
            onStartChange={handleCustomStartChange}
            onEndChange={handleCustomEndChange}
            className="xl:flex-nowrap"
          />
        </div>
      </header>

      {canHydrateDashboard && <PanicWindowBanner />}

      {canHydrateDashboard && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <BlackSwanOpportunityCard instId={instId} className="h-full min-w-0" />
          <EuphoriaOpportunityCard instId={instId} className="h-full min-w-0" />
          <CryptoRegimeScoreCard instId={instId} className="h-full min-w-0" />
          <CyclePositionCard className="h-full min-w-0" />
          <CryptoBuyWindowCard className="h-full min-w-0" />
        </div>
      )}

      {canHydrateDashboard && optionsCurrency && <OptionsMaxPainCard currency={optionsCurrency} />}

      {canHydrateDashboard && (
        <MarketManipulationMonitor currency={instId.split("-")[0] ?? "BTC"} />
      )}

      <QuantSignalRail ccy={instId.split("-")[0] ?? "BTC"} signals={cryptoHistory.payload?.signals} />

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
            selection={historySelection}
            payload={cryptoHistory.payload}
            loading={cryptoHistory.loading}
            error={cryptoHistory.error}
          />
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
