"use client"

import * as React from "react"
import { ALargeSmall, Minus, Plus, RotateCcw } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "eatfear.font-size-scale"
const DEFAULT_FONT_SIZE_SCALE = 1.08

const FONT_SIZE_LEVELS = [0.96, 1, DEFAULT_FONT_SIZE_SCALE, 1.16, 1.24] as const

type FontSizeScale = (typeof FONT_SIZE_LEVELS)[number]

interface FontSizeToggleProps {
  className?: string
}

function readStoredFontSizeScale(): FontSizeScale | null {
  if (typeof window === "undefined") return null

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)
    if (!storedValue) return null

    const parsedValue = Number(storedValue)
    return FONT_SIZE_LEVELS.find((level) => level === parsedValue) ?? null
  } catch {
    return null
  }
}

function applyFontSizeScale(scale: FontSizeScale) {
  if (typeof document === "undefined") return

  document.documentElement.style.setProperty("--font-size-scale", String(scale))
  document.documentElement.dataset.fontSizeScale = String(scale)
}

function writeStoredFontSizeScale(scale: FontSizeScale) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(STORAGE_KEY, String(scale))
  } catch {
    // Ignore storage failures so the control still works for the current page.
  }
}

function getLevelByIndex(index: number): FontSizeScale {
  const clampedIndex = Math.min(Math.max(index, 0), FONT_SIZE_LEVELS.length - 1)
  return FONT_SIZE_LEVELS[clampedIndex] ?? DEFAULT_FONT_SIZE_SCALE
}

function formatScale(scale: FontSizeScale) {
  return `${Math.round(scale * 100)}%`
}

export function FontSizeToggle({ className }: FontSizeToggleProps) {
  const t = useT()
  const [mounted, setMounted] = React.useState(false)
  const [scale, setScale] = React.useState<FontSizeScale>(DEFAULT_FONT_SIZE_SCALE)

  React.useEffect(() => {
    const storedScale = readStoredFontSizeScale() ?? DEFAULT_FONT_SIZE_SCALE
    setScale(storedScale)
    applyFontSizeScale(storedScale)
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return

    applyFontSizeScale(scale)
    writeStoredFontSizeScale(scale)
  }, [mounted, scale])

  const selectedIndex = Math.max(0, FONT_SIZE_LEVELS.findIndex((level) => level === scale))
  const canDecrease = selectedIndex > 0
  const canIncrease = selectedIndex < FONT_SIZE_LEVELS.length - 1
  const progress = (selectedIndex / (FONT_SIZE_LEVELS.length - 1)) * 100

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("fontSize.toggle")}
          title={t("fontSize.toggle")}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <ALargeSmall className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <span className="text-xs font-medium text-muted-foreground">{t("fontSize.label")}</span>
          <span className="text-xs font-semibold tabular-nums">{formatScale(scale)}</span>
        </div>
        <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
          <button
            type="button"
            aria-label={t("fontSize.decrease")}
            title={t("fontSize.decrease")}
            disabled={!canDecrease}
            onClick={() => setScale(getLevelByIndex(selectedIndex - 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${progress}%` }} />
          </div>
          <button
            type="button"
            aria-label={t("fontSize.increase")}
            title={t("fontSize.increase")}
            disabled={!canIncrease}
            onClick={() => setScale(getLevelByIndex(selectedIndex + 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setScale(DEFAULT_FONT_SIZE_SCALE)}
          className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("fontSize.reset")}
        </button>
      </PopoverContent>
    </Popover>
  )
}
