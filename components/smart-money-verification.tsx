"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CheckCircle2, Info, ShieldCheck, TriangleAlert, XCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { useI18n, useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type CheckStatus = "pass" | "warn" | "fail" | "info"

interface VerificationResponse {
  ccy: string
  funding: {
    current: number | null
    avg: number | null
    extreme: boolean
    history: { time: number; rate: number }[]
  }
  openInterest: {
    latest: number | null
    changePct: number | null
    history: { time: number; oi: number; vol: number }[]
  }
  crossVenue: {
    okxLongPct: number | null
    binanceLongPct: number | null
    spread: number | null
    consistent: boolean
  }
  checks: { id: string; status: CheckStatus }[]
  updatedAt: number
}

const REFRESH_MS = 5 * 60 * 1000

const STATUS_META: Record<CheckStatus, { icon: typeof CheckCircle2; tone: string; badge: string }> = {
  pass: {
    icon: CheckCircle2,
    tone: "text-green-600 dark:text-green-400",
    badge: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  warn: {
    icon: TriangleAlert,
    tone: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  fail: {
    icon: XCircle,
    tone: "text-red-600 dark:text-red-400",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  info: {
    icon: Info,
    tone: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
}

const formatOi = (value: number | null): string => {
  if (value === null) return "—"
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

const formatSignedPct = (value: number | null): string =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`

export function SmartMoneyVerification({ ccy, className }: { ccy: string; className?: string }) {
  const t = useT()
  const { locale } = useI18n()
  const swr = usePersistentSWR<VerificationResponse>(
    `crypto:smart-verify:${ccy}`,
    `/api/crypto/smart-money/verification?ccy=${encodeURIComponent(ccy)}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const payload = swr.data ?? null
  const loading = swr.isLoading && !payload

  const formatDate = useMemo(() => {
    const dateLocale = locale === "zh" ? "zh-CN" : "en-US"
    return (time: number) => new Date(time).toLocaleDateString(dateLocale, { month: "short", day: "2-digit" })
  }, [locale])

  const fundingData = useMemo(
    () => (payload?.funding.history ?? []).map((point) => ({ time: point.time, rate: point.rate * 100 })),
    [payload],
  )
  const oiData = useMemo(
    () => (payload?.openInterest.history ?? []).map((point) => ({ time: point.time, oi: point.oi })),
    [payload],
  )

  const checkValue = (id: string): Record<string, string | number> => {
    if (!payload) return {}
    if (id === "crossVenue") return { spread: payload.crossVenue.spread !== null ? payload.crossVenue.spread.toFixed(1) : "—" }
    if (id === "openInterest") return { value: formatSignedPct(payload.openInterest.changePct) }
    return {}
  }

  const fundingTone =
    payload?.funding.current == null
      ? "text-muted-foreground"
      : payload.funding.extreme
        ? "text-amber-600 dark:text-amber-400"
        : payload.funding.current >= 0
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"

  const oiTone =
    payload?.openInterest.changePct == null
      ? "text-muted-foreground"
      : payload.openInterest.changePct >= 0
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400"

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">{t("smartPage.verify.title", { ccy })}</CardTitle>
          <InfoTooltip
            title={t("smartPage.verify.title", { ccy })}
            description={t("smartPage.verify.info")}
            source="OKX funding / OI · OKX + Binance ratio"
          />
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-1">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
        ) : !payload ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("chart.noData")}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border bg-background/70 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("smartPage.verify.kpi.funding")}
                </p>
                <p className={cn("mt-1 text-sm font-semibold tabular-nums", fundingTone)}>
                  {payload.funding.current !== null ? `${(payload.funding.current * 100).toFixed(4)}%` : "—"}
                </p>
                {payload.funding.avg !== null && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t("smartPage.verify.kpi.fundingAvg", { value: `${(payload.funding.avg * 100).toFixed(4)}%` })}
                  </p>
                )}
              </div>
              <div className="rounded-md border bg-background/70 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("smartPage.verify.kpi.oi")}
                </p>
                <p className={cn("mt-1 text-sm font-semibold tabular-nums", oiTone)}>
                  {formatSignedPct(payload.openInterest.changePct)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{formatOi(payload.openInterest.latest)}</p>
              </div>
              <div className="rounded-md border bg-background/70 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("smartPage.verify.kpi.consistency")}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {payload.crossVenue.spread !== null ? `${payload.crossVenue.spread.toFixed(1)} pp` : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                  {payload.crossVenue.okxLongPct !== null ? `OKX ${payload.crossVenue.okxLongPct.toFixed(0)}%` : "OKX —"}
                  {" · "}
                  {payload.crossVenue.binanceLongPct !== null
                    ? `BN ${payload.crossVenue.binanceLongPct.toFixed(0)}%`
                    : "BN —"}
                </p>
              </div>
            </div>

            <ol className="space-y-1.5">
              {payload.checks.map((check) => {
                const meta = STATUS_META[check.status]
                const Icon = meta.icon
                return (
                  <li key={check.id} className="flex gap-2 rounded-md border bg-background/40 px-2.5 py-2">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold">{t(`smartPage.verify.check.${check.id}.title`)}</p>
                        <span className={cn("rounded px-1 py-0.5 text-[9px] font-semibold", meta.badge)}>
                          {t(`smartPage.verify.status.${check.status}`)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {t(`smartPage.verify.check.${check.id}.${check.status}`, checkValue(check.id))}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="grid gap-3 md:grid-cols-2">
              {fundingData.length > 1 && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("smartPage.verify.fundingChart")}
                  </p>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={fundingData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                        <XAxis
                          dataKey="time"
                          tickLine={false}
                          axisLine={false}
                          fontSize={10}
                          minTickGap={40}
                          tickFormatter={(value: number) => formatDate(value)}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={46}
                          fontSize={10}
                          tickFormatter={(value: number) => `${value.toFixed(3)}%`}
                        />
                        <Tooltip
                          labelFormatter={(value: number) => formatDate(value)}
                          formatter={(value: number) => [`${value.toFixed(4)}%`, t("smartPage.verify.kpi.funding")]}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          stroke="rgb(234 88 12)"
                          fill="rgb(234 88 12)"
                          fillOpacity={0.14}
                          strokeWidth={1.4}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {oiData.length > 1 && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("smartPage.verify.oiChart")}
                  </p>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={oiData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                        <XAxis
                          dataKey="time"
                          tickLine={false}
                          axisLine={false}
                          fontSize={10}
                          minTickGap={40}
                          tickFormatter={(value: number) => formatDate(value)}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={46}
                          fontSize={10}
                          tickFormatter={(value: number) => formatOi(value)}
                        />
                        <Tooltip
                          labelFormatter={(value: number) => formatDate(value)}
                          formatter={(value: number) => [formatOi(value), t("smartPage.verify.kpi.oi")]}
                        />
                        <Area
                          type="monotone"
                          dataKey="oi"
                          stroke="rgb(99 102 241)"
                          fill="rgb(99 102 241)"
                          fillOpacity={0.14}
                          strokeWidth={1.4}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
