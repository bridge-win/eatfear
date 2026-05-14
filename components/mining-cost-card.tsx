"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { useI18n, useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import { cn } from "@/lib/utils"

interface CostPoint {
  time: number
  hashrate: number
  electricityUsdPerBtc: number
  marketPriceUsd: number | null
  marginPct: number | null
}

interface MiningCostResponse {
  source: string
  range: string
  parameters: {
    efficiencyJPerTh: number
    electricityUsdPerKwh: number
    blockReward: number
  }
  points: CostPoint[]
  latest: CostPoint | null
  updatedAt: number
  error?: string
}

const formatUsd = (v: number) => {
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  return `$${v.toFixed(0)}`
}

export interface MiningCostCardProps {
  range: TimeRangeId
  className?: string
}

export function MiningCostCard({ range, className }: MiningCostCardProps) {
  const t = useT()
  const { locale } = useI18n()
  const [payload, setPayload] = useState<MiningCostResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    setLoading(true)

    async function load() {
      try {
        const res = await fetch(`/api/crypto/mining-cost?range=${range}`, { signal: controller.signal })
        const json = (await res.json()) as MiningCostResponse
        if (!res.ok && json.error) throw new Error(json.error)
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
    const timer = window.setInterval(load, 10 * 60 * 1000)
    return () => {
      isActive = false
      controller.abort()
      window.clearInterval(timer)
    }
  }, [range])

  const chartData = useMemo(
    () =>
      (payload?.points ?? []).map((point) => ({
        time: point.time,
        label: new Date(point.time).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
          month: "short",
          day: "2-digit",
        }),
        cost: point.electricityUsdPerBtc,
        price: point.marketPriceUsd ?? undefined,
        margin: point.marginPct ?? undefined,
      })),
    [payload?.points, locale],
  )

  const latest = payload?.latest
  const latestPrice = latest?.marketPriceUsd ?? null
  const latestCost = latest?.electricityUsdPerBtc ?? null
  const latestMargin = latest?.marginPct ?? null

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("mining.title")}</CardTitle>
            <InfoTooltip
              title={t("mining.title")}
              description={
                payload
                  ? t("mining.info", {
                      eff: payload.parameters.efficiencyJPerTh,
                      rate: payload.parameters.electricityUsdPerKwh,
                      reward: payload.parameters.blockReward,
                    })
                  : t("mining.info.fallback")
              }
              source="mempool.space + blockchain.info"
            />
          </div>
          {latest && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
              <span>
                {t("mining.kpi.hashrate")} {latest.hashrate.toFixed(1)} EH/s
              </span>
              {latestCost !== null && (
                <span>
                  {t("mining.kpi.cost")} {formatUsd(latestCost)}
                </span>
              )}
              {latestPrice !== null && (
                <span>
                  {t("mining.kpi.price")} {formatUsd(latestPrice)}
                </span>
              )}
              {latestMargin !== null && (
                <span
                  className={cn(
                    "rounded border px-1.5 py-0 text-[9px]",
                    latestMargin >= 0
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
                  )}
                >
                  {t("mining.kpi.margin")} {latestMargin >= 0 ? "+" : ""}
                  {latestMargin.toFixed(0)}%
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
          <p className="py-8 text-center text-xs text-muted-foreground">{t("mining.loading")}</p>
        ) : chartData.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("chart.noData")}</p>
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} minTickGap={32} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  fontSize={10}
                  tickFormatter={(v: number) => formatUsd(v)}
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                  formatter={(value: number, name) => {
                    if (name === "cost") return [formatUsd(value), t("mining.kpi.cost")]
                    if (name === "price") return [formatUsd(value), t("mining.kpi.price")]
                    return [value, name]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => {
                    if (value === "cost") return t("mining.kpi.cost")
                    if (value === "price") return t("mining.kpi.price")
                    return value
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="rgb(245 158 11)"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="rgb(99 102 241)"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
