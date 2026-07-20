"use client"

import { ExternalLink, RadioTower, Scale, ShieldAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import type { SmartMoneySourceHealth as SourceHealth } from "@/lib/smart-money/types"
import { cn } from "@/lib/utils"

const WEIGHTS = [
  ["PnL", 25],
  ["ROI", 20],
  ["Win rate", 15],
  ["Drawdown", 15],
  ["Active days", 10],
  ["Capital", 10],
  ["Completeness", 5],
] as const

function statusStyle(status: SourceHealth["status"]): string {
  if (status === "operational") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  if (status === "degraded") return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
  if (status === "unavailable") return "bg-rose-500/10 text-rose-700 dark:text-rose-400"
  return "bg-muted text-muted-foreground"
}

function relativeTime(timestamp: number | null): string {
  if (timestamp === null) return "—"
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1_000))
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`
}

export function SmartMoneySourceHealth({ sources, isLoading }: { sources: SourceHealth[]; isLoading: boolean }) {
  const t = useT()
  const firstParty = sources.filter((source) => ["okx", "binance", "hyperliquid", "polymarket"].includes(source.sourceId))
  const optional = sources.filter((source) => !["okx", "binance", "hyperliquid", "polymarket"].includes(source.sourceId))

  return (
    <div className="space-y-2">
      <Card className="py-0">
        <CardHeader className="border-b px-3 py-3">
          <CardTitle className="flex items-center gap-1.5 text-sm"><RadioTower className="h-4 w-4" />{t("smartPage.command.sourceHealth")}</CardTitle>
          <p className="text-[10px] text-muted-foreground">{t("smartPage.command.sourceHealthSubtitle")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
          ) : (
            <div className="divide-y">
              {firstParty.map((source) => (
                <div key={source.sourceId} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[150px_100px_90px_1fr_auto] sm:items-center">
                  <div><p className="text-xs font-semibold">{source.name}</p><p className="text-[9px] uppercase text-muted-foreground">First party</p></div>
                  <span className={cn("w-fit rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", statusStyle(source.status))}>{source.status}</span>
                  <div className="text-[10px] tabular-nums text-muted-foreground"><p>{source.latencyMs === null ? "—" : `${source.latencyMs} ms`}</p><p>{relativeTime(source.lastSuccessAt)}</p></div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">{source.message}</p>
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="w-fit rounded-md border p-1.5 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-2 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="py-0">
          <CardHeader className="border-b px-3 py-3">
            <CardTitle className="text-sm">{t("smartPage.command.enrichment")}</CardTitle>
            <p className="text-[10px] text-muted-foreground">{t("smartPage.command.enrichmentSubtitle")}</p>
          </CardHeader>
          <CardContent className="grid gap-2 p-3 sm:grid-cols-2">
            {optional.map((source) => (
              <a key={source.sourceId} href={source.sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border p-2.5 transition-colors hover:bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{source.name}</p>
                  <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase", statusStyle(source.status))}>{source.status.replace("_", " ")}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{source.message}</p>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b px-3 py-3">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Scale className="h-4 w-4" />{t("smartPage.command.methodology")}</CardTitle>
            <p className="text-[10px] text-muted-foreground">actor-quality-v1</p>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {WEIGHTS.map(([label, weight]) => (
              <div key={label}>
                <div className="mb-0.5 flex justify-between text-[10px]"><span>{label}</span><span className="tabular-nums text-muted-foreground">{weight}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/75" style={{ width: `${weight * 4}%` }} /></div>
              </div>
            ))}
            <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[10px] leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-1 font-semibold text-foreground"><ShieldAlert className="h-3 w-3" />{t("smartPage.command.methodRule")}</p>
              <p className="mt-1">{t("smartPage.command.methodRuleBody")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <p className="px-0.5 text-[10px] leading-relaxed text-muted-foreground">{t("smartPage.command.investmentDisclaimer")}</p>
    </div>
  )
}
