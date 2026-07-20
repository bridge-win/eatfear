"use client"

import { useMemo, useState } from "react"
import { ExternalLink, FilterX, ShieldCheck, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import type { DataFreshness, SmartMoneyEvent, SmartMoneySourceHealth } from "@/lib/smart-money/types"
import { cn } from "@/lib/utils"

function formatUsd(value: number | null): string {
  if (value === null) return "—"
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

function eventAge(timestamp: number | null): string {
  if (timestamp === null) return "—"
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}

const controlClass = "h-8 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function SmartMoneyLiveFeed({
  events,
  sources,
  isLoading,
}: {
  events: SmartMoneyEvent[]
  sources: SmartMoneySourceHealth[]
  isLoading: boolean
}) {
  const t = useT()
  const [venue, setVenue] = useState("all")
  const [action, setAction] = useState("all")
  const [asset, setAsset] = useState("")
  const [minimum, setMinimum] = useState("0")
  const [verification, setVerification] = useState("all")
  const [freshness, setFreshness] = useState<"all" | DataFreshness>("all")
  const filtered = useMemo(() => {
    const minimumUsd = Number(minimum)
    const normalizedAsset = asset.trim().toUpperCase()
    return events.filter((event) => {
      if (venue !== "all" && event.venue !== venue) return false
      if (action !== "all" && event.action !== action) return false
      if (normalizedAsset && !event.asset.toUpperCase().includes(normalizedAsset) && !event.market.toUpperCase().includes(normalizedAsset)) return false
      if (Number.isFinite(minimumUsd) && (event.amountUsd ?? 0) < minimumUsd) return false
      if (verification !== "all" && event.provenance.verification !== verification) return false
      if (freshness !== "all" && event.provenance.freshness !== freshness) return false
      return true
    })
  }, [action, asset, events, freshness, minimum, venue, verification])
  const degraded = sources.filter((source) => source.status !== "operational")

  const reset = () => {
    setVenue("all")
    setAction("all")
    setAsset("")
    setMinimum("0")
    setVerification("all")
    setFreshness("all")
  }

  return (
    <Card className="py-0">
      <CardHeader className="border-b px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{t("smartPage.command.feedTitle")}</CardTitle>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{t("smartPage.command.feedSubtitle")}</p>
          </div>
          <span className="rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">15s {t("smartPage.command.polling")}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <select aria-label={t("smartPage.command.filterVenue")} className={controlClass} value={venue} onChange={(event) => setVenue(event.target.value)}>
            <option value="all">{t("smartPage.command.allVenues")}</option>
            <option value="hyperliquid">Hyperliquid</option>
            <option value="polymarket">Polymarket</option>
          </select>
          <select aria-label={t("smartPage.command.filterAction")} className={controlClass} value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="all">{t("smartPage.command.allActions")}</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <Input aria-label={t("smartPage.command.filterAsset")} value={asset} onChange={(event) => setAsset(event.target.value)} placeholder={t("smartPage.command.assetPlaceholder")} className="h-8 w-28 text-xs" />
          <Input aria-label={t("smartPage.command.minimumUsd")} inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="Min USD" className="h-8 w-24 text-xs" />
          <select aria-label={t("smartPage.command.filterVerification")} className={controlClass} value={verification} onChange={(event) => setVerification(event.target.value)}>
            <option value="all">{t("smartPage.command.allEvidence")}</option>
            <option value="settled">Settled</option>
            <option value="reported">Reported</option>
            <option value="attributed">Attributed</option>
          </select>
          <select aria-label={t("smartPage.command.filterFreshness")} className={controlClass} value={freshness} onChange={(event) => setFreshness(event.target.value as "all" | DataFreshness)}>
            <option value="all">{t("smartPage.command.allFreshness")}</option>
            <option value="live">Live</option>
            <option value="fresh">Fresh</option>
            <option value="delayed">Delayed</option>
            <option value="stale">Stale</option>
          </select>
          <Button variant="ghost" size="sm" onClick={reset} className="h-8 gap-1 px-2 text-xs"><FilterX className="h-3.5 w-3.5" />{t("smartPage.command.clear")}</Button>
        </div>
        {degraded.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
            <span>{degraded.map((source) => `${source.name}: ${source.message}`).join(" · ")}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">{t("smartPage.command.noMatchingEvents")}</p>
        ) : (
          <div className="divide-y">
            {filtered.map((event) => (
              <div key={event.id} className="grid gap-2 px-3 py-2.5 hover:bg-muted/25 sm:grid-cols-[minmax(150px,1.1fr)_90px_minmax(150px,1fr)_110px_120px] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-xs font-semibold">{event.actorName}</span>
                    <span className={cn("rounded px-1 py-0.5 text-[8px] font-semibold uppercase", event.qualification === "ranked" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>{event.qualification === "ranked" ? t("smartPage.command.ranked") : t("smartPage.command.observed")}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{event.venue} · {event.address ?? "—"}</p>
                </div>
                <div>
                  <p className={cn("text-xs font-bold uppercase", event.action === "buy" || event.action === "long" ? "text-emerald-600" : "text-rose-600")}>{event.action}</p>
                  <p className="text-[10px] text-muted-foreground">{event.asset}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{event.market}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{event.priceUsd === null ? "—" : `@ ${event.priceUsd.toLocaleString()}`}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-bold tabular-nums">{formatUsd(event.amountUsd)}</p>
                  <p className="text-[10px] text-muted-foreground">{event.provenance.confidence.toFixed(2)} conf.</p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <div className="text-right">
                    <p className="inline-flex items-center gap-1 text-[10px] font-medium"><ShieldCheck className="h-3 w-3" />{event.provenance.verification}</p>
                    <p className="text-[9px] text-muted-foreground">{eventAge(event.provenance.eventAt)} · {event.provenance.freshness}</p>
                  </div>
                  <a href={event.verificationUrl} target="_blank" rel="noreferrer" aria-label={t("smartPage.command.verifyEvidence")} className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
