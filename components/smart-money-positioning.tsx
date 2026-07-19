"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

interface RatioPoint {
  time: number
  ratio: number
  longPct: number
}

interface TakerPoint {
  time: number
  ratio: number
  buyVol: number
  sellVol: number
}

interface PositioningResponse {
  ccy: string
  range: string
  period: string
  note: string | null
  series: {
    topPosition: RatioPoint[]
    topAccount: RatioPoint[]
    globalAccount: RatioPoint[]
    takerRatio: TakerPoint[]
    okxAccount: RatioPoint[]
  }
  divergence: {
    topPositionLongPct: number | null
    globalLongPct: number | null
    spread: number | null
    takerRatio: number | null
    bias: "smartLong" | "smartShort" | "aligned" | "unknown"
  }
  updatedAt: number
}

const REFRESH_MS = 5 * 60 * 1000

const SERIES_STYLES = [
  { key: "topPosition", labelKey: "smartPage.pos.series.topPosition", color: "rgb(99 102 241)", width: 1.8 },
  { key: "topAccount", labelKey: "smartPage.pos.series.topAccount", color: "rgb(14 165 233)", width: 1.2 },
  { key: "globalAccount", labelKey: "smartPage.pos.series.globalAccount", color: "rgb(234 88 12)", width: 1.8 },
  { key: "okxAccount", labelKey: "smartPage.pos.series.okxAccount", color: "rgb(148 163 184)", width: 1.2 },
] as const

function KpiTile({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-background/70 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums", tone)}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SmartMoneyPositioning({ ccy, range, className }: { ccy: string; range: TimeRangeId; className?: string }) {
  const t = useT()
  const { locale } = useI18n()
  const swr = usePersistentSWR<PositioningResponse>(
    `crypto:smart-positioning:${ccy}:${range}`,
    `/api/crypto/smart-money/positioning?ccy=${encodeURIComponent(ccy)}&range=${range}`,
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

  const longPctData = useMemo(() => {
    if (!payload) return []
    const byTime = new Map<number, Record<string, number>>()
    for (const { key } of SERIES_STYLES) {
      for (const point of payload.series[key]) {
        const row = byTime.get(point.time) ?? { time: point.time }
        row[key] = point.longPct
        byTime.set(point.time, row)
      }
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time)
  }, [payload])

  const takerData = useMemo(
    () => (payload?.series.takerRatio ?? []).map((point) => ({ time: point.time, ratio: point.ratio })),
    [payload],
  )

  const divergence = payload?.divergence
  const spreadTone =
    divergence?.spread == null
      ? "text-muted-foreground"
      : divergence.spread > 5
        ? "text-green-600 dark:text-green-400"
        : divergence.spread < -5
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground"

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("smartPage.pos.title", { ccy })}</CardTitle>
            <InfoTooltip
              title={t("smartPage.pos.title", { ccy })}
              description={t("smartPage.pos.info")}
              source="Binance futures/data · OKX Rubik"
            />
          </div>
          {payload?.note === "binance-30d-retention" && (
            <span className="rounded border px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {t("smartPage.pos.clampNote")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {error ? (
          <p className="py-8 text-center text-xs text-destructive">{error}</p>
        ) : loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
        ) : !payload || longPctData.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("chart.noData")}</p>
        ) : (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <KpiTile
                label={t("smartPage.pos.kpi.topLong")}
                value={divergence?.topPositionLongPct != null ? `${divergence.topPositionLongPct.toFixed(1)}%` : "—"}
              />
              <KpiTile
                label={t("smartPage.pos.kpi.globalLong")}
                value={divergence?.globalLongPct != null ? `${divergence.globalLongPct.toFixed(1)}%` : "—"}
              />
              <KpiTile
                label={t("smartPage.pos.kpi.spread")}
                value={
                  divergence?.spread != null
                    ? `${divergence.spread > 0 ? "+" : ""}${divergence.spread.toFixed(1)} pp`
                    : "—"
                }
                tone={spreadTone}
                hint={t(`smartPage.pos.bias.${divergence?.bias ?? "unknown"}`)}
              />
              <KpiTile
                label={t("smartPage.pos.kpi.taker")}
                value={divergence?.takerRatio != null ? divergence.takerRatio.toFixed(2) : "—"}
                tone={
                  divergence?.takerRatio == null
                    ? undefined
                    : divergence.takerRatio > 1
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                }
              />
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={longPctData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
                    tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                    labelFormatter={(value: number) => formatTime(value)}
                    formatter={(value: number, name: string) => {
                      const style = SERIES_STYLES.find((entry) => entry.key === name)
                      return [`${value.toFixed(1)}%`, style ? t(style.labelKey) : name]
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10 }}
                    formatter={(value: string) => {
                      const style = SERIES_STYLES.find((entry) => entry.key === value)
                      return style ? t(style.labelKey) : value
                    }}
                  />
                  <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="4 4" />
                  {SERIES_STYLES.map((style) => (
                    <Line
                      key={style.key}
                      type="monotone"
                      dataKey={style.key}
                      stroke={style.color}
                      strokeWidth={style.width}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {takerData.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("smartPage.pos.takerChart")}
                </p>
                <div className="h-28 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={takerData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                        tickFormatter={(value: number) => value.toFixed(2)}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
                        labelFormatter={(value: number) => formatTime(value)}
                        formatter={(value: number) => [value.toFixed(3), t("smartPage.pos.kpi.taker")]}
                      />
                      <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="4 4" />
                      <Bar dataKey="ratio" fill="rgb(99 102 241)" fillOpacity={0.55} isAnimationActive={false} />
                    </BarChart>
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
