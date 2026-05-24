"use client"

import { useMemo } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistoryGroup,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
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
  const priorityUrl = enabled && initialLimit > 0
    ? `/api/crypto/history-compare?${new URLSearchParams({ ccy, range, limit: String(initialLimit) }).toString()}`
    : null
  const fullUrl = enabled
    ? `/api/crypto/history-compare?${new URLSearchParams({ ccy, range }).toString()}`
    : null
  const priority = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:priority:${initialLimit}`,
    priorityUrl,
    jsonFetcher,
    { revalidateIfStale: true },
  )
  const full = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:full`,
    fullUrl,
    jsonFetcher,
    {
      refreshInterval: (payload) => payload?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS,
    },
  )
  const payload = full.data ?? priority.data ?? null
  const loading = payload
    ? full.isRefreshing || (!full.data && priority.isRefreshing)
    : full.isLoading || priority.isLoading
  const error = payload ? null : full.error?.message ?? priority.error?.message ?? null

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

  const data: AlignedHistoryData | null = useMemo(() => {
    if (!payload) return null
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
  }, [payload, t])

  return (
    <AlignedHistoryCompare
      data={data}
      title={t("compare.title")}
      infoDescription={t("compare.info")}
      infoSource="OKX · blockchain.info · DefiLlama · alternative.me · Deribit · Yahoo Finance · TradingView Lightweight Charts"
      loading={loading}
      error={error}
      loadingLabel={t("compare.loading")}
      noDataLabel={t("chart.noData")}
      seriesCountLabel={t("compare.seriesCount")}
      expectedSeriesCount={expectedSeriesCount}
      className={className}
    />
  )
}
