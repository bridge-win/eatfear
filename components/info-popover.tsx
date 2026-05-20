"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface InfoPopoverProps {
  title?: string
  description: React.ReactNode
  source?: string
  className?: string
  iconClassName?: string
  contentClassName?: string
}

export function InfoPopover({
  title,
  description,
  source,
  className,
  iconClassName,
  contentClassName,
}: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <Info className={cn("h-3.5 w-3.5", iconClassName)} />
        </button>
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
