"use client"

import { ChevronRight, LockKeyhole } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function AvailabilityBadges({ compact = false }: { compact?: boolean }) {
  const t = useT()
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Badge variant="outline" className={cn("gap-1 text-[10px] text-muted-foreground", compact && "px-1.5 py-0")}>
        <LockKeyhole className="size-2.5" aria-hidden="true" />
        {t("manipMonitor.unavailable")}
      </Badge>
      <Badge variant="secondary" className={cn("text-[10px]", compact && "px-1.5 py-0")}>
        {t("manipMonitor.comingSoon")}
      </Badge>
    </div>
  )
}

function UnavailableMetric({
  title,
  valueLabel,
  info,
}: {
  title: string
  valueLabel: string
  info: string
}) {
  return (
    <div className="rounded border border-border/55 bg-muted/15 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-medium text-foreground">{title}</p>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">{valueLabel}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{info}</p>
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
    <section className={cn(className)} aria-labelledby="market-manipulation-monitor-title">
      <details aria-disabled="true" className="group rounded-md border bg-card/70 px-2.5 py-2 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 outline-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h2 id="market-manipulation-monitor-title" className="truncate text-xs font-semibold">
                  {t("manipMonitor.title")}
                </h2>
                <AvailabilityBadges compact />
              </div>
              <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{t("manipMonitor.subtitle")}</p>
            </div>
          </div>
          <span className="hidden shrink-0 text-[10.5px] text-muted-foreground sm:inline">
            {t("manipMonitor.collapsedHint")}
          </span>
        </summary>
        <div className="mt-2 grid gap-1.5 border-t border-border/50 pt-2 md:grid-cols-2">
          <UnavailableMetric
            title={t("manipMonitor.liquidation.title", { ccy: currency })}
            valueLabel="—"
            info={t("manipMonitor.liquidation.info")}
          />
          <UnavailableMetric
            title={t("manipMonitor.cancellation.title", { ccy: currency })}
            valueLabel="—"
            info={t("manipMonitor.cancellation.info")}
          />
          <p className="text-[10px] text-muted-foreground/80 md:col-span-2">{t("manipMonitor.source")}</p>
        </div>
      </details>
    </section>
  )
}
