"use client"

import { useEffect, useState } from "react"
import { Activity, ExternalLink, Radio, ShieldCheck } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import type { SmartMoneyConsensus, SmartMoneyEvent } from "@/lib/smart-money/types"
import { cn } from "@/lib/utils"

const VENUE_STYLE: Record<string, string> = {
  hyperliquid: "border-l-[#5CE1B9]",
  polymarket: "border-l-[#2563EB]",
  okx: "border-l-slate-700 dark:border-l-slate-300",
  binance: "border-l-[#F0B90B]",
}

function formatUsd(value: number | null): string {
  if (value === null) return "—"
  const absolute = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`
  return `${sign}$${absolute.toFixed(2)}`
}

function age(timestamp: number | null, now: number): string {
  if (timestamp === null) return "unknown"
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
}

function actionTone(action: SmartMoneyEvent["action"]): string {
  return action === "buy" || action === "long"
    ? "text-emerald-700 dark:text-emerald-400"
    : action === "sell" || action === "short"
      ? "text-rose-700 dark:text-rose-400"
      : "text-foreground"
}

export function SmartMoneyEvidenceTape({
  events,
  consensus,
  updatedAt,
  isRefreshing,
}: {
  events: SmartMoneyEvent[]
  consensus: SmartMoneyConsensus | null
  updatedAt: number | null
  isRefreshing: boolean
}) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const newest = events.slice(0, 8)
  const direction = consensus?.direction ?? "insufficient"

  return (
    <div className="space-y-2">
      <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/35 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t("smartPage.command.evidenceTape")}</p>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {isRefreshing ? t("smartPage.command.refreshing") : updatedAt ? `${t("smartPage.command.updated")} ${age(updatedAt, now)}` : t("smartPage.loading")}
              </span>
            </div>
            {newest.length === 0 ? (
              <div className="px-3 py-7 text-center text-xs text-muted-foreground">{t("smartPage.command.noEvidence")}</div>
            ) : (
              <div className="flex snap-x gap-2 overflow-x-auto p-2">
                {newest.map((event) => (
                  <a
                    key={event.id}
                    href={event.verificationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "group min-w-[240px] snap-start rounded-md border border-l-4 bg-background px-2.5 py-2 transition-colors hover:bg-muted/40 sm:min-w-[270px]",
                      VENUE_STYLE[event.venue] ?? "border-l-muted-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-wider text-muted-foreground">
                      <span>{event.venue}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        {event.provenance.verification === "settled" && <ShieldCheck className="h-3 w-3" />}
                        {age(event.provenance.eventAt, now)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5 text-xs">
                      <span className="max-w-[90px] truncate font-mono font-semibold">{event.actorName}</span>
                      <span className={cn("font-bold uppercase", actionTone(event.action))}>{event.action}</span>
                      <span className="font-semibold">{event.asset}</span>
                    </div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] text-muted-foreground">{event.market}</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{formatUsd(event.amountUsd)}</p>
                      </div>
                      <ExternalLink className="h-3.5 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-[270px] py-0">
          <CardContent className="grid h-full grid-cols-2 gap-px bg-border p-px">
            <div className="bg-background p-2.5">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground"><Activity className="h-3 w-3" />{t("smartPage.command.consensus")}</p>
              <p className={cn("mt-1 text-lg font-bold capitalize", direction === "buying" ? "text-emerald-600" : direction === "selling" ? "text-rose-600" : "text-foreground")}>{t(`smartPage.command.direction.${direction}`)}</p>
            </div>
            <div className="bg-background p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("smartPage.command.actors")}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{consensus?.actorCount ?? 0}</p>
              <p className="text-[9px] text-muted-foreground">{consensus?.buyers ?? 0} B / {consensus?.sellers ?? 0} S</p>
            </div>
            <div className="bg-background p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("smartPage.command.capital")}</p>
              <p className="mt-1 text-sm font-bold tabular-nums">{formatUsd((consensus?.buyUsd ?? 0) - (consensus?.sellUsd ?? 0))}</p>
            </div>
            <div className="bg-background p-2.5">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground"><Radio className="h-3 w-3" />{t("smartPage.command.coverage")}</p>
              <p className="mt-1 text-sm font-bold tabular-nums">{consensus?.coverage ?? 0}% · {consensus?.venueCount ?? 0}v</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <p className="px-0.5 text-[10px] leading-relaxed text-muted-foreground">{t("smartPage.command.evidenceNote")}</p>
    </div>
  )
}
