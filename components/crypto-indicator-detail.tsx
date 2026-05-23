"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Plus, X } from "lucide-react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistorySeries,
} from "@/components/aligned-history-compare"
import { getCryptoIndicatorDescription } from "@/components/crypto-indicator-info"
import type { CryptoHistoryPayload, CryptoHistorySeries } from "@/components/crypto-history-compare"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { InfoPopover } from "@/components/info-popover"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"

interface CryptoIndicatorDetailProps {
  payload: CryptoHistoryPayload
  selectedKey: string
  onBack: () => void
}

function toAlignedSeries(series: CryptoHistorySeries, label: string, description: string): AlignedHistorySeries {
  return {
    key: series.key,
    order: series.order,
    label,
    color: series.color,
    unit: series.unit,
    data: series.data,
    info: {
      title: `#${String(series.order).padStart(2, "0")} ${label}`,
      description,
      source: series.source,
    },
  }
}

export function CryptoIndicatorDetail({ payload, selectedKey, onBack }: CryptoIndicatorDetailProps) {
  const t = useT()
  const [selectedKeys, setSelectedKeys] = useState<string[]>([selectedKey])
  const [compareKey, setCompareKey] = useState<string>("")

  useEffect(() => {
    setSelectedKeys([selectedKey])
    setCompareKey("")
  }, [selectedKey])

  const seriesByKey = useMemo(() => {
    return new Map(payload.series.map((series) => [series.key, series]))
  }, [payload.series])

  const primary = seriesByKey.get(selectedKey) ?? payload.series[0]
  const selectedSeries = selectedKeys
    .map((key) => seriesByKey.get(key))
    .filter((series): series is CryptoHistorySeries => Boolean(series))

  const compareOptions: SymbolOption[] = payload.series
    .filter((series) => !selectedKeys.includes(series.key))
    .map((series) => ({
      id: series.key,
      label: `#${String(series.order).padStart(2, "0")} ${getCryptoSeriesLabel(t, series)}`,
      hint: series.source,
    }))

  const data: AlignedHistoryData | null = useMemo(() => {
    if (selectedSeries.length === 0) return null
    const chartSeries = selectedSeries.map((series) => {
      return toAlignedSeries(
        series,
        getCryptoSeriesLabel(t, series),
        getCryptoIndicatorDescription({ payload, series, t }),
      )
    })

    return {
      timeline: payload.timeline,
      groups: [{ key: "detail", series: chartSeries }],
    }
  }, [payload.timeline, selectedSeries, t])

  if (!primary) return null

  const primaryLabel = getCryptoSeriesLabel(t, primary)
  const primaryInfo = getCryptoIndicatorDescription({ payload, series: primary, t })

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="h-8 px-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("crypto.detail.back")}
          </Button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground">
                #{String(primary.order).padStart(2, "0")}
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: primary.color }} />
              <h2 className="truncate text-sm font-semibold">{primaryLabel}</h2>
              <InfoPopover
                title={`#${String(primary.order).padStart(2, "0")} ${primaryLabel}`}
                description={primaryInfo}
                source={primary.source}
                className="h-3.5 w-3.5"
                iconClassName="h-3 w-3"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{t("crypto.detail.subtitle")}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <SymbolSelector
            value={compareKey}
            options={compareOptions}
            onChange={setCompareKey}
            placeholder={t("crypto.detail.search")}
            emptyMessage={t("crypto.detail.empty")}
            className="h-8 min-w-[220px] text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!compareKey}
            onClick={() => {
              if (!compareKey || selectedKeys.includes(compareKey)) return
              setSelectedKeys((previous) => [...previous, compareKey])
              setCompareKey("")
            }}
            className="h-8 px-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("crypto.detail.addCompare")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {selectedSeries.map((series, index) => {
          const label = getCryptoSeriesLabel(t, series)
          return (
            <span
              key={series.key}
              className="inline-flex h-6 items-center gap-1 rounded-full border bg-muted/30 px-2 text-[10px]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: series.color }} />
              #{String(series.order).padStart(2, "0")} {label}
              {index > 0 && (
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => setSelectedKeys((previous) => previous.filter((key) => key !== series.key))}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )
        })}
      </div>

      <AlignedHistoryCompare
        data={data}
        title={t("crypto.detail.chartTitle", { label: primaryLabel })}
        infoDescription={t("crypto.detail.chartInfo")}
        infoSource="Shared crypto history payload · aligned timeline"
        loading={false}
        error={null}
        loadingLabel={t("compare.loading")}
        noDataLabel={t("chart.noData")}
        seriesCountLabel={t("compare.seriesCount")}
        maxSeriesPerPane={Math.max(2, selectedSeries.length)}
      />
    </section>
  )
}
