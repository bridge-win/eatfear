"use client"

import { useEffect, useMemo, useState } from "react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"

interface ApiSeries {
  key: string
  i18nKey: string
  paneIndex: number
  color: string
  unit: AlignedHistoryUnit
  data: { time: number; value: number | null }[]
}

interface ApiResponse {
  range: string
  ccy: string
  timeline: number[]
  series: ApiSeries[]
  paneCount: number
  updatedAt: number
}

export interface CryptoHistoryCompareProps {
  instId?: string
  range: TimeRangeId
  className?: string
}

export function CryptoHistoryCompare({ instId = "BTC-USDT-SWAP", range, className }: CryptoHistoryCompareProps) {
  const t = useT()
  const [payload, setPayload] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ccy = instId.split("-")[0] ?? "BTC"

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/crypto/history-compare?ccy=${encodeURIComponent(ccy)}&range=${range}`)
      .then((response) => response.json())
      .then((json) => {
        if (!active) return
        setPayload(json as ApiResponse)
        setError(null)
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "load failed")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [ccy, range])

  const data: AlignedHistoryData | null = useMemo(() => {
    if (!payload) return null
    const series: AlignedHistorySeries[] = payload.series.map((spec) => ({
      key: spec.key,
      label: t(spec.i18nKey),
      paneIndex: spec.paneIndex,
      color: spec.color,
      unit: spec.unit,
      data: spec.data,
    }))
    return {
      timeline: payload.timeline,
      series,
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
