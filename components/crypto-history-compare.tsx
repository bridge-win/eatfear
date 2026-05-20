"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistoryGroup,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import { DEFAULT_CRYPTO_HISTORY_REFRESH_MS } from "@/lib/crypto-indicator-config"

export interface CryptoHistorySeries {
  key: string
  i18nKey: string
  infoI18nKey: string
  order: number
  paneIndex: number
  color: string
  source: string
  unit: AlignedHistoryUnit
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
): {
  payload: CryptoHistoryPayload | null
  loading: boolean
  error: string | null
} {
  const [payload, setPayload] = useState<CryptoHistoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshMsRef = useRef(DEFAULT_CRYPTO_HISTORY_REFRESH_MS)
  const ccy = instId.split("-")[0] ?? "BTC"

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    setLoading(true)

    async function load() {
      try {
        const response = await fetch(`/api/crypto/history-compare?ccy=${encodeURIComponent(ccy)}&range=${range}`)
        if (!response.ok) throw new Error(`history-compare ${response.status}`)
        const json = (await response.json()) as CryptoHistoryPayload
        if (!active) return
        refreshMsRef.current = json.refreshMs || DEFAULT_CRYPTO_HISTORY_REFRESH_MS
        setPayload(json)
        setError(null)
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "load failed")
      } finally {
        if (!active) return
        setLoading(false)
        timer = setTimeout(load, refreshMsRef.current)
      }
    }

    load()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [ccy, enabled, range])

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
      const series: AlignedHistorySeries = {
        key: spec.key,
        order: spec.order,
        label: t(spec.i18nKey),
        color: spec.color,
        unit: spec.unit,
        data: spec.data,
        info: {
          title: `#${String(spec.order).padStart(2, "0")} ${t(spec.i18nKey)}`,
          description: t(spec.infoI18nKey),
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
