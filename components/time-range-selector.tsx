"use client"

import { Input } from "@/components/ui/input"
import {
  cryptoHistoryIntervalOptions,
  isTimeRangeId,
  timeRangeOptions,
  type CryptoHistoryInterval,
  type TimeRangeId,
} from "@/lib/time-range"
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

export type TimeRangeSelectValue = TimeRangeId | "custom"

interface TimeRangeSelectProps {
  label: string
  customLabel: string
  value: TimeRangeSelectValue
  onChange: (next: TimeRangeSelectValue) => void
  options?: readonly TimeRangeId[]
  className?: string
}

export function TimeRangeSelect({ label, customLabel, value, onChange, options = defaultOptions, className }: TimeRangeSelectProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const next = event.target.value
          if (next === "custom" || isTimeRangeId(next)) onChange(next)
        }}
        className="h-8 min-w-[6.5rem] rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {options.map((id) => {
          const option = timeRangeOptions.find((entry) => entry.id === id)
          if (!option) return null
          return <option key={id} value={id}>{option.label}</option>
        })}
        <option value="custom">{customLabel}</option>
      </select>
    </div>
  )
}

interface CryptoIntervalSelectProps {
  label: string
  value: CryptoHistoryInterval
  onChange: (next: CryptoHistoryInterval) => void
  className?: string
}

export function CryptoIntervalSelect({ label, value, onChange, className }: CryptoIntervalSelectProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const next = event.target.value
          const option = cryptoHistoryIntervalOptions.find((entry) => entry.id === next)
          if (option) onChange(option.id)
        }}
        className="h-8 min-w-[4.75rem] rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {cryptoHistoryIntervalOptions.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

interface DateTimeFieldProps {
  label: string
  value: string
  onChange: (next: string) => void
  className?: string
}

export function DateTimeField({ label, value, onChange, className }: DateTimeFieldProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <Input
        aria-label={label}
        type="datetime-local"
        value={value}
        onInput={(event) => onChange(event.currentTarget.value)}
        className="h-8 w-48 text-xs tabular-nums"
      />
    </div>
  )
}

interface CustomTimeWindowPickerProps {
  startLabel: string
  endLabel: string
  startValue: string
  endValue: string
  onStartChange: (next: string) => void
  onEndChange: (next: string) => void
  className?: string
}

export function CustomTimeWindowPicker({
  startLabel,
  endLabel,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  className,
}: CustomTimeWindowPickerProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-1.5", className)}>
      <DateTimeField label={startLabel} value={startValue} onChange={onStartChange} />
      <DateTimeField label={endLabel} value={endValue} onChange={onEndChange} />
    </div>
  )
}
