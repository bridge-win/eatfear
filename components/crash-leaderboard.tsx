"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingDown } from "lucide-react"
import type { StockAsset } from "@/lib/types"

interface CrashLeaderboardProps {
  stocks: StockAsset[]
}

export function CrashLeaderboard({ stocks }: CrashLeaderboardProps) {
  if (stocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Top Crashes Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No significant crashes detected today.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-destructive" />
          Top Crashes Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stocks.map((stock, index) => (
            <div
              key={stock.symbol}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                index < 3 ? "bg-destructive/5 border-destructive/20" : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                    index === 0
                      ? "bg-red-600 text-white"
                      : index === 1
                        ? "bg-orange-600 text-white"
                        : index === 2
                          ? "bg-yellow-600 text-white"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold">{stock.symbol}</p>
                  <p className="text-sm text-muted-foreground">{stock.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">${stock.price.toFixed(2)}</p>
                <Badge variant="destructive" className="gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {stock.changePercentToday.toFixed(2)}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
