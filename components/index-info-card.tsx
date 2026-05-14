"use client"

import type { ReactNode } from "react"
import { Info } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

interface IndexInfoCardProps {
  /** Big, prominent score / index value rendered in the visible card. */
  value: ReactNode
  /** Accessible label for the value (screen reader announces this). */
  valueAriaLabel?: string
  /** Tailwind text-color class applied to the value. */
  valueClassName?: string
  /** Accessible label for the info-icon trigger. */
  infoAriaLabel?: string
  /** Optional small label badge to the left of the value (kept off by default for compact cards). */
  label?: ReactNode
  /** Content rendered inside the info-icon hover panel. */
  infoContent: ReactNode
  className?: string
}

/**
 * Compact "index" card with a value and a top-right info-icon hover panel.
 * The card chrome + info trigger are shared; each consumer owns the
 * value rendering and the hover panel content.
 */
export function IndexInfoCard({
  value,
  valueAriaLabel,
  valueClassName,
  infoAriaLabel,
  label,
  infoContent,
  className,
}: IndexInfoCardProps) {
  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-md border bg-card/95 pl-2 pr-0.5 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {label ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      ) : null}
      <span
        aria-label={valueAriaLabel}
        className={cn("text-lg font-bold tabular-nums leading-none md:text-xl", valueClassName)}
      >
        {value}
      </span>
      <HoverCard openDelay={120} closeDelay={180}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={infoAriaLabel}
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
          className="max-h-[min(520px,_72vh)] w-[min(22rem,_92vw)] overflow-y-auto p-0"
        >
          {infoContent}
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}
