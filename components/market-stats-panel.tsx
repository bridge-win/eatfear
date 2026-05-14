"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp } from "lucide-react"
import type { MarketStats } from "@/lib/types"

interface MarketStatsPanelProps {
  stats: MarketStats | null
}

export function MarketStatsPanel({ stats }: MarketStatsPanelProps) {
  if (!stats) return null

  /* Locale-free formatter — `toLocaleString()` without a locale arg picks up
     the runtime default, which differs between Node SSR and the browser and
     breaks hydration. */
  const groupDigits = (n: number) => {
    const fixed = n.toFixed(0)
    return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    return `$${groupDigits(value)}`
  }

  const isPositiveChange = stats.marketCapChange24h >= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Market Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Market Cap</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{formatCurrency(stats.totalMarketCap)}</p>
              <span className={`flex items-center text-sm ${isPositiveChange ? "text-green-600" : "text-red-600"}`}>
                {isPositiveChange ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(stats.marketCapChange24h).toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">24h Volume</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.volume24h)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">BTC Dominance</p>
            <p className="text-2xl font-bold">{stats.btcDominance.toFixed(2)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Active Cryptocurrencies</p>
            <p className="text-2xl font-bold">{groupDigits(stats.activeCryptos)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
