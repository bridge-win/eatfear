"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { OptionsOiPayload } from "@/lib/api-routes/crypto/options-oi/route"

const REFRESH_MS = 5 * 60 * 1000

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(1)
}

function formatStrike(value: number): string {
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`
  return value.toFixed(0)
}

function formatExpiry(expiry: string): string {
  if (!expiry) return "—"
  const match = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(expiry)
  if (!match) return expiry
  return `${match[1]} ${match[2]} 20${match[3]}`
}

export interface OptionsMaxPainCardProps {
  currency: "BTC" | "ETH"
  className?: string
}

export function OptionsMaxPainCard({ currency, className }: OptionsMaxPainCardProps) {
  const t = useT()
  const swr = usePersistentSWR<OptionsOiPayload>(
    `crypto:options-oi:${currency}`,
    `/api/crypto/options-oi?currency=${currency}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const payload = swr.data ?? null
  const loading = swr.isLoading && !payload
  const error = !payload ? swr.error?.message ?? null : payload.error ?? null

  const chartData = useMemo(() => {
    if (!payload) return []
    return payload.strikes.map((row) => ({
      strike: row.strike,
      call: row.callOi,
      put: -row.putOi,
      callOi: row.callOi,
      putOi: row.putOi,
    }))
  }, [payload])

  const hasData = !!payload && chartData.length > 0 && !payload.error

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm">{t("optionsOi.title", { ccy: currency })}</CardTitle>
            <InfoTooltip
              title={t("optionsOi.title", { ccy: currency })}
              description={t("optionsOi.info", { ccy: currency })}
              source="Deribit get_book_summary_by_currency"
            />
          </div>
          {payload && hasData && (
            <span className="text-[10px] text-muted-foreground">
              {t("optionsOi.expiry")} {formatExpiry(payload.expiry)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("optionsOi.loading")}</p>
        ) : error || !hasData ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("optionsOi.unavailable")}</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded border border-red-500/20 bg-red-500/5 px-1.5 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("optionsOi.putWall")}</p>
                <p className="text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {payload!.putWall !== null ? formatStrike(payload!.putWall) : "—"}
                </p>
              </div>
              <div className="rounded border border-amber-500/20 bg-amber-500/5 px-1.5 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("optionsOi.maxPain")}</p>
                <p className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {payload!.maxPain !== null ? formatStrike(payload!.maxPain) : "—"}
                </p>
              </div>
              <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("optionsOi.callWall")}</p>
                <p className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {payload!.callWall !== null ? formatStrike(payload!.callWall) : "—"}
                </p>
              </div>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="strike"
                    tickFormatter={(v: number) => formatStrike(v)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={9}
                    minTickGap={28}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCompact(Math.abs(v))}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    fontSize={9}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted-foreground))", fillOpacity: 0.08 }}
                    formatter={(value: number, name) => {
                      if (name === "call") return [formatCompact(value), t("optionsOi.tooltip.call")]
                      if (name === "put") return [formatCompact(Math.abs(value)), t("optionsOi.tooltip.put")]
                      return [value, name]
                    }}
                    labelFormatter={(label: number) => formatStrike(label)}
                  />
                  {payload!.underlyingPrice > 0 && (
                    <ReferenceLine
                      x={payload!.underlyingPrice}
                      stroke="rgb(99 102 241)"
                      strokeDasharray="3 3"
                      label={{ value: t("optionsOi.spot"), position: "top", fontSize: 9, fill: "rgb(99 102 241)" }}
                    />
                  )}
                  <Bar dataKey="call" fill="rgb(16 185 129)" isAnimationActive={false} />
                  <Bar dataKey="put" fill="rgb(239 68 68)" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
