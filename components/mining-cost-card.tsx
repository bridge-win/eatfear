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
  comprehensiveUsdPerBtc: number
  marketPriceUsd: number | null
  electricityMarginPct: number | null
  comprehensiveMarginPct: number | null
  marginPct: number | null
}

interface MiningCostResponse {
  source: string
  range: string
  parameters: {
    efficiencyJPerTh: number
    electricityUsdPerKwh: number
    comprehensiveMultiplier: number
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
  variant?: "full" | "cards"
}

function MiningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/70 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function MiningCostCard({ range, className, variant = "full" }: MiningCostCardProps) {
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
        electricityCost: point.electricityUsdPerBtc,
        comprehensiveCost: point.comprehensiveUsdPerBtc,
        price: point.marketPriceUsd ?? undefined,
        electricityMargin: point.electricityMarginPct ?? point.marginPct ?? undefined,
        comprehensiveMargin: point.comprehensiveMarginPct ?? undefined,
      })),
    [payload?.points, locale],
  )

  const latest = payload?.latest
  const latestPrice = latest?.marketPriceUsd ?? null
  const latestElectricityCost = latest?.electricityUsdPerBtc ?? null
  const latestComprehensiveCost = latest?.comprehensiveUsdPerBtc ?? null
  const latestElectricityMargin = latest?.electricityMarginPct ?? latest?.marginPct ?? null
  const latestComprehensiveMargin = latest?.comprehensiveMarginPct ?? null

  if (variant === "cards") {
    return (
      <Card className={cn("py-2.5", className)}>
        <CardHeader className="px-3 pb-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm">{t("mining.title")}</CardTitle>
              <InfoTooltip
                title={t("mining.title")}
                description={
                  payload
                    ? t("mining.info", {
                        eff: payload.parameters.efficiencyJPerTh,
                        rate: payload.parameters.electricityUsdPerKwh,
                        multiplier: payload.parameters.comprehensiveMultiplier,
                        reward: payload.parameters.blockReward,
                      })
                    : t("mining.info.fallback")
                }
                source="mempool.space + blockchain.info"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{range}</span>
          </div>
        </CardHeader>
        <CardContent className="px-3 pt-1">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : loading && !latest ? (
            <p className="text-xs text-muted-foreground">{t("mining.loading")}</p>
          ) : !latest ? (
            <p className="text-xs text-muted-foreground">{t("chart.noData")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiningMetric label={t("mining.kpi.electricityCost")} value={formatUsd(latestElectricityCost ?? 0)} />
              <MiningMetric label={t("mining.kpi.comprehensiveCost")} value={formatUsd(latestComprehensiveCost ?? 0)} />
              <MiningMetric
                label={t("mining.kpi.margin")}
                value={latestElectricityMargin !== null ? `${latestElectricityMargin >= 0 ? "+" : ""}${latestElectricityMargin.toFixed(0)}%` : "—"}
              />
              <MiningMetric
                label={t("mining.kpi.comprehensiveMargin")}
                value={latestComprehensiveMargin !== null ? `${latestComprehensiveMargin >= 0 ? "+" : ""}${latestComprehensiveMargin.toFixed(0)}%` : "—"}
              />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

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
                      multiplier: payload.parameters.comprehensiveMultiplier,
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
              {latestElectricityCost !== null && (
                <span>
                  {t("mining.kpi.electricityCost")} {formatUsd(latestElectricityCost)}
                </span>
              )}
              {latestComprehensiveCost !== null && (
                <span>
                  {t("mining.kpi.comprehensiveCost")} {formatUsd(latestComprehensiveCost)}
                </span>
              )}
              {latestPrice !== null && (
                <span>
                  {t("mining.kpi.price")} {formatUsd(latestPrice)}
                </span>
              )}
              {latestComprehensiveMargin !== null && (
                <span
                  className={cn(
                    "rounded border px-1.5 py-0 text-[9px]",
                    latestComprehensiveMargin >= 0
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
                  )}
                >
                  {t("mining.kpi.comprehensiveMargin")} {latestComprehensiveMargin >= 0 ? "+" : ""}
                  {latestComprehensiveMargin.toFixed(0)}%
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
                    if (name === "electricityCost") return [formatUsd(value), t("mining.kpi.electricityCost")]
                    if (name === "comprehensiveCost") return [formatUsd(value), t("mining.kpi.comprehensiveCost")]
                    if (name === "price") return [formatUsd(value), t("mining.kpi.price")]
                    return [value, name]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => {
                    if (value === "electricityCost") return t("mining.kpi.electricityCost")
                    if (value === "comprehensiveCost") return t("mining.kpi.comprehensiveCost")
                    if (value === "price") return t("mining.kpi.price")
                    return value
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="electricityCost"
                  stroke="rgb(245 158 11)"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="comprehensiveCost"
                  stroke="rgb(217 119 6)"
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
