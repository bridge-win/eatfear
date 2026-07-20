"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Gauge, ShieldQuestion } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import type { SmartMoneyActor, SmartMoneyQualityConfidence } from "@/lib/smart-money/types"
import { cn } from "@/lib/utils"

type SortKey = "quality" | "copyability" | "pnl" | "roi" | "drawdown" | "capital"

const controlClass = "h-8 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"

function formatUsd(value: number | null): string {
  if (value === null) return "—"
  const sign = value < 0 ? "-" : ""
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(2)}B`
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`
  return `${sign}$${absolute.toFixed(0)}`
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`
}

function numeric(value: number | null, fallback: number): number {
  return value !== null && Number.isFinite(value) ? value : fallback
}

function sortActors(actors: SmartMoneyActor[], sort: SortKey): SmartMoneyActor[] {
  return [...actors].sort((left, right) => {
    if (sort === "copyability") return right.quality.copyabilityScore - left.quality.copyabilityScore
    if (sort === "pnl") return numeric(right.metrics.pnlUsd, -Infinity) - numeric(left.metrics.pnlUsd, -Infinity)
    if (sort === "roi") return numeric(right.metrics.roiPct, -Infinity) - numeric(left.metrics.roiPct, -Infinity)
    if (sort === "drawdown") return numeric(left.metrics.maxDrawdownPct, Infinity) - numeric(right.metrics.maxDrawdownPct, Infinity)
    if (sort === "capital") return numeric(right.metrics.accountValueUsd, -Infinity) - numeric(left.metrics.accountValueUsd, -Infinity)
    const category = { elite: 3, proven: 2, watch: 1, unranked: 0 }
    return category[right.quality.category] - category[left.quality.category] || right.quality.score - left.quality.score
  })
}

export function SmartMoneyDiscovery({ actors, isLoading }: { actors: SmartMoneyActor[]; isLoading: boolean }) {
  const t = useT()
  const [venue, setVenue] = useState("all")
  const [confidence, setConfidence] = useState<"all" | SmartMoneyQualityConfidence>("all")
  const [sort, setSort] = useState<SortKey>("quality")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filtered = useMemo(() => sortActors(actors.filter((actor) => {
    if (venue !== "all" && actor.venue !== venue) return false
    if (confidence !== "all" && actor.quality.confidence !== confidence) return false
    return true
  }), sort), [actors, confidence, sort, venue])
  const selected = filtered.find((actor) => actor.id === selectedId) ?? filtered[0] ?? null

  return (
    <div className="grid items-start gap-2 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="min-w-0 py-0">
        <CardHeader className="border-b px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">{t("smartPage.command.discoveryTitle")}</CardTitle>
              <p className="mt-0.5 max-w-2xl text-[10px] text-muted-foreground">{t("smartPage.command.discoverySubtitle")}</p>
            </div>
            <span className="rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">{filtered.length} {t("smartPage.command.actors")}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <select aria-label={t("smartPage.command.filterVenue")} className={controlClass} value={venue} onChange={(event) => setVenue(event.target.value)}>
              <option value="all">{t("smartPage.command.allVenues")}</option>
              <option value="okx">OKX</option>
              <option value="binance">Binance</option>
              <option value="hyperliquid">Hyperliquid</option>
              <option value="polymarket">Polymarket</option>
            </select>
            <select aria-label={t("smartPage.command.filterConfidence")} className={controlClass} value={confidence} onChange={(event) => setConfidence(event.target.value as "all" | SmartMoneyQualityConfidence)}>
              <option value="all">{t("smartPage.command.allConfidence")}</option>
              <option value="high">High confidence</option>
              <option value="medium">Medium confidence</option>
              <option value="low">Low confidence</option>
            </select>
            <select aria-label={t("smartPage.command.sortBy")} className={controlClass} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="quality">Quality</option>
              <option value="copyability">Copyability</option>
              <option value="pnl">PnL</option>
              <option value="roi">ROI</option>
              <option value="drawdown">Drawdown</option>
              <option value="capital">Capital</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t("smartPage.command.noActors")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[790px] text-xs tabular-nums">
                <thead>
                  <tr className="border-b bg-muted/25 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">{t("smartPage.command.actor")}</th>
                    <th className="px-2 py-2 text-left font-medium">{t("smartPage.command.quality")}</th>
                    <th className="px-2 py-2 text-right font-medium">PnL</th>
                    <th className="px-2 py-2 text-right font-medium">ROI</th>
                    <th className="px-2 py-2 text-right font-medium">Win</th>
                    <th className="px-2 py-2 text-right font-medium">MDD</th>
                    <th className="px-2 py-2 text-right font-medium">{t("smartPage.command.capital")}</th>
                    <th className="px-3 py-2 text-right font-medium">Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((actor) => (
                    <tr key={actor.id} onClick={() => setSelectedId(actor.id)} className={cn("cursor-pointer border-b border-dashed transition-colors last:border-0 hover:bg-muted/35", selected?.id === actor.id && "bg-muted/45")}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-6 w-1 rounded-full", actor.venue === "hyperliquid" ? "bg-[#5CE1B9]" : actor.venue === "polymarket" ? "bg-[#2563EB]" : actor.venue === "binance" ? "bg-[#F0B90B]" : "bg-slate-700 dark:bg-slate-300")} />
                          <div className="min-w-0">
                            <p className="max-w-[150px] truncate font-semibold">{actor.name}</p>
                            <p className="text-[9px] uppercase text-muted-foreground">{actor.venue} · {actor.quality.confidence}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-bold">{actor.quality.score.toFixed(1)}</p>
                        <p className="text-[9px] uppercase text-muted-foreground">{actor.quality.category} · {actor.quality.coverage}%</p>
                      </td>
                      <td className={cn("px-2 py-2 text-right font-medium", (actor.metrics.pnlUsd ?? 0) > 0 ? "text-emerald-600" : (actor.metrics.pnlUsd ?? 0) < 0 ? "text-rose-600" : "")}>{formatUsd(actor.metrics.pnlUsd)}</td>
                      <td className="px-2 py-2 text-right">{pct(actor.metrics.roiPct)}</td>
                      <td className="px-2 py-2 text-right">{pct(actor.metrics.winRatePct)}</td>
                      <td className="px-2 py-2 text-right">{pct(actor.metrics.maxDrawdownPct)}</td>
                      <td className="px-2 py-2 text-right">{formatUsd(actor.metrics.accountValueUsd)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{actor.quality.copyabilityScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="py-0 xl:sticky xl:top-12">
        <CardHeader className="border-b px-3 py-3">
          <CardTitle className="flex items-center gap-1.5 text-sm"><Gauge className="h-4 w-4" />{t("smartPage.command.scoreEvidence")}</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          {selected === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("smartPage.command.selectActor")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{selected.name}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">{selected.address ?? selected.id}</p>
                </div>
                <a href={selected.profileUrl} target="_blank" rel="noreferrer" className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border p-2"><p className="text-[8px] uppercase text-muted-foreground">Quality</p><p className="mt-0.5 text-base font-bold tabular-nums">{selected.quality.score}</p></div>
                <div className="rounded-md border p-2"><p className="text-[8px] uppercase text-muted-foreground">Copy</p><p className="mt-0.5 text-base font-bold tabular-nums">{selected.quality.copyabilityScore}</p></div>
                <div className="rounded-md border p-2"><p className="text-[8px] uppercase text-muted-foreground">Coverage</p><p className="mt-0.5 text-base font-bold tabular-nums">{selected.quality.coverage}%</p></div>
              </div>
              <div className="space-y-1.5">
                {selected.quality.components.map((component) => (
                  <div key={component.key}>
                    <div className="mb-0.5 flex justify-between text-[9px]"><span className="capitalize text-muted-foreground">{component.key}</span><span className="tabular-nums">{component.score.toFixed(1)} · {component.weight}%</span></div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${component.score}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider"><ShieldQuestion className="h-3 w-3" />{t("smartPage.command.limitations")}</p>
                <ul className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                  {selected.provenance.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
                  {selected.quality.flags.map((flag) => <li key={flag}>• {flag.replaceAll("_", " ")}</li>)}
                </ul>
              </div>
              <p className="text-[9px] leading-relaxed text-muted-foreground">{t("smartPage.command.scoreDisclaimer")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
