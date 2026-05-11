"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface InfoTooltipProps {
  title?: string
  description: React.ReactNode
  source?: string
  className?: string
  iconClassName?: string
}

export function InfoTooltip({ title, description, source, className, iconClassName }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent className="max-w-sm space-y-1.5">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <div className="text-xs text-muted-foreground whitespace-pre-line">{description}</div>
          {source && <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Source · {source}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
