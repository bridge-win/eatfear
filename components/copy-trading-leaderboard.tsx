"use client"

import { Fragment, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronDown, ChevronUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { jsonFetcher, usePersistentSWR, usePersistentState } from "@/lib/client-persistence"
import { useI18n, useT } from "@/lib/i18n"
import { type TimeRangeId } from "@/lib/time-range"
import { cn } from "@/lib/utils"

const SORTS = ["overview", "pnl", "pnl_ratio", "win_ratio", "aum"] as const
type SortId = (typeof SORTS)[number]

const isSortId = (value: string): value is SortId => (SORTS as readonly string[]).includes(value)

const SOURCES = ["okx", "binance"] as const
type SourceId = (typeof SOURCES)[number]

const isSourceId = (value: string): value is SourceId => (SOURCES as readonly string[]).includes(value)

interface LeaderTrader {
  uniqueCode: string
  source: SourceId
  nickName: string
  pnl: number | null
  pnlRatio: number | null
  winRatio: number | null
  aum: number | null
  leadDays: number | null
  copyTraderNum: number | null
  maxCopyTraderNum: number | null
  instruments: string[]
  pnlSparkline: { time: number; value: number }[]
  hasDetail: boolean
}

interface LeadersResponse {
  traders: LeaderTrader[]
  totalPage: number
  updatedAt: number
}

interface LeaderDetailResponse {
  windowDays: number
  stats: {
    winRatio: number | null
    profitDays: number | null
    lossDays: number | null
    copierPnl: number | null
    avgPositionNotional: number | null
  } | null
  pnlSeries: { time: number; pnl: number | null; pnlRatio: number | null }[]
  positions: {
    instId: string
    posSide: "long" | "short"
    leverage: number | null
    openAvgPx: number | null
    markPx: number | null
    margin: number | null
    uplRatio: number | null
    openTime: number | null
  }[]
}

const REFRESH_MS = 5 * 60 * 1000

const formatUsd = (value: number | null): string => {
  if (value === null) return "—"
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

const formatPct = (value: number | null, digits = 1): string =>
  value === null ? "—" : `${(value * 100).toFixed(digits)}%`

const pnlTone = (value: number | null) =>
  value === null
    ? "text-muted-foreground"
    : value > 0
      ? "text-green-600 dark:text-green-400"
      : value < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

function PnlSparkline({ points }: { points: { time: number; value: number }[] }) {
  if (points.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>
  const last = points[points.length - 1].value
  const color = last >= 0 ? "rgb(22 163 74)" : "rgb(220 38 38)"
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={1.2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function LeaderDetail({ uniqueCode, range }: { uniqueCode: string; range: TimeRangeId }) {
  const t = useT()
  const { locale } = useI18n()
  const swr = usePersistentSWR<LeaderDetailResponse>(
    `crypto:smart-leader-detail:${uniqueCode}:${range}`,
    `/api/crypto/smart-money/leader-detail?uniqueCode=${encodeURIComponent(uniqueCode)}&range=${range}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const detail = swr.data
  if (!detail) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        {swr.error ? swr.error.message : t("smartPage.leaders.detail.loading")}
      </p>
    )
  }

  const dateLocale = locale === "zh" ? "zh-CN" : "en-US"
  const windowDays = detail.windowDays
  const stats = detail.stats
  const curve = detail.pnlSeries
    .filter((row) => row.pnlRatio !== null)
    .map((row) => ({ time: row.time, value: (row.pnlRatio as number) * 100 }))

  return (
    <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
      {stats && (
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("smartPage.leaders.detail.stats", { days: windowDays })}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: t("smartPage.leaders.detail.winRatio"), value: formatPct(stats.winRatio) },
              { label: t("smartPage.leaders.detail.profitDays"), value: stats.profitDays?.toFixed(0) ?? "—" },
              { label: t("smartPage.leaders.detail.lossDays"), value: stats.lossDays?.toFixed(0) ?? "—" },
              {
                label: t("smartPage.leaders.detail.copierPnl"),
                value: formatUsd(stats.copierPnl),
                tone: pnlTone(stats.copierPnl),
              },
              { label: t("smartPage.leaders.detail.avgNotional"), value: formatUsd(stats.avgPositionNotional) },
            ].map((tile) => (
              <div key={tile.label} className="rounded-md border bg-background/70 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{tile.label}</p>
                <p className={cn("mt-0.5 text-xs font-semibold tabular-nums", tile.tone)}>{tile.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {curve.length > 1 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("smartPage.leaders.detail.pnlCurve", { days: windowDays })}
          </p>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  minTickGap={48}
                  tickFormatter={(value: number) =>
                    new Date(value).toLocaleDateString(dateLocale, { month: "short", day: "2-digit" })
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  fontSize={10}
                  tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Tooltip
                  labelFormatter={(value: number) =>
                    new Date(value).toLocaleDateString(dateLocale, { month: "short", day: "2-digit" })
                  }
                  formatter={(value: number) => [`${value.toFixed(2)}%`, t("smartPage.leaders.col.pnlRatio")]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(99 102 241)"
                  fill="rgb(99 102 241)"
                  fillOpacity={0.15}
                  strokeWidth={1.4}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("smartPage.leaders.detail.positions")}
        </p>
        {detail.positions.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">{t("smartPage.leaders.detail.noPositions")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs tabular-nums">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-2 text-left font-medium">{t("smartPage.col.inst")}</th>
                  <th className="py-1.5 pr-2 text-left font-medium">{t("smartPage.col.side")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.lever")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.open")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.mark")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.margin")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.uplRatio")}</th>
                  <th className="py-1.5 text-right font-medium">{t("smartPage.col.openTime")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.positions.map((position, index) => (
                  <tr key={`${position.instId}-${index}`} className="border-b border-dashed last:border-0">
                    <td className="py-1.5 pr-2 font-medium">{position.instId}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          position.posSide === "long"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400",
                        )}
                      >
                        {t(position.posSide === "long" ? "smartPage.side.long" : "smartPage.side.short")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right">{position.leverage !== null ? `${position.leverage}x` : "—"}</td>
                    <td className="py-1.5 pr-2 text-right">{position.openAvgPx ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-right">{position.markPx ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-right">{formatUsd(position.margin)}</td>
                    <td className={cn("py-1.5 pr-2 text-right", pnlTone(position.uplRatio))}>
                      {formatPct(position.uplRatio, 2)}
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {position.openTime
                        ? new Date(position.openTime).toLocaleDateString(dateLocale, { month: "short", day: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function CopyTradingLeaderboard({ range, className }: { range: TimeRangeId; className?: string }) {
  const t = useT()
  const [source, setSource] = usePersistentState<SourceId>("crypto:smart-leader-source", "okx", isSourceId)
  const [sort, setSort] = usePersistentState<SortId>("crypto:smart-leader-sort", "pnl", isSortId)
  const [expanded, setExpanded] = useState<string | null>(null)
  const swr = usePersistentSWR<LeadersResponse>(
    `crypto:smart-leaders:${source}:${sort}`,
    `/api/crypto/smart-money/leaders?source=${source}&sort=${sort}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const payload = swr.data ?? null
  const loading = swr.isLoading && !payload
  const traders = payload?.traders ?? []

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("smartPage.leaders.title")}</CardTitle>
            <InfoTooltip
              title={t("smartPage.leaders.title")}
              description={t("smartPage.leaders.info")}
              source="OKX Copy Trading public API"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border bg-background/60 p-0.5">
              {SOURCES.map((sourceId) => (
                <button
                  key={sourceId}
                  type="button"
                  onClick={() => {
                    setSource(sourceId)
                    setExpanded(null)
                  }}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground",
                    source === sourceId && "bg-foreground text-background",
                  )}
                >
                  {t(`smartPage.leaders.source.${sourceId}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {SORTS.map((sortId) => (
                <button
                  key={sortId}
                  type="button"
                  onClick={() => setSort(sortId)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    sort === sortId && "bg-foreground text-background hover:bg-foreground hover:text-background",
                  )}
                >
                  {t(`smartPage.sort.${sortId}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
        ) : traders.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.leaders.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs tabular-nums">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-2 text-left font-medium">{t("smartPage.leaders.col.trader")}</th>
                  <th className="py-1.5 pr-2 text-left font-medium">{t("smartPage.leaders.col.curve")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.leaders.col.pnl")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.leaders.col.pnlRatio")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.leaders.col.winRatio")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.leaders.col.aum")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.leaders.col.leadDays")}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.leaders.col.copiers")}</th>
                  <th className="py-1.5 text-right font-medium" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {traders.map((trader) => {
                  const isOpen = expanded === trader.uniqueCode
                  const isFull =
                    trader.copyTraderNum !== null &&
                    trader.maxCopyTraderNum !== null &&
                    trader.maxCopyTraderNum > 0 &&
                    trader.copyTraderNum >= trader.maxCopyTraderNum
                  return (
                    <Fragment key={`${trader.source}:${trader.uniqueCode}`}>
                      <tr
                        onClick={() => trader.hasDetail && setExpanded(isOpen ? null : trader.uniqueCode)}
                        className={cn(
                          "border-b border-dashed transition-colors last:border-0",
                          trader.hasDetail && "cursor-pointer hover:bg-muted/40",
                        )}
                      >
                        <td className="py-2 pr-2">
                          <p className="font-medium">{trader.nickName}</p>
                          {trader.instruments.length > 0 && (
                            <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                              {trader.instruments.join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <PnlSparkline points={trader.pnlSparkline} />
                        </td>
                        <td className={cn("py-2 pr-2 text-right font-semibold", pnlTone(trader.pnl))}>
                          {formatUsd(trader.pnl)}
                        </td>
                        <td className={cn("py-2 pr-2 text-right", pnlTone(trader.pnlRatio))}>
                          {formatPct(trader.pnlRatio)}
                        </td>
                        <td className="py-2 pr-2 text-right">{formatPct(trader.winRatio)}</td>
                        <td className="py-2 pr-2 text-right">{formatUsd(trader.aum)}</td>
                        <td className="py-2 pr-2 text-right">{trader.leadDays?.toFixed(0) ?? "—"}</td>
                        <td className="py-2 pr-2 text-right">
                          {trader.copyTraderNum?.toFixed(0) ?? "—"}
                          {isFull && (
                            <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                              {t("smartPage.leaders.full")}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {trader.hasDetail ? (
                            isOpen ? (
                              <ChevronUp className="ml-auto h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="ml-auto h-3.5 w-3.5" />
                            )
                          ) : null}
                        </td>
                      </tr>
                      {isOpen && trader.hasDetail && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <LeaderDetail uniqueCode={trader.uniqueCode} range={range} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
