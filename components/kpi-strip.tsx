"use client"

import * as React from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { TrendingDown, TrendingUp } from "lucide-react"

import { InfoTooltip } from "@/components/info-tooltip"
import { cn } from "@/lib/utils"

export interface KpiTile {
  id: string
  label: string
  value: string
  delta?: string
  deltaTone?: "up" | "down" | "neutral"
  helper?: string
  sparkline?: number[]
  info?: {
    title?: string
    description: React.ReactNode
    source?: string
  }
}

interface KpiStripProps {
  tiles: KpiTile[]
  className?: string
}

export function KpiStrip({ tiles, className }: KpiStripProps) {
  if (tiles.length === 0) return null

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-wrap gap-1.5 overflow-visible rounded-lg border bg-card/80 p-1.5 shadow-sm",
        className,
      )}
    >
      {tiles.map((tile) => (
        <KpiTileCard key={tile.id} tile={tile} />
      ))}
    </div>
  )
}

function KpiTileCard({ tile }: { tile: KpiTile }) {
  const toneClass =
    tile.deltaTone === "up"
      ? "text-green-600"
      : tile.deltaTone === "down"
        ? "text-red-600"
        : "text-muted-foreground"

  const sparkData = (tile.sparkline ?? []).map((value, index) => ({ index, value }))
  const sparkColor =
    tile.deltaTone === "up"
      ? "rgb(22 163 74)"
      : tile.deltaTone === "down"
        ? "rgb(220 38 38)"
        : "rgb(100 116 139)"

  return (
    <div className="flex min-w-0 flex-[1_1_9rem] flex-col justify-between gap-0.5 rounded-md border bg-background/70 px-2.5 py-1.5 sm:flex-[1_1_140px]">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {tile.label}
        </span>
        {tile.info && (
          <InfoTooltip
            title={tile.info.title ?? tile.label}
            description={tile.info.description}
            source={tile.info.source}
          />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold tabular-nums">{tile.value}</span>
        {tile.delta && (
          <span className={cn("flex shrink-0 items-center gap-0.5 text-[10px] font-medium tabular-nums", toneClass)}>
            {tile.deltaTone === "up" && <TrendingUp className="h-3 w-3" />}
            {tile.deltaTone === "down" && <TrendingDown className="h-3 w-3" />}
            {tile.delta}
          </span>
        )}
      </div>
      {tile.helper && <span className="truncate text-[9px] text-muted-foreground">{tile.helper}</span>}
      {sparkData.length > 1 && (
        <div className="-mx-1 h-5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 1, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                fill={sparkColor}
                fillOpacity={0.16}
                strokeWidth={1.4}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export type { KpiStripProps }
