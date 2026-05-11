"use client"

import { useState } from "react"
import { Check, ChevronDown, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type DataSourceId = "okx" | "binance" | "coingecko"

export interface DataSource {
  id: DataSourceId
  name: string
  label: string
  description: string
  apiEndpoint: string
  features: string[]
  requiresApiKey?: boolean
  apiKeyEnvVar?: string
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "okx",
    name: "OKX",
    label: "OKX",
    description: "Full derivatives data, order book, funding rates",
    apiEndpoint: "/api/crypto/btc-derivatives",
    features: ["Klines", "Order Book", "Funding Rate", "OI", "Long/Short Ratio", "CVD", "Top Trader"],
  },
  {
    id: "binance",
    name: "Binance",
    label: "Binance",
    description: "Global largest exchange, full futures data",
    apiEndpoint: "/api/crypto/binance",
    features: ["Klines", "Funding Rate", "OI", "Long/Short Ratio", "Top Trader", "Taker Volume"],
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    label: "CoinGecko",
    description: "Aggregated market data, requires API key for full access",
    apiEndpoint: "/api/crypto/coingecko",
    features: ["Price", "Market Cap", "Volume", "ATH/ATL"],
    requiresApiKey: true,
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
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandList>
            <CommandGroup heading="Data Sources">
              {DATA_SOURCES.map((source) => (
                <CommandItem
                  key={source.id}
                  value={source.id}
                  onSelect={() => {
                    onChange(source.id)
                    setOpen(false)
                  }}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{source.name}</span>
                      {source.requiresApiKey && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                          API Key
                        </span>
                      )}
                    </div>
                    {value === source.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{source.description}</span>
                  <div className="flex flex-wrap gap-1">
                    {source.features.slice(0, 4).map((feature) => (
                      <span
                        key={feature}
                        className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
                      >
                        {feature}
                      </span>
                    ))}
                    {source.features.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">+{source.features.length - 4}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
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
