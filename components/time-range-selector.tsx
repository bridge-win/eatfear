"use client"

import { type TimeRangeId, timeRangeOptions } from "@/lib/time-range"
import {
  cryptoHistoryIntervalOptions,
  type CryptoHistoryInterval,
} from "@/lib/time-range"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface TimeRangeSelectorProps {
  value: TimeRangeId
  onChange: (next: TimeRangeId) => void
  options?: readonly TimeRangeId[]
  className?: string
  size?: "sm" | "md"
  customActive?: boolean
  onCustomSelect?: () => void
}

const defaultOptions: TimeRangeId[] = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "10y", "max"]

export function TimeRangeSelector({
  value,
  onChange,
  options = defaultOptions,
  className,
  size = "sm",
  customActive = false,
  onCustomSelect,
}: TimeRangeSelectorProps) {
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
      {onCustomSelect && (
        <button
          key="custom"
          role="tab"
          aria-selected={customActive}
          type="button"
          onClick={onCustomSelect}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
            size === "md" && "px-3 py-1.5",
            customActive && "bg-background text-foreground shadow-sm",
          )}
          title="Custom start and end time"
        >
          Custom
        </button>
      )}
    </div>
  )
}

interface CryptoIntervalSelectorProps {
  value: CryptoHistoryInterval
  onChange: (next: CryptoHistoryInterval) => void
  className?: string
}

export function CryptoIntervalSelector({ value, onChange, className }: CryptoIntervalSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Candle interval"
      className={cn("inline-flex items-center rounded-full border bg-muted/40 p-0.5 text-xs", className)}
    >
      {cryptoHistoryIntervalOptions.map((option) => {
        const isActive = option.id === value
        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground",
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

interface CustomTimeWindowPickerProps {
  startValue: string
  endValue: string
  onStartChange: (next: string) => void
  onEndChange: (next: string) => void
  className?: string
}

export function CustomTimeWindowPicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  className,
}: CustomTimeWindowPickerProps) {
  return (
    <div className={cn("grid min-w-0 grid-cols-2 gap-1.5", className)}>
      <Input
        aria-label="Custom start time"
        type="datetime-local"
        value={startValue}
        onChange={(event) => onStartChange(event.target.value)}
        className="h-8 min-w-[10rem] text-xs"
      />
      <Input
        aria-label="Custom end time"
        type="datetime-local"
        value={endValue}
        onChange={(event) => onEndChange(event.target.value)}
        className="h-8 min-w-[10rem] text-xs"
      />
    </div>
  )
}
