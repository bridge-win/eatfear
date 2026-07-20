"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { useI18n, useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import { cn } from "@/lib/utils"

interface SpreadPoint {
  time: number
  topLongPct: number
  allLongPct: number
  spread: number
  price: number | null
}

interface TimeValue {
  time: number
  value: number
}

type FactorState = "bull" | "bear" | "neutral" | "na"
type FactorKey = "spread" | "flow" | "crowding" | "loan" | "options"

interface Factor {
  score: number | null
  state: FactorState
  value: number | null
  detail: Record<string, number | null>
}

interface IntelligenceResponse {
  ccy: string
  range: string
  note: string | null
  composite: {
    score: number | null
    verdict: "strongBull" | "bull" | "neutral" | "bear" | "strongBear" | "unknown"
    coverage: number
  }
  factors: Record<FactorKey, Factor>
  series: {
    spread: SpreadPoint[]
    loanRatio: TimeValue[]
    putCallOi: TimeValue[]
    funding: TimeValue[]
  }
  updatedAt: number
}

const REFRESH_MS = 5 * 60 * 1000

const FACTOR_ORDER: FactorKey[] = ["spread", "flow", "crowding", "loan", "options"]

const FACTOR_WEIGHT_LABEL: Record<FactorKey, string> = {
  spread: "30%",
  flow: "25%",
  crowding: "20%",
  loan: "15%",
  options: "10%",
}

const stateTone = (state: FactorState) =>
  state === "bull"
    ? "text-green-600 dark:text-green-400"
    : state === "bear"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground"

const verdictTone = (verdict: IntelligenceResponse["composite"]["verdict"]) =>
  verdict === "strongBull" || verdict === "bull"
    ? "text-green-600 dark:text-green-400"
    : verdict === "strongBear" || verdict === "bear"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground"

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="rounded border px-1 py-0 text-[9px] text-muted-foreground">—</span>
  }
  const tone =
    score > 0
      ? "border-green-600/40 text-green-600 dark:text-green-400"
      : score < 0
        ? "border-red-600/40 text-red-600 dark:text-red-400"
        : "border-muted-foreground/30 text-muted-foreground"
  return (
    <span className={cn("rounded border px-1 py-0 text-[9px] font-semibold tabular-nums", tone)}>
      {score > 0 ? `+${score}` : score}
    </span>
  )
}

function CompositeMeter({ score }: { score: number }) {
  // score -100..100 → 0..100% position on the meter
  const position = Math.max(0, Math.min(100, (score + 100) / 2))
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500/60 via-muted to-green-500/60">
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-foreground"
        style={{ left: `${position}%` }}
      />
    </div>
  )
}

export function SmartMoneyIntelligence({
  ccy,
  range,
  className,
}: {
  ccy: string
  range: TimeRangeId
  className?: string
}) {
  const t = useT()
  const { locale } = useI18n()
  const swr = usePersistentSWR<IntelligenceResponse>(
    `crypto:smart-intel:${ccy}:${range}`,
    `/api/crypto/smart-money/intelligence?ccy=${encodeURIComponent(ccy)}&range=${range}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const payload = swr.data ?? null
  const loading = swr.isLoading && !payload
  const error = payload ? null : swr.error?.message ?? null

  const formatTime = useMemo(() => {
    const dateLocale = locale === "zh" ? "zh-CN" : "en-US"
    return (time: number) =>
      new Date(time).toLocaleDateString(dateLocale, { month: "short", day: "2-digit" }) +
      " " +
      new Date(time).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })
  }, [locale])

  const spreadData = payload?.series.spread ?? []

  const ratioData = useMemo(() => {
    if (!payload) return []
    const byTime = new Map<number, { time: number; loan?: number; putCall?: number }>()
    for (const point of payload.series.loanRatio) {
      byTime.set(point.time, { ...(byTime.get(point.time) ?? { time: point.time }), loan: point.value })
    }
    for (const point of payload.series.putCallOi) {
      byTime.set(point.time, { ...(byTime.get(point.time) ?? { time: point.time }), putCall: point.value })
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
  }, [payload])

  const factorValue = (key: FactorKey, factor: Factor): string => {
    if (factor.value === null) return "—"
    switch (key) {
      case "spread":
        return `${factor.value > 0 ? "+" : ""}${factor.value.toFixed(1)} pp`
      case "flow":
        return `${factor.value > 0 ? "+" : ""}${factor.value.toFixed(1)}%`
      case "crowding":
        return `${factor.value > 0 ? "+" : ""}${factor.value.toFixed(4)}%/8h`
      case "loan":
        return factor.value.toFixed(2)
      case "options":
        return factor.value.toFixed(2)
    }
  }

  const factorHint = (key: FactorKey, factor: Factor): string => {
    if (factor.state === "na") return t("smartPage.intel.na")
    return t(`smartPage.intel.factor.${key}.${factor.state}`)
  }

  const composite = payload?.composite

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("smartPage.intel.title", { ccy })}</CardTitle>
            <InfoTooltip
              title={t("smartPage.intel.title", { ccy })}
              description={t("smartPage.intel.info")}
              source="OKX Rubik contracts · margin · options · funding"
            />
          </div>
          {payload?.note === "okx-contract-retention" && (
            <span className="rounded border px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {t("smartPage.intel.clampNote")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {error ? (
          <p className="py-8 text-center text-xs text-destructive">{error}</p>
        ) : loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
        ) : !payload || !composite ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("chart.noData")}</p>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-md border bg-background/70 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("smartPage.intel.composite")}
                  </p>
                  <p className={cn("mt-0.5 text-lg font-bold tabular-nums", verdictTone(composite.verdict))}>
                    {composite.score !== null ? (composite.score > 0 ? `+${composite.score}` : composite.score) : "—"}
                    <span className="ml-2 text-sm font-semibold">
                      {t(`smartPage.intel.verdict.${composite.verdict}`)}
                    </span>
                  </p>
                </div>
                <p className="max-w-md text-[10px] leading-relaxed text-muted-foreground">
                  {t("smartPage.intel.compositeHint", { coverage: Math.round(composite.coverage * 100) })}
                </p>
              </div>
              {composite.score !== null && (
                <div className="mt-2">
                  <CompositeMeter score={composite.score} />
                  <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
                    <span>{t("smartPage.intel.meter.bear")}</span>
                    <span>{t("smartPage.intel.meter.neutral")}</span>
                    <span>{t("smartPage.intel.meter.bull")}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {FACTOR_ORDER.map((key) => {
                const factor = payload.factors[key]
                return (
                  <div key={key} className="rounded-md border bg-background/70 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t(`smartPage.intel.factor.${key}.label`)}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground">{FACTOR_WEIGHT_LABEL[key]}</span>
                        <ScoreChip score={factor.score} />
                      </div>
                    </div>
                    <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums", stateTone(factor.state))}>
                      {factorValue(key, factor)}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{factorHint(key, factor)}</p>
                  </div>
                )
              })}
            </div>

            {spreadData.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("smartPage.intel.spreadChart")}
                </p>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={spreadData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        minTickGap={48}
                        tickFormatter={(value: number) => formatTime(value)}
                      />
                      <YAxis
                        yAxisId="spread"
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        fontSize={10}
                        tickFormatter={(value: number) => `${value.toFixed(0)}pp`}
                      />
                      <YAxis
                        yAxisId="price"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        fontSize={10}
                        domain={["auto", "auto"]}
                        tickFormatter={(value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0))}
                      />
                      <Tooltip
                        cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                        labelFormatter={(value: number) => formatTime(value)}
                        formatter={(value: number, name: string) => {
                          if (name === "spread") return [`${value.toFixed(1)} pp`, t("smartPage.intel.series.spread")]
                          if (name === "price") return [value.toLocaleString(), t("smartPage.intel.series.price")]
                          return [value, name]
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10 }}
                        formatter={(value: string) =>
                          value === "spread"
                            ? t("smartPage.intel.series.spread")
                            : value === "price"
                              ? t("smartPage.intel.series.price")
                              : value
                        }
                      />
                      <ReferenceLine
                        yAxisId="spread"
                        y={0}
                        stroke="hsl(var(--muted-foreground))"
                        strokeOpacity={0.4}
                        strokeDasharray="4 4"
                      />
                      <Line
                        yAxisId="spread"
                        type="monotone"
                        dataKey="spread"
                        stroke="rgb(99 102 241)"
                        strokeWidth={1.8}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="price"
                        stroke="rgb(148 163 184)"
                        strokeWidth={1.2}
                        strokeDasharray="3 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {ratioData.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("smartPage.intel.ratioChart")}
                </p>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ratioData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        minTickGap={48}
                        tickFormatter={(value: number) => formatTime(value)}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        fontSize={10}
                        domain={["auto", "auto"]}
                        tickFormatter={(value: number) => value.toFixed(1)}
                      />
                      <Tooltip
                        cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                        labelFormatter={(value: number) => formatTime(value)}
                        formatter={(value: number, name: string) => {
                          if (name === "loan") return [value.toFixed(3), t("smartPage.intel.series.loan")]
                          if (name === "putCall") return [value.toFixed(3), t("smartPage.intel.series.putCall")]
                          return [value, name]
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10 }}
                        formatter={(value: string) =>
                          value === "loan"
                            ? t("smartPage.intel.series.loan")
                            : value === "putCall"
                              ? t("smartPage.intel.series.putCall")
                              : value
                        }
                      />
                      <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="loan"
                        stroke="rgb(234 88 12)"
                        strokeWidth={1.6}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="putCall"
                        stroke="rgb(14 165 233)"
                        strokeWidth={1.4}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
