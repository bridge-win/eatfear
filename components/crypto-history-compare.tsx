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
import { type TimeRangeId } from "@/lib/time-range"

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
  color: string
  source: string
  unit: AlignedHistoryUnit
  relevanceScore?: number
  data: { time: number; value: number | null }[]
}

export interface CryptoHistoryPayload {
  range: string
  ccy: string
  timeline: number[]
  series: CryptoHistorySeries[]
  refreshMs: number
  paneCount: number
  updatedAt: number
}

function buildCryptoHistoryUrl(ccy: string, range: TimeRangeId, params: { limit?: number; offset?: number } = {}): string {
  const searchParams = new URLSearchParams({ ccy, range })
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
    series,
    refreshMs,
    paneCount: series.length === 0 ? 0 : Math.max(...series.map((item) => item.paneIndex)) + 1,
    updatedAt: Math.max(priority?.updatedAt ?? 0, rest?.updatedAt ?? 0, base.updatedAt),
  }
}

export interface CryptoHistoryCompareProps {
  instId?: string
  range: TimeRangeId
  payload?: CryptoHistoryPayload | null
  loading?: boolean
  error?: string | null
  className?: string
}

export function useCryptoHistoryPayload(
  instId = "BTC-USDT-SWAP",
  range: TimeRangeId,
  enabled = true,
  initialLimit = CRYPTO_INITIAL_HISTORY_LIMIT,
): {
  payload: CryptoHistoryPayload | null
  loading: boolean
  error: string | null
} {
  const ccy = instId.split("-")[0] ?? "BTC"
  const fullStorageKey = `crypto-history:${ccy}:${range}:full`
  const priorityUrl = enabled && initialLimit > 0 ? buildCryptoHistoryUrl(ccy, range, { limit: initialLimit }) : null
  const restUrl = enabled ? buildCryptoHistoryUrl(ccy, range, { offset: initialLimit }) : null
  const priority = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:priority:${initialLimit}`,
    priorityUrl,
    jsonFetcher,
    { revalidateIfStale: true },
  )
  const rest = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:rest:${initialLimit}`,
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
  payload: controlledPayload,
  loading: controlledLoading,
  error: controlledError,
  className,
}: CryptoHistoryCompareProps) {
  const t = useT()
  const fetched = useCryptoHistoryPayload(instId, range, controlledPayload === undefined)
  const payload = controlledPayload === undefined ? fetched.payload : controlledPayload
  const loading = controlledLoading ?? fetched.loading
  const error = controlledError ?? fetched.error
  const expectedSeriesCount = getExpectedCryptoHistorySeriesCount(instId)
  const canRenderCharts = useDelayedIdleRender(`${instId}:${range}:${payload ? "ready" : "empty"}`, 2_500, 1_000)

  const data: AlignedHistoryData | null = useMemo(() => {
    if (!canRenderCharts || !payload) return null
    const groupsByPane = new Map<number, AlignedHistorySeries[]>()
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
      const group = groupsByPane.get(spec.paneIndex)
      if (group) {
        group.push(series)
      } else {
        groupsByPane.set(spec.paneIndex, [series])
      }
    }

    const groups: AlignedHistoryGroup[] = Array.from(groupsByPane.entries())
      .sort(([a], [b]) => a - b)
      .map(([paneIndex, series]) => ({
        key: `pane-${paneIndex}`,
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
      className={className}
    />
  )
}
