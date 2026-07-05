"use client"

import { AlertTriangle, Flame, Sparkles } from "lucide-react"

import { ScoreIndexCard } from "@/components/score-index-card"
import { usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { EuphoriaActiveSignal, EuphoriaBand, EuphoriaWickEvent } from "@/lib/euphoria-detector"

const REFRESH_MS = 60 * 1000

interface FactorPayload {
  id: string
  labelZh: string
  labelEn: string
  score: number
  weight: number
  weighted: number
  lines: string[]
}

interface Payload {
  ccy: string
  updatedAt: number
  summary: {
    euphoriaScore: number
    band: EuphoriaBand
    signalZh: string
    signalEn: string
    direction: "short_or_take_profit" | "watch"
  }
  factors: FactorPayload[]
  activeSignals: EuphoriaActiveSignal[]
  recentWicks: EuphoriaWickEvent[]
  upstream: Record<string, string>
  weights: Record<string, string>
  error?: string
}

async function fetchPayload(url: string): Promise<Payload> {
  const res = await fetch(url)
  const json = (await res.json()) as Payload
  if (!res.ok || !json.summary) throw new Error(json.error ?? "Euphoria score unavailable")
  return json
}

function bandStyles(band: EuphoriaBand): string {
  switch (band) {
    case "short_setup":
      return "text-red-600 dark:text-red-400"
    case "take_profit":
      return "text-orange-600 dark:text-orange-400"
    case "building":
      return "text-amber-600 dark:text-amber-400"
    case "watch":
      return "text-sky-600 dark:text-sky-400"
    default:
      return "text-muted-foreground"
  }
}

function signalIcon(severity: EuphoriaActiveSignal["severity"]) {
  switch (severity) {
    case "alert":
      return <Flame className="h-3 w-3" />
    case "warn":
      return <AlertTriangle className="h-3 w-3" />
    default:
      return <Sparkles className="h-3 w-3" />
  }
}

function HoverContents({
  payload,
  loading,
  error,
}: {
  payload: Payload | null
  loading: boolean
  error: string | null
}) {
  const { locale } = useI18n()

  if (loading) return <p className="px-3 py-3 text-[11px] text-muted-foreground">Loading euphoria score...</p>
  if (error) return <p className="px-3 py-3 text-[11px] text-destructive">{error}</p>
  if (!payload) return null

  return (
    <div className="space-y-3 px-3 py-2.5 text-left">
      <p className="text-[10px] text-muted-foreground">
        {new Date(payload.updatedAt).toLocaleTimeString()} · Free-source top-risk model · not investment advice.
      </p>

      {payload.activeSignals.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground">Active overheat factors</p>
          <ul className="mt-1 space-y-1">
            {payload.activeSignals.map((signal) => (
              <li
                key={signal.code}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10.5px] leading-snug"
              >
                {signalIcon(signal.severity)}
                <span className="font-medium">{locale === "zh" ? signal.labelZh : signal.labelEn}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Factor weights</p>
        {payload.factors.map((factor) => (
          <div key={factor.id} className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground">
                {locale === "zh" ? factor.labelZh : factor.labelEn}
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {factor.score.toFixed(1)} · {Math.round(factor.weight * 100)}%
              </p>
            </div>
            <ul className="mt-1 space-y-0.5">
              {factor.lines.map((line, index) => (
                <li key={index} className="text-[10.5px] leading-relaxed text-muted-foreground">
                  · {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {payload.recentWicks.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Recent upper-wick events</p>
          <ul className="space-y-1">
            {payload.recentWicks.slice(0, 5).map((wick) => (
              <li
                key={wick.time}
                className="flex items-center justify-between gap-2 rounded-md border border-border/55 bg-muted/15 px-2 py-1 text-[10.5px]"
              >
                <span className="font-medium tabular-nums">{new Date(wick.time).toISOString().slice(0, 10)}</span>
                <span className="text-muted-foreground">
                  wick {(wick.upperWickRatio * 100).toFixed(0)}% · volZ {wick.volumeZ.toFixed(1)}
                </span>
                <span className={cn("tabular-nums", wick.forward24hPct !== null && wick.forward24hPct < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {wick.forward24hPct === null ? "-" : `${wick.forward24hPct >= 0 ? "+" : ""}${wick.forward24hPct.toFixed(2)}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="rounded-md border border-border/55 bg-muted/20 px-2 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
        {Object.values(payload.upstream).join(" · ")}
      </p>
    </div>
  )
}

export function EuphoriaOpportunityCard({
  className,
  instId = "BTC-USDT-SWAP",
}: {
  className?: string
  instId?: string
}) {
  const { locale } = useI18n()
  const ccy = instId.split("-")[0] ?? "BTC"
  const swr = usePersistentSWR<Payload>(
    `crypto:euphoria:${ccy}`,
    `/api/crypto/euphoria?ccy=${encodeURIComponent(ccy)}`,
    fetchPayload,
    { refreshInterval: REFRESH_MS },
  )
  const payload = swr.data ?? null
  const score = payload?.summary.euphoriaScore
  const signal = payload ? (locale === "zh" ? payload.summary.signalZh : payload.summary.signalEn) : "Loading..."

  return (
    <ScoreIndexCard
      label={`${ccy} Euphoria Risk`}
      value={score === undefined ? "-" : Math.round(score)}
      valueSuffix="/100"
      signal={swr.error ? "Overheat score unavailable" : signal}
      toneClassName={payload ? bandStyles(payload.summary.band) : "text-muted-foreground"}
      valueAriaLabel={`${ccy} euphoria risk score`}
      infoAriaLabel="Explain euphoria risk score"
      infoContent={<HoverContents payload={payload} loading={swr.isLoading} error={swr.error ? String(swr.error.message ?? swr.error) : null} />}
      className={className}
    />
  )
}
