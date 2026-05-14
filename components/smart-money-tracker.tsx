"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { TrendingDown, TrendingUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { useI18n, useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import { cn } from "@/lib/utils"

interface SmartMoneyBucket {
  time: number
  buy: number
  sell: number
  net: number
  cumulativeNet: number
}

interface SmartMoneyResponse {
  source: string
  ccy: string
  range: string
  period: string
  buckets: SmartMoneyBucket[]
  totals: {
    buy: number
    sell: number
    net: number
    ratio: number | null
  }
  updatedAt: number
}

const formatCompact = (value: number, base: string) => {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B ${base}`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M ${base}`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K ${base}`
  return `${value.toFixed(2)} ${base}`
}

export interface SmartMoneyTrackerProps {
  ccy?: string
  range: TimeRangeId
  className?: string
}

export function SmartMoneyTracker({ ccy = "BTC", range, className }: SmartMoneyTrackerProps) {
  const t = useT()
  const { locale } = useI18n()
  const [payload, setPayload] = useState<SmartMoneyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    setLoading(true)

    async function load() {
      try {
        const res = await fetch(
          `/api/crypto/smart-money?ccy=${encodeURIComponent(ccy)}&range=${range}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error(`smart-money api ${res.status}`)
        const json = (await res.json()) as SmartMoneyResponse
        if (isActive) {
          setPayload(json)
          setError(null)
        }
      } catch (e) {
        if (isActive && (e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "load failed")
        }
      } finally {
        if (isActive) setLoading(false)
      }
    }

    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => {
      isActive = false
      controller.abort()
      window.clearInterval(timer)
    }
  }, [ccy, range])

  const chartData = useMemo(
    () =>
      (payload?.buckets ?? []).map((bucket) => ({
        time: bucket.time,
        label: new Date(bucket.time).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
          month: "short",
          day: "2-digit",
        }),
        buy: bucket.buy,
        sell: -bucket.sell,
        sellRaw: bucket.sell,
        net: bucket.net,
        cumulativeNet: bucket.cumulativeNet,
      })),
    [payload?.buckets, locale],
  )

  const totals = payload?.totals
  const netTone =
    !totals
      ? "text-muted-foreground"
      : totals.net > 0
        ? "text-green-600 dark:text-green-400"
        : totals.net < 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground"

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("smart.title", { ccy })}</CardTitle>
            <InfoTooltip
              title={t("smart.title", { ccy })}
              description={t("smart.info")}
              source="OKX Rubik taker-volume (SWAP + SPOT)"
            />
          </div>
          {totals && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
              <span className="text-green-600 dark:text-green-400">
                {t("smart.kpi.buy")} {formatCompact(totals.buy, ccy)}
              </span>
              <span className="text-red-600 dark:text-red-400">
                {t("smart.kpi.sell")} {formatCompact(totals.sell, ccy)}
              </span>
              <span className={cn("inline-flex items-center gap-0.5", netTone)}>
                {totals.net >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {t("smart.kpi.net")} {formatCompact(totals.net, ccy)}
              </span>
              {totals.ratio !== null && (
                <span className="rounded border px-1.5 py-0 text-[9px]">
                  {t("smart.kpi.ratio")} {totals.ratio.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {error ? (
          <p className="py-8 text-center text-xs text-destructive">{error}</p>
        ) : loading && chartData.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("smart.loading")}</p>
        ) : chartData.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("chart.noData")}</p>
        ) : (
          <div className="space-y-2">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} minTickGap={32} />
                  <YAxis tickLine={false} axisLine={false} width={56} fontSize={10}
                         tickFormatter={(v: number) => formatCompact(v, "")} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                    formatter={(value: number, name) => {
                      if (name === "sell") return [formatCompact(Math.abs(value), ccy), t("smart.kpi.sell")]
                      if (name === "buy") return [formatCompact(value, ccy), t("smart.kpi.buy")]
                      if (name === "net") return [formatCompact(value, ccy), t("smart.kpi.net")]
                      return [value, name]
                    }}
                    labelFormatter={(label: string) => label}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10 }}
                    formatter={(value) => {
                      if (value === "buy") return t("smart.kpi.buy")
                      if (value === "sell") return t("smart.kpi.sell")
                      if (value === "net") return t("smart.kpi.net")
                      return value
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="buy"
                    stroke="rgb(22 163 74)"
                    strokeWidth={1.6}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sell"
                    stroke="rgb(220 38 38)"
                    strokeWidth={1.6}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="rgb(99 102 241)"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} minTickGap={32} />
                  <YAxis tickLine={false} axisLine={false} width={56} fontSize={10}
                         tickFormatter={(v: number) => formatCompact(v, "")} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                    formatter={(value: number) => [formatCompact(value, ccy), t("smart.kpi.cumNet")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeNet"
                    stroke="rgb(99 102 241)"
                    fill="rgb(99 102 241)"
                    fillOpacity={0.18}
                    strokeWidth={1.6}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
