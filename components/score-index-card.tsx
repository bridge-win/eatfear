"use client"

import type { ReactNode } from "react"
import { Info } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

export interface ScoreIndexCardProps {
  /** Top-left card title (e.g. "BTC Multi-TF Score" / "Fear & Greed") */
  label: ReactNode
  /** Big score value (already formatted, e.g. "62" or "—") */
  value: ReactNode
  /** Trailing suffix after the value (e.g. " / 100") */
  valueSuffix?: ReactNode
  /** Short colored signal/classification under the score */
  signal?: ReactNode
  /** Tailwind text-color class for the value & signal */
  toneClassName?: string
  /** Aria label for the value */
  valueAriaLabel?: string
  /** Aria label for the info-icon trigger */
  infoAriaLabel?: string
  /** Content rendered inside the info-icon hover panel */
  infoContent: ReactNode
  className?: string
}

/**
 * Compact 0-100 index card with title, large score, signal text, and info hover.
 * Shared chrome so cards (e.g. BTC Multi-TF, Fear & Greed) stay visually consistent.
 */
export function ScoreIndexCard({
  label,
  value,
  valueSuffix,
  signal,
  toneClassName,
  valueAriaLabel,
  infoAriaLabel,
  infoContent,
  className,
}: ScoreIndexCardProps) {
  return (
    <div
      className={cn(
        "min-w-0 shrink-0 rounded-md border bg-card/95 px-2.5 py-2 text-left shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight text-foreground">{label}</p>
        <HoverCard openDelay={120} closeDelay={180}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label={typeof infoAriaLabel === "string" ? infoAriaLabel : undefined}
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground",
                "outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            align="end"
            side="bottom"
            collisionPadding={16}
            className="max-h-[min(640px,_82vh)] w-[min(28rem,_94vw)] overflow-y-auto p-0"
          >
            {infoContent}
          </HoverCardContent>
        </HoverCard>
      </div>

      <p
        aria-label={valueAriaLabel}
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums leading-none tracking-tight md:text-[1.7rem]",
          toneClassName ?? "text-foreground",
        )}
      >
        {value}
        {valueSuffix && (
          <span className="ml-0.5 text-base font-normal text-muted-foreground md:text-lg">{valueSuffix}</span>
        )}
      </p>

      {signal && (
        <p className={cn("mt-1 text-[13px] font-medium leading-snug", toneClassName ?? "text-muted-foreground")}>
          {signal}
        </p>
      )}
    </div>
  )
}
