"use client"

import { useEffect, useMemo } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistoryGroup,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { jsonFetcher, usePersistentSWR, writeStoredJson } from "@/lib/client-persistence"
import { useDelayedIdleRender } from "@/lib/client-performance"
import { DEFAULT_CRYPTO_HISTORY_REFRESH_MS, getEnabledCryptoIndicators } from "@/lib/crypto-indicator-config"
import { useT } from "@/lib/i18n"
import { type CryptoHistoryInterval, type TimeRangeId } from "@/lib/time-range"

const CRYPTO_INITIAL_HISTORY_LIMIT = 12

const CROSS_SECTION_PRICE_KEY_BY_CCY: Readonly<Record<string, string>> = {
  ETH: "ethPrice",
  SOL: "solPrice",
  XRP: "xrpPrice",
  BNB: "bnbPrice",
  DOGE: "dogePrice",
}

export interface CryptoHistorySeries {
  key: string
  i18nKey: string
  infoI18nKey: string
  labelVars?: Record<string, string | number>
  order: number
  paneIndex: number
  group?: string
  tier?: "core" | "secondary"
  color: string
  source: string
  unit: AlignedHistoryUnit
  relevanceScore?: number
  nativeInterval?: string
  coverage?: "complete" | "partial"
  freshness?: "live" | "collected" | "historical"
  data: { time: number; value: number | null }[]
}

export interface CryptoHistorySelection {
  interval: CryptoHistoryInterval
  startMs?: number | null
  endMs?: number | null
}

export interface CryptoHistoryCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
}

export interface CryptoQuantSignals {
  crowdingScore: number | null
  extensionScore: number | null
  trendScore: number | null
  cascadeScore: number | null
  cascadeInProgress: boolean
  exhaustionScore: number | null
}

export interface CryptoHistoryPayload {
  range: string
  ccy: string
  selection?: {
    range: string
    custom: boolean
    interval: CryptoHistoryInterval
    okxBar: string
    start: number
    end: number
    maxPoints: number
  }
  candles?: CryptoHistoryCandle[]
  signals?: CryptoQuantSignals
  timeline: number[]
  series: CryptoHistorySeries[]
  refreshMs: number
  paneCount: number
  updatedAt: number
}

function buildCryptoHistoryUrl(
  ccy: string,
  range: TimeRangeId,
  selection: CryptoHistorySelection,
  params: { limit?: number; offset?: number } = {},
): string {
  const searchParams = new URLSearchParams({ ccy, range, interval: selection.interval })
  if (selection.startMs && selection.endMs && selection.endMs > selection.startMs) {
    searchParams.set("start", String(selection.startMs))
    searchParams.set("end", String(selection.endMs))
  }
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit))
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset))
  return `/api/crypto/history-compare?${searchParams.toString()}`
}

function mergeCryptoHistoryPayloads(
  priority: CryptoHistoryPayload | undefined,
  rest: CryptoHistoryPayload | undefined,
): CryptoHistoryPayload | null {
  if (!priority && !rest) return null
  const base = priority ?? rest
  if (!base) return null

  const seriesByKey = new Map<string, CryptoHistorySeries>()
  for (const payload of [priority, rest]) {
    for (const series of payload?.series ?? []) {
      seriesByKey.set(series.key, series)
    }
  }

  const series = Array.from(seriesByKey.values())
    .sort((a, b) => a.order - b.order)
    .map((seriesItem, index) => ({
      ...seriesItem,
      order: index + 1,
      paneIndex: Math.floor(index / 2),
    }))
  const timeline =
    (priority?.timeline.length ?? 0) >= (rest?.timeline.length ?? 0)
      ? priority?.timeline ?? base.timeline
      : rest?.timeline ?? base.timeline
  const refreshMs = Math.max(
    30_000,
    Math.min(priority?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS, rest?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS),
  )

  return {
    ...base,
    timeline,
    selection: priority?.selection ?? rest?.selection ?? base.selection,
    candles: priority?.candles && priority.candles.length > 0 ? priority.candles : rest?.candles ?? base.candles,
    signals: priority?.signals ?? rest?.signals ?? base.signals,
    series,
    refreshMs,
    paneCount: series.length === 0 ? 0 : Math.max(...series.map((item) => item.paneIndex)) + 1,
    updatedAt: Math.max(priority?.updatedAt ?? 0, rest?.updatedAt ?? 0, base.updatedAt),
  }
}

export interface CryptoHistoryCompareProps {
  instId?: string
  range: TimeRangeId
  selection: CryptoHistorySelection
  payload?: CryptoHistoryPayload | null
  loading?: boolean
  error?: string | null
  className?: string
}

export function useCryptoHistoryPayload(
  instId = "BTC-USDT-SWAP",
  range: TimeRangeId,
  selection: CryptoHistorySelection,
  enabled = true,
  initialLimit = CRYPTO_INITIAL_HISTORY_LIMIT,
): {
  payload: CryptoHistoryPayload | null
  loading: boolean
  error: string | null
} {
  const ccy = instId.split("-")[0] ?? "BTC"
  const selectionKey = `${selection.interval}:${selection.startMs ?? "preset"}:${selection.endMs ?? "now"}`
  const fullStorageKey = `crypto-history:${ccy}:${range}:${selectionKey}:full`
  const priorityUrl = enabled && initialLimit > 0 ? buildCryptoHistoryUrl(ccy, range, selection, { limit: initialLimit }) : null
  const restUrl = enabled ? buildCryptoHistoryUrl(ccy, range, selection, { offset: initialLimit }) : null
  const priority = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:${selectionKey}:priority:${initialLimit}`,
    priorityUrl,
    jsonFetcher,
    { revalidateIfStale: true },
  )
  const rest = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:${selectionKey}:rest:${initialLimit}`,
    restUrl,
    jsonFetcher,
    {
      refreshInterval: (payload) => payload?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS,
    },
  )
  const fullCache = usePersistentSWR<CryptoHistoryPayload>(fullStorageKey, null, jsonFetcher)
  const mergedPayload = useMemo(() => mergeCryptoHistoryPayloads(priority.data, rest.data), [priority.data, rest.data])
  const hasCompleteNetworkPayload = priority.data !== undefined && rest.data !== undefined
  const networkPayload = hasCompleteNetworkPayload ? mergedPayload : null
  const payload = networkPayload ?? fullCache.data ?? priority.data ?? null

  useEffect(() => {
    if (mergedPayload && hasCompleteNetworkPayload) writeStoredJson(fullStorageKey, mergedPayload)
  }, [fullStorageKey, hasCompleteNetworkPayload, mergedPayload])

  const loading = payload
    ? priority.isValidating || rest.isValidating || (!mergedPayload && !fullCache.data && rest.isLoading)
    : fullCache.isLoading || priority.isLoading || rest.isLoading
  const error = payload ? null : priority.error?.message ?? rest.error?.message ?? fullCache.error?.message ?? null

  return { payload, loading, error }
}

export function getExpectedCryptoHistorySeriesCount(instId: string): number {
  const ccy = (instId.split("-")[0] ?? "BTC").toUpperCase()
  const omittedKey = CROSS_SECTION_PRICE_KEY_BY_CCY[ccy]
  return getEnabledCryptoIndicators().filter((indicator) => indicator.key !== omittedKey).length
}

export function CryptoHistoryCompare({
  instId = "BTC-USDT-SWAP",
  range,
  selection,
  payload: controlledPayload,
  loading: controlledLoading,
  error: controlledError,
  className,
}: CryptoHistoryCompareProps) {
  const t = useT()
  const fetched = useCryptoHistoryPayload(instId, range, selection, controlledPayload === undefined)
  const payload = controlledPayload === undefined ? fetched.payload : controlledPayload
  const loading = controlledLoading ?? fetched.loading
  const error = controlledError ?? fetched.error
  const expectedSeriesCount = getExpectedCryptoHistorySeriesCount(instId)
  const canRenderCharts = useDelayedIdleRender(`${instId}:${range}:${payload ? "ready" : "empty"}`, 2_500, 1_000)

  const data: AlignedHistoryData | null = useMemo(() => {
    if (!canRenderCharts || !payload) return null
    const groupsByName = new Map<string, AlignedHistorySeries[]>()
    for (const spec of payload.series) {
      const label = getCryptoSeriesLabel(t, spec)
      const series: AlignedHistorySeries = {
        key: spec.key,
        order: spec.order,
        label,
        color: spec.color,
        unit: spec.unit,
        data: spec.data,
        info: {
          title: `#${String(spec.order).padStart(2, "0")} ${label}`,
          description: t(spec.infoI18nKey, spec.labelVars),
          source: spec.source,
        },
      }
      const groupKey = spec.group ?? `pane-${spec.paneIndex}`
      const group = groupsByName.get(groupKey)
      if (group) {
        group.push(series)
      } else {
        groupsByName.set(groupKey, [series])
      }
    }

    const groups: AlignedHistoryGroup[] = Array.from(groupsByName.entries())
      .map(([groupKey, series]) => ({
        key: groupKey,
        label: t(`compare.group.${groupKey}`),
        series,
      }))

    return {
      timeline: payload.timeline,
      groups,
    }
  }, [canRenderCharts, payload, t])

  return (
    <AlignedHistoryCompare
      data={data}
      title={t("compare.title")}
      infoDescription={t("compare.info")}
      infoSource="OKX · OKX computed manipulation observables · blockchain.info · DefiLlama · alternative.me · Deribit · Yahoo Finance · TradingView Lightweight Charts"
      loading={loading || !canRenderCharts}
      error={error}
      loadingLabel={t("compare.loading")}
      noDataLabel={t("chart.noData")}
      seriesCountLabel={t("compare.seriesCount")}
      expectedSeriesCount={expectedSeriesCount}
      maxSeriesPerPane={6}
      className={className}
    />
  )
}
