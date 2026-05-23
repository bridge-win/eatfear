"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistoryGroup,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import { DEFAULT_CRYPTO_HISTORY_REFRESH_MS } from "@/lib/crypto-indicator-config"

const CRYPTO_INITIAL_HISTORY_LIMIT = 12

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
  const [payload, setPayload] = useState<CryptoHistoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const payloadRef = useRef<CryptoHistoryPayload | null>(null)
  const refreshMsRef = useRef(DEFAULT_CRYPTO_HISTORY_REFRESH_MS)
  const ccy = instId.split("-")[0] ?? "BTC"

  useEffect(() => {
    if (!enabled) {
      payloadRef.current = null
      setPayload(null)
      setLoading(false)
      setError(null)
      return
    }
    let active = true
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null
    payloadRef.current = null
    setPayload(null)
    setLoading(true)
    setError(null)

    async function fetchPayload(limit?: number): Promise<CryptoHistoryPayload> {
      const params = new URLSearchParams({ ccy, range })
      if (limit !== undefined) params.set("limit", String(limit))
      const response = await fetch(`/api/crypto/history-compare?${params.toString()}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`history-compare ${response.status}`)
      return (await response.json()) as CryptoHistoryPayload
    }

    function applyPayload(json: CryptoHistoryPayload) {
      refreshMsRef.current = json.refreshMs || DEFAULT_CRYPTO_HISTORY_REFRESH_MS
      payloadRef.current = json
      setPayload(json)
      setError(null)
    }

    async function load(staged: boolean) {
      let hasRenderedPayload = Boolean(payloadRef.current)
      try {
        if (staged && initialLimit > 0) {
          const priorityJson = await fetchPayload(initialLimit)
          if (!active) return
          applyPayload(priorityJson)
          hasRenderedPayload = true
          setLoading(false)
        }
      } catch (requestError) {
        if (!active || (requestError as Error).name === "AbortError") return
      }

      try {
        const json = await fetchPayload()
        if (!active) return
        applyPayload(json)
      } catch (requestError) {
        if (
          active &&
          (requestError as Error).name !== "AbortError" &&
          !hasRenderedPayload &&
          !payloadRef.current
        ) {
          setError(requestError instanceof Error ? requestError.message : "load failed")
        }
      } finally {
        if (!active) return
        setLoading(false)
        timer = setTimeout(() => {
          void load(false)
        }, refreshMsRef.current)
      }
    }

    void load(true)
    return () => {
      active = false
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [ccy, enabled, initialLimit, range])

  return { payload, loading, error }
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
      className={className}
    />
  )
}
