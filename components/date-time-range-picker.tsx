"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarRange } from "lucide-react"
import { DayPicker, type DateRange } from "react-day-picker"
import { enUS, zhCN } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface DateTimeRangePickerProps {
  label: string
  startLabel: string
  endLabel: string
  startValue: string
  endValue: string
  onChange: (start: string, end: string) => void
  className?: string
}

function parseLocalValue(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

function toLocalValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function mergeDateAndTime(date: Date, value: string): string {
  const time = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/.exec(value)
  const next = new Date(date)
  next.setHours(Number(time?.[1] ?? 0), Number(time?.[2] ?? 0), 0, 0)
  return toLocalValue(next)
}

function replaceTime(value: string, time: string): string {
  const date = value.slice(0, 10)
  return date && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : value
}

function formatTriggerValue(value: string): string {
  return value ? value.replace("T", " ") : "—"
}

function useTwoMonthCalendar(): boolean {
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(min-width: 720px)")
    const update = () => setWide(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return wide
}

export function DateTimeRangePicker({
  label,
  startLabel,
  endLabel,
  startValue,
  endValue,
  onChange,
  className,
}: DateTimeRangePickerProps) {
  const { locale } = useI18n()
  const twoMonths = useTwoMonthCalendar()
  const [open, setOpen] = useState(false)
  const startDate = useMemo(() => parseLocalValue(startValue), [startValue])
  const endDate = useMemo(() => parseLocalValue(endValue), [endValue])
  const [visibleMonth, setVisibleMonth] = useState(startDate ?? new Date(0))
  const controlledRange = useMemo<DateRange | undefined>(
    () => (startDate ? { from: startDate, to: endDate } : undefined),
    [endDate, startDate],
  )
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(controlledRange)
  const valid = Boolean(startDate && endDate && endDate.getTime() > startDate.getTime())

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && startDate) setVisibleMonth(startDate)
  }

  useEffect(() => {
    setCalendarRange(controlledRange)
  }, [controlledRange])

  const handleRangeSelect = (next: DateRange | undefined, triggerDate: Date) => {
    if (calendarRange?.from && calendarRange.to) {
      setCalendarRange({ from: triggerDate, to: undefined })
      return
    }
    setCalendarRange(next)
    if (!next?.from || !next.to) return

    const nextStart = mergeDateAndTime(next.from, startValue)
    let nextEnd = mergeDateAndTime(next.to, endValue)
    const nextStartMs = parseLocalValue(nextStart)?.getTime() ?? 0
    const nextEndMs = parseLocalValue(nextEnd)?.getTime() ?? 0
    if (nextEndMs <= nextStartMs) {
      const endOfDay = new Date(next.to)
      endOfDay.setHours(23, 59, 0, 0)
      nextEnd = toLocalValue(endOfDay)
    }
    onChange(nextStart, nextEnd)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          aria-invalid={!valid}
          className={cn(
            "h-8 w-full min-w-0 justify-start gap-1.5 px-2.5 text-[11px] font-normal tabular-nums sm:w-[21rem]",
            className,
          )}
        >
          <CalendarRange className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 truncate">{formatTriggerValue(startValue)}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="min-w-0 truncate">{formatTriggerValue(endValue)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto p-0"
      >
        <DayPicker
          mode="range"
          selected={calendarRange}
          onSelect={handleRangeSelect}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          numberOfMonths={twoMonths ? 2 : 1}
          pagedNavigation={twoMonths}
          fixedWeeks
          showOutsideDays
          locale={locale === "zh" ? zhCN : enUS}
          classNames={{
            root: "relative p-3",
            months: "flex gap-4",
            month: "w-[15.25rem] space-y-2",
            month_caption: "flex h-7 items-center justify-center",
            caption_label: "text-xs font-semibold",
            nav: "pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between",
            button_previous: "pointer-events-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            button_next: "pointer-events-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            month_grid: "w-full border-collapse",
            weekdays: "flex",
            weekday: "w-8 text-center text-[10px] font-normal text-muted-foreground",
            week: "mt-1 flex w-full",
            day: "relative size-8 p-0 text-center text-xs",
            day_button: "size-8 rounded-md font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            selected: "font-semibold",
            range_start: "rounded-l-md bg-primary text-primary-foreground",
            range_middle: "rounded-none bg-accent text-accent-foreground",
            range_end: "rounded-r-md bg-primary text-primary-foreground",
            today: "font-semibold text-primary",
            outside: "text-muted-foreground/35",
            disabled: "pointer-events-none text-muted-foreground opacity-35",
            hidden: "invisible",
          }}
        />
        <div className="grid gap-2 border-t bg-muted/20 p-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">{startLabel}</span>
            <Input
              aria-label={startLabel}
              type="time"
              value={startValue.slice(11, 16)}
              onInput={(event) => onChange(replaceTime(startValue, event.currentTarget.value), endValue)}
              className="h-7 min-w-0 flex-1 text-xs tabular-nums"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0">{endLabel}</span>
            <Input
              aria-label={endLabel}
              type="time"
              value={endValue.slice(11, 16)}
              onInput={(event) => onChange(startValue, replaceTime(endValue, event.currentTarget.value))}
              className="h-7 min-w-0 flex-1 text-xs tabular-nums"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}
