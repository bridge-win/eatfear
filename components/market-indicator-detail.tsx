"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Plus, X } from "lucide-react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistorySeries,
} from "@/components/aligned-history-compare"
import { InfoPopover } from "@/components/info-popover"
import type { MarketIndicatorItem } from "@/components/market-indicator-cards"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Button } from "@/components/ui/button"

interface MarketIndicatorDetailProps {
  items: MarketIndicatorItem[]
  selectedKey: string
  backLabel: string
  subtitle: string
  searchPlaceholder: string
  emptyMessage: string
  addCompareLabel: string
  chartTitle: string
  chartInfo: string
  chartInfoSource: string
  loadingLabel: string
  noDataLabel: string
  seriesCountLabel: string
  onBack: () => void
}

function toAlignedSeries(item: MarketIndicatorItem): AlignedHistorySeries {
  return {
    key: item.key,
    order: item.order,
    label: item.label,
    color: item.color,
    unit: item.unit,
    data: item.data,
    info: {
      title: `#${String(item.order).padStart(2, "0")} ${item.label}`,
      description: item.description,
      source: item.source,
    },
  }
}

export function MarketIndicatorDetail({
  items,
  selectedKey,
  backLabel,
  subtitle,
  searchPlaceholder,
  emptyMessage,
  addCompareLabel,
  chartTitle,
  chartInfo,
  chartInfoSource,
  loadingLabel,
  noDataLabel,
  seriesCountLabel,
  onBack,
}: MarketIndicatorDetailProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([selectedKey])
  const [compareKey, setCompareKey] = useState("")

  useEffect(() => {
    setSelectedKeys([selectedKey])
    setCompareKey("")
  }, [selectedKey])

  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items])
  const primary = itemByKey.get(selectedKey) ?? items[0]
  const selectedItems = selectedKeys.map((key) => itemByKey.get(key)).filter((item): item is MarketIndicatorItem => Boolean(item))

  const compareOptions: SymbolOption[] = items
    .filter((item) => !selectedKeys.includes(item.key))
    .map((item) => ({
      id: item.key,
      label: `#${String(item.order).padStart(2, "0")} ${item.label}`,
      hint: item.source,
    }))

  const data: AlignedHistoryData | null = useMemo(() => {
    if (selectedItems.length === 0) return null
    return {
      groups: [{ key: "detail", series: selectedItems.map(toAlignedSeries) }],
    }
  }, [selectedItems])

  if (!primary) return null

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="h-8 px-2 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground">
                #{String(primary.order).padStart(2, "0")}
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: primary.color }} />
              <h2 className="truncate text-sm font-semibold">{primary.label}</h2>
              <InfoPopover
                title={`#${String(primary.order).padStart(2, "0")} ${primary.label}`}
                description={primary.description}
                source={primary.source}
                className="h-3.5 w-3.5"
                iconClassName="h-3 w-3"
                contentClassName="w-[30rem]"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <SymbolSelector
            value={compareKey}
            options={compareOptions}
            onChange={setCompareKey}
            placeholder={searchPlaceholder}
            emptyMessage={emptyMessage}
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
            {addCompareLabel}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {selectedItems.map((item, index) => (
          <span key={item.key} className="inline-flex h-6 items-center gap-1 rounded-full border bg-muted/30 px-2 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            #{String(item.order).padStart(2, "0")} {item.label}
            {index > 0 && (
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => setSelectedKeys((previous) => previous.filter((key) => key !== item.key))}
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      <AlignedHistoryCompare
        data={data}
        title={chartTitle}
        infoDescription={chartInfo}
        infoSource={chartInfoSource}
        loading={false}
        error={null}
        loadingLabel={loadingLabel}
        noDataLabel={noDataLabel}
        seriesCountLabel={seriesCountLabel}
        maxSeriesPerPane={Math.max(2, selectedItems.length)}
      />
    </section>
  )
}
