"use client"

import { useState } from "react"
import { Check, ChevronDown, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"

export type DataSourceId = "okx" | "binance" | "coingecko"

export interface DataSource {
  id: DataSourceId
  name: string
  label: string
  /** i18n key for the source description */
  descriptionKey: string
  apiEndpoint: string
  /** i18n keys for feature labels */
  featureKeys: string[]
  requiresApiKey?: boolean
  apiKeyEnvVar?: string
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "okx",
    name: "OKX",
    label: "OKX",
    descriptionKey: "dataSource.okx.desc",
    apiEndpoint: "/api/crypto/btc-derivatives",
    featureKeys: [
      "dataSource.feature.kline",
      "dataSource.feature.book",
      "dataSource.feature.funding",
      "dataSource.feature.oi",
      "dataSource.feature.longshort",
      "dataSource.feature.cvd",
      "dataSource.feature.toptraders",
    ],
  },
  {
    id: "binance",
    name: "Binance",
    label: "Binance",
    descriptionKey: "dataSource.binance.desc",
    apiEndpoint: "/api/crypto/binance",
    featureKeys: [
      "dataSource.feature.kline",
      "dataSource.feature.funding",
      "dataSource.feature.oi",
      "dataSource.feature.longshort",
      "dataSource.feature.toptraders",
      "dataSource.feature.taker",
    ],
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    label: "CoinGecko",
    descriptionKey: "dataSource.coingecko.desc",
    apiEndpoint: "/api/crypto/coingecko",
    featureKeys: [
      "dataSource.feature.price",
      "dataSource.feature.mcap",
      "dataSource.feature.volume",
      "dataSource.feature.ath",
    ],
    requiresApiKey: false,
    apiKeyEnvVar: "COINGECKO_API_KEY",
  },
]

interface DataSourceSelectorProps {
  value: DataSourceId
  onChange: (value: DataSourceId) => void
  className?: string
}

export function DataSourceSelector({ value, onChange, className }: DataSourceSelectorProps) {
  const [open, setOpen] = useState(false)
  const t = useT()

  const selectedSource = DATA_SOURCES.find((s) => s.id === value) ?? DATA_SOURCES[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 justify-between gap-1.5 px-2.5 text-xs", className)}
        >
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[80px] truncate font-medium">{selectedSource.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-1" align="end">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          {t("dataSource.title")}
        </div>
        <div className="space-y-0.5">
          {DATA_SOURCES.map((source) => (
            <button
              key={source.id}
              onClick={() => {
                onChange(source.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                value === source.id && "bg-accent"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{source.name}</span>
                  {source.id === "coingecko" && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t("dataSource.tier.basic")}
                    </span>
                  )}
                  {(source.id === "okx" || source.id === "binance") && (
                    <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-600 dark:text-green-400">
                      {t("dataSource.tier.full")}
                    </span>
                  )}
                </div>
                {value === source.id && <Check className="h-4 w-4 text-primary" />}
              </div>
              <span className="text-[11px] text-muted-foreground">{t(source.descriptionKey)}</span>
              <div className="flex flex-wrap gap-1">
                {source.featureKeys.slice(0, 5).map((featureKey) => (
                  <span
                    key={featureKey}
                    className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
                  >
                    {t(featureKey)}
                  </span>
                ))}
                {source.featureKeys.length > 5 && (
                  <span className="text-[9px] text-muted-foreground">+{source.featureKeys.length - 5}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function getDataSourceEndpoint(sourceId: DataSourceId): string {
  const source = DATA_SOURCES.find((s) => s.id === sourceId)
  return source?.apiEndpoint ?? DATA_SOURCES[0].apiEndpoint
}

export function getDataSource(sourceId: DataSourceId): DataSource {
  return DATA_SOURCES.find((s) => s.id === sourceId) ?? DATA_SOURCES[0]
}
