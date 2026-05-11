"use client"

import { type TimeRangeId, timeRangeOptions } from "@/lib/time-range"
import { cn } from "@/lib/utils"

interface TimeRangeSelectorProps {
  value: TimeRangeId
  onChange: (next: TimeRangeId) => void
  options?: readonly TimeRangeId[]
  className?: string
  size?: "sm" | "md"
}

const defaultOptions: TimeRangeId[] = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "10y", "max"]

export function TimeRangeSelector({ value, onChange, options = defaultOptions, className, size = "sm" }: TimeRangeSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className={cn(
        "inline-flex items-center rounded-full border bg-muted/40 p-0.5 text-xs",
        size === "md" && "text-sm",
        className,
      )}
    >
      {options.map((id) => {
        const option = timeRangeOptions.find((entry) => entry.id === id)
        if (!option) return null
        const isActive = id === value
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
              size === "md" && "px-3 py-1.5",
              isActive && "bg-background text-foreground shadow-sm",
            )}
            title={option.description}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
