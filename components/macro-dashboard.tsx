"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"
import type { MacroIndicator } from "@/lib/types"

interface MacroApiResponse {
  updatedAt: number
  indicators: MacroIndicator[]
  error?: string
}

const formatValue = (value: number, unit: MacroIndicator["unit"]) => {
  if (unit === "percent") return `${value.toFixed(2)}%`
  if (unit === "usd") {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value > 100 ? 0 : 2,
    })
  }
  if (unit === "ratio") return value.toFixed(4)

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })
}

const formatChange = (indicator: MacroIndicator) => {
  const sign = indicator.change >= 0 ? "+" : ""
  return `${sign}${formatValue(indicator.change, indicator.unit)} (${sign}${indicator.changePercent.toFixed(2)}%)`
}

export function MacroDashboard() {
  const [indicators, setIndicators] = useState<MacroIndicator[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadMacroData() {
      try {
        const response = await fetch("/api/macro")
        const payload = (await response.json()) as MacroApiResponse

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load macro data")
        }

        if (!isActive) return

        setIndicators(payload.indicators)
        setUpdatedAt(payload.updatedAt)
        setError(null)
      } catch (requestError) {
        if (isActive) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load macro data")
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadMacroData()
    const interval = setInterval(loadMacroData, 5 * 60 * 1000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [])

  const groupedIndicators = useMemo(
    () =>
      indicators.reduce<Record<MacroIndicator["group"], MacroIndicator[]>>(
        (groups, indicator) => {
          groups[indicator.group].push(indicator)
          return groups
        },
        {
          Equity: [],
          Rates: [],
          Volatility: [],
          Dollar: [],
          Commodity: [],
          FX: [],
          Credit: [],
          Crypto: [],
        },
      ),
    [indicators],
  )

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Macro Dashboard</h1>
              <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
                跨资产宏观代理指标：全球股指、波动率、收益率曲线、美元、信用、商品、外汇和 BTC/ETH。
              </p>
            </div>
            <div className="rounded-full border px-4 py-2 text-sm text-muted-foreground">
              {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("zh-CN")}` : "Loading live data"}
            </div>
          </div>

          {error && (
            <Card className="border-destructive/40">
              <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {isLoading && indicators.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading macro indicators...
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
                {indicators.map((indicator) => (
                  <MacroCard key={indicator.symbol} indicator={indicator} />
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Macro Table</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Indicator</th>
                          <th className="py-3 pr-4 font-medium">Group</th>
                          <th className="py-3 pr-4 text-right font-medium">Latest</th>
                          <th className="py-3 pr-4 text-right font-medium">Daily Change</th>
                          <th className="py-3 pr-4 font-medium">Source</th>
                          <th className="py-3 text-right font-medium">Last Update</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicators.map((indicator) => (
                          <tr key={indicator.symbol} className="border-b last:border-0">
                            <td className="py-3 pr-4">
                              <p className="font-medium">{indicator.name}</p>
                              <p className="text-xs text-muted-foreground">{indicator.symbol}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <Badge variant="secondary">{indicator.group}</Badge>
                            </td>
                            <td className="py-3 pr-4 text-right font-medium">
                              {formatValue(indicator.value, indicator.unit)}
                            </td>
                            <td
                              className={cn(
                                "py-3 pr-4 text-right font-medium",
                                indicator.change >= 0 ? "text-green-600" : "text-red-600",
                              )}
                            >
                              {formatChange(indicator)}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">{indicator.source}</td>
                            <td className="py-3 text-right text-muted-foreground">
                              {new Date(indicator.lastUpdate).toLocaleString("zh-CN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Coverage</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm md:grid-cols-4">
                  {Object.entries(groupedIndicators)
                    .filter(([, groupIndicators]) => groupIndicators.length > 0)
                    .map(([group, groupIndicators]) => (
                      <div key={group} className="rounded-xl border p-3">
                        <p className="font-medium">{group}</p>
                        <p className="mt-1 text-muted-foreground">
                          {groupIndicators.map((indicator) => indicator.name).join(", ")}
                        </p>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function MacroCard({ indicator }: { indicator: MacroIndicator }) {
  const isPositive = indicator.change >= 0
  const chartColor = isPositive ? "rgb(22 163 74)" : "rgb(220 38 38)"
  const chartData = indicator.history.slice(-90)

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm">{indicator.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{indicator.symbol}</p>
          </div>
          <Badge variant="outline">{indicator.group}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-bold">{formatValue(indicator.value, indicator.unit)}</p>
            <p className={cn("mt-1 flex items-center gap-1 text-xs", isPositive ? "text-green-600" : "text-red-600")}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatChange(indicator)}
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground">6M history</p>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} fontSize={10} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                formatter={(value: unknown) => [formatValue(Number(value), indicator.unit), indicator.name]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                fill={chartColor}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
