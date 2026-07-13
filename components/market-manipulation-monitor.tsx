"use client"

import { LockKeyhole } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function AvailabilityBadges() {
  const t = useT()
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
        <LockKeyhole className="size-2.5" aria-hidden="true" />
        {t("manipMonitor.unavailable")}
      </Badge>
      <Badge variant="secondary" className="text-[10px]">
        {t("manipMonitor.comingSoon")}
      </Badge>
    </div>
  )
}

function LiquidationWallSilhouette() {
  return (
    <div className="relative mt-3 h-36 overflow-hidden rounded-md border border-border/60 bg-muted/20" aria-hidden="true">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div className="grid h-full grid-cols-2 items-center gap-px px-5 py-4 opacity-55">
        <div className="flex h-full flex-col items-end justify-center gap-1.5">
          <div className="h-2.5 w-12 rounded-l bg-muted-foreground/15" />
          <div className="h-2.5 w-20 rounded-l bg-muted-foreground/20" />
          <div className="h-2.5 w-28 rounded-l bg-muted-foreground/25" />
          <div className="h-2.5 w-16 rounded-l bg-muted-foreground/20" />
          <div className="h-2.5 w-24 rounded-l bg-muted-foreground/25" />
          <div className="h-2.5 w-10 rounded-l bg-muted-foreground/15" />
        </div>
        <div className="flex h-full flex-col items-start justify-center gap-1.5">
          <div className="h-2.5 w-16 rounded-r bg-muted-foreground/20" />
          <div className="h-2.5 w-10 rounded-r bg-muted-foreground/15" />
          <div className="h-2.5 w-24 rounded-r bg-muted-foreground/25" />
          <div className="h-2.5 w-28 rounded-r bg-muted-foreground/25" />
          <div className="h-2.5 w-20 rounded-r bg-muted-foreground/20" />
          <div className="h-2.5 w-12 rounded-r bg-muted-foreground/15" />
        </div>
      </div>
      <div className="absolute inset-0 bg-background/15 backdrop-blur-[0.5px]" />
    </div>
  )
}

function CancellationHistorySilhouette() {
  return (
    <div className="relative mt-3 h-36 overflow-hidden rounded-md border border-border/60 bg-muted/20" aria-hidden="true">
      <svg viewBox="0 0 320 112" className="h-full w-full opacity-50" preserveAspectRatio="none">
        <path d="M0 28H320M0 56H320M0 84H320" stroke="currentColor" strokeOpacity="0.08" />
        <path
          d="M0 78 C24 72 32 46 55 51 S91 88 116 65 S150 35 173 52 S207 86 232 60 S272 28 320 43"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        <path
          d="M0 88 C35 80 52 76 75 81 S112 98 140 74 S176 59 205 71 S246 91 276 72 S300 62 320 67"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2"
        />
      </svg>
      <div className="absolute inset-0 bg-background/15 backdrop-blur-[0.5px]" />
    </div>
  )
}

export interface MarketManipulationMonitorProps {
  currency: string
  className?: string
}

export function MarketManipulationMonitor({ currency, className }: MarketManipulationMonitorProps) {
  const t = useT()

  return (
    <section className={cn("space-y-2", className)} aria-labelledby="market-manipulation-monitor-title">
      <div>
        <h2 id="market-manipulation-monitor-title" className="text-sm font-semibold">
          {t("manipMonitor.title")}
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t("manipMonitor.subtitle")}</p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <Card className="py-2.5" aria-disabled="true">
          <CardHeader className="px-3 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">{t("manipMonitor.liquidation.title", { ccy: currency })}</CardTitle>
              <AvailabilityBadges />
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-1">
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded border border-border/60 bg-muted/20 px-1.5 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("manipMonitor.liquidation.long")}</p>
                <p className="text-xs font-semibold text-muted-foreground">—</p>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 px-1.5 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("manipMonitor.liquidation.mark")}</p>
                <p className="text-xs font-semibold text-muted-foreground">—</p>
              </div>
              <div className="rounded border border-border/60 bg-muted/20 px-1.5 py-1">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t("manipMonitor.liquidation.short")}</p>
                <p className="text-xs font-semibold text-muted-foreground">—</p>
              </div>
            </div>
            <LiquidationWallSilhouette />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("manipMonitor.liquidation.info")}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/80">{t("manipMonitor.source")}</p>
          </CardContent>
        </Card>

        <Card className="py-2.5" aria-disabled="true">
          <CardHeader className="px-3 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">{t("manipMonitor.cancellation.title", { ccy: currency })}</CardTitle>
              <AvailabilityBadges />
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-1">
            <div className="flex items-center justify-between rounded border border-border/60 bg-muted/20 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("manipMonitor.cancellation.rate")}</span>
              <span className="text-xs font-semibold text-muted-foreground">—</span>
            </div>
            <CancellationHistorySilhouette />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("manipMonitor.cancellation.info")}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/80">{t("manipMonitor.source")}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
