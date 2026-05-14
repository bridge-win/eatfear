"use client"

import { ScoreIndexCard } from "@/components/score-index-card"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { FearGreedIndex } from "@/lib/types"

const FNG_INFO_ZH = [
  "Alternative.me 加密恐慌贪婪指数（0–100），由多维子项加权合成：",
  "",
  "① 波动率（25%）：当前 30/90 日波动与历史水平的比较。",
  "② 市场动量与成交量（25%）：BTC 30/90 日动量与放量对比。",
  "③ 社交情绪（15%）：Twitter 等平台特定话题的相对热度。",
  "④ 调查（15%，目前暂停）：周度市场调查。",
  "⑤ BTC 占比（10%）：BTC.D 上升通常意味避险情绪。",
  "⑥ Google Trends（10%）：与恐慌相关的搜索量趋势。",
  "",
  "分段：0–24 极度恐慌；25–49 恐慌；50 中性；51–74 贪婪；75–100 极度贪婪。",
  "",
  "数据来源：alternative.me /fng API（约每日刷新）。",
].join("\n")

const FNG_INFO_EN = [
  "Alternative.me Crypto Fear & Greed Index (0–100), composed from multiple sub-factors:",
  "",
  "① Volatility (25%): current 30/90-day volatility vs historical levels.",
  "② Market momentum & volume (25%): BTC 30/90-day momentum and volume comparisons.",
  "③ Social sentiment (15%): topic-specific activity on Twitter etc.",
  "④ Surveys (15%, currently paused): weekly market polls.",
  "⑤ BTC dominance (10%): rising BTC.D often signals risk-off.",
  "⑥ Google Trends (10%): fear-related search-volume trends.",
  "",
  "Bands: 0–24 Extreme Fear · 25–49 Fear · 50 Neutral · 51–74 Greed · 75–100 Extreme Greed.",
  "",
  "Source: alternative.me /fng API (refreshes ~daily).",
].join("\n")

function bandStyles(value: number) {
  if (value <= 24) return "text-red-600 dark:text-red-400"
  if (value <= 49) return "text-orange-600 dark:text-orange-400"
  if (value === 50) return "text-amber-600 dark:text-amber-400"
  if (value <= 74) return "text-teal-600 dark:text-teal-400"
  return "text-emerald-600 dark:text-emerald-400"
}

function classificationKey(c: FearGreedIndex["classification"]): string {
  switch (c) {
    case "Extreme Fear":
      return "fng.band.extremeFear"
    case "Fear":
      return "fng.band.fear"
    case "Neutral":
      return "fng.band.neutral"
    case "Greed":
      return "fng.band.greed"
    case "Extreme Greed":
      return "fng.band.extremeGreed"
    default:
      return "fng.band.neutral"
  }
}

interface FearGreedScoreCardProps {
  index: FearGreedIndex | null
  className?: string
}

function FngInfoHover({ index }: { index: FearGreedIndex | null }) {
  const { locale, t } = useI18n()
  const description = locale === "zh" ? FNG_INFO_ZH : FNG_INFO_EN
  const updatedHint = index
    ? (() => {
        try {
          return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(index.timestamp)
        } catch {
          return ""
        }
      })()
    : ""

  const valueLine =
    index !== null
      ? (locale === "zh"
          ? `当前值：${index.value} / 100 · ${classificationZh(index.classification)}`
          : `Current: ${index.value} / 100 · ${index.classification}`)
      : null

  return (
    <div className="space-y-3 px-3 py-2.5 text-left">
      <p className="text-[10px] text-muted-foreground">
        {updatedHint ? `${updatedHint} · ` : ""}
        {t("fng.hover.refreshHint")}
      </p>

      {valueLine && (
        <div className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5">
          <p className="text-[11px] font-semibold text-foreground">{valueLine}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{t("fng.hover.sources")}</p>
        </div>
      )}

      <section className="rounded-md border border-border/55 bg-muted/20 px-2 py-2">
        <p className="text-xs font-semibold text-foreground">{t("fng.hover.modelTitle")}</p>
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-2 text-[10px] text-muted-foreground/80">{t("fng.hover.sources")}</p>
      </section>
    </div>
  )
}

function classificationZh(c: FearGreedIndex["classification"]): string {
  switch (c) {
    case "Extreme Fear": return "极度恐慌"
    case "Fear": return "恐慌"
    case "Neutral": return "中性"
    case "Greed": return "贪婪"
    case "Extreme Greed": return "极度贪婪"
    default: return c
  }
}

export function FearGreedScoreCard({ index, className }: FearGreedScoreCardProps) {
  const { t } = useI18n()
  const value = index?.value ?? null
  const tone = value !== null ? bandStyles(value) : "text-muted-foreground"

  const valueText = value === null ? "—" : value
  const valueAriaLabel =
    value === null
      ? t("fng.aria.idle")
      : t("fng.aria.value", { value })

  const signal = index ? t(classificationKey(index.classification)) : t("regime.hover.loading")

  return (
    <ScoreIndexCard
      className={cn(className)}
      label={t("fng.label")}
      value={valueText}
      valueSuffix={t("regime.hover.scoreSuffix")}
      signal={signal}
      toneClassName={tone}
      valueAriaLabel={valueAriaLabel}
      infoAriaLabel={t("fng.hover.aria")}
      infoContent={<FngInfoHover index={index} />}
    />
  )
}
