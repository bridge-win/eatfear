"use client"

import { Languages } from "lucide-react"

import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface LanguageToggleProps {
  className?: string
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n()
  const next = locale === "zh" ? "en" : "zh"
  const badge = locale === "zh" ? "EN" : "中"

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t("lang.toggle")}
      title={t("lang.toggle")}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border bg-background/60 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      <Languages className="h-3.5 w-3.5" />
      <span className="tabular-nums">{badge}</span>
    </button>
  )
}
