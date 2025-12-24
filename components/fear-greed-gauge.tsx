"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FearGreedIndex } from "@/lib/types"

interface FearGreedGaugeProps {
  index: FearGreedIndex | null
}

export function FearGreedGauge({ index }: FearGreedGaugeProps) {
  if (!index) return null

  const getColor = (value: number) => {
    if (value <= 24) return "text-red-600"
    if (value <= 49) return "text-orange-600"
    if (value === 50) return "text-yellow-600"
    if (value <= 74) return "text-lime-600"
    return "text-green-600"
  }

  const getBackgroundGradient = () => {
    return "linear-gradient(to right, #dc2626 0%, #ea580c 25%, #eab308 50%, #84cc16 75%, #16a34a 100%)"
  }

  const position = `${index.value}%`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fear & Greed Index</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className={`text-5xl font-bold ${getColor(index.value)}`}>{index.value}</p>
          <p className={`text-xl font-semibold mt-2 ${getColor(index.value)}`}>{index.classification}</p>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: getBackgroundGradient() }}>
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
            style={{ left: position, transform: "translateX(-50%)" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Extreme Fear</span>
          <span>Neutral</span>
          <span>Extreme Greed</span>
        </div>
      </CardContent>
    </Card>
  )
}
