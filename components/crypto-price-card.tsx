"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, TrendingDown, TrendingUp } from "lucide-react"
import type { CryptoAsset } from "@/lib/types"

interface CryptoPriceCardProps {
  asset: CryptoAsset
  isSubscribed?: boolean
  onSubscribeToggle?: (symbol: string) => void
}

export function CryptoPriceCard({ asset, isSubscribed = false, onSubscribeToggle }: CryptoPriceCardProps) {
  const isPositive = asset.changePercent24h >= 0
  const formattedPrice = asset.price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: asset.price < 1 ? 6 : 2,
  })
  const formattedChange = Math.abs(asset.change24h).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: asset.price < 1 ? 6 : 2,
  })

  return (
    <Card className="relative hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">{asset.name}</h3>
          <p className="text-sm text-muted-foreground">{asset.symbol.replace("USDT", "")}</p>
        </div>
        {onSubscribeToggle && (
          <Button
            variant={isSubscribed ? "default" : "outline"}
            size="icon"
            onClick={() => onSubscribeToggle(asset.symbol)}
            className="h-8 w-8"
          >
            {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-2xl font-bold">{formattedPrice}</p>
          <div className="flex items-center gap-2">
            <Badge variant={isPositive ? "default" : "destructive"} className="gap-1">
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? "+" : ""}
              {asset.changePercent24h.toFixed(2)}%
            </Badge>
            <span className={`text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}
              {formattedChange}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
