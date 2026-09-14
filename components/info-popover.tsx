"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface InfoPopoverProps {
  ariaLabel?: string
  title?: string
  description: React.ReactNode
  source?: string
  className?: string
  iconClassName?: string
  contentClassName?: string
  /**
   * Render the trigger as a focusable span instead of a button. Use when the icon
   * sits inside another button (e.g. a legend toggle): nested buttons are invalid HTML
   * and browsers deliver the click to the outer one.
   */
  triggerAs?: "button" | "span"
}

export function InfoPopover({
  ariaLabel,
  title,
  description,
  source,
  className,
  iconClassName,
  contentClassName,
  triggerAs = "button",
}: InfoPopoverProps) {
  const triggerClass = cn(
    "inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    className,
  )
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <Popover>
      <PopoverTrigger asChild>
        {triggerAs === "span" ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={ariaLabel ?? "More info"}
            className={triggerClass}
            onClick={stop}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") event.stopPropagation() }}
          >
            <Info className={cn("h-3.5 w-3.5", iconClassName)} />
          </span>
        ) : (
          <button type="button" aria-label={ariaLabel ?? "More info"} className={triggerClass}>
            <Info className={cn("h-3.5 w-3.5", iconClassName)} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className={cn("max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto", contentClassName)}>
        <div className="space-y-2">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <div className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{description}</div>
          {source && <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Source · {source}</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
