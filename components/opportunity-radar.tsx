"use client"

import { Activity, AlertTriangle, BookOpen, Database, ShieldCheck, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DATA_CATEGORY_CATALOG,
  SIGNAL_METHOD_CATALOG,
  SOURCE_ROADMAP,
  type LocalizedText,
  type OpportunityAssetClass,
  type OpportunityConfidence,
  type OpportunityDirection,
  type TradingOpportunity,
} from "@/lib/opportunity-engine"
import { RESEARCH_CORPUS_STATS } from "@/lib/research-corpus"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface OpportunityRadarProps {
  assetClass: OpportunityAssetClass
  title: LocalizedText
  subtitle: LocalizedText
  opportunities: TradingOpportunity[]
  loading?: boolean
  className?: string
}

function text(value: LocalizedText, locale: "zh" | "en"): string {
  return value[locale]
}

function formatUpdatedAt(timestamp: number | null, locale: "zh" | "en"): string {
  if (timestamp === null || !Number.isFinite(timestamp) || timestamp <= 0) return locale === "zh" ? "暂无时间戳" : "No timestamp"
  const date = new Date(timestamp)
  return date.toISOString().slice(0, 10)
}

function directionLabel(direction: OpportunityDirection, locale: "zh" | "en"): string {
  const labels: Record<OpportunityDirection, LocalizedText> = {
    long: { zh: "偏多", en: "Long bias" },
    short: { zh: "偏空", en: "Short bias" },
    risk_off: { zh: "防守", en: "Risk-off" },
    neutral: { zh: "中性", en: "Neutral" },
    watch: { zh: "观察", en: "Watch" },
  }
  return labels[direction][locale]
}

function confidenceLabel(confidence: OpportunityConfidence, locale: "zh" | "en"): string {
  const labels: Record<OpportunityConfidence, LocalizedText> = {
    high: { zh: "高置信", en: "High confidence" },
    medium: { zh: "中置信", en: "Medium confidence" },
    low: { zh: "低置信", en: "Low confidence" },
  }
  return labels[confidence][locale]
}

function directionTone(direction: OpportunityDirection): string {
  if (direction === "long") return "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
  if (direction === "short" || direction === "risk_off") return "border-red-500/40 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
  return "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
}

function evidenceTone(tone: "positive" | "negative" | "neutral" | "warning"): string {
  if (tone === "positive") return "text-emerald-600 dark:text-emerald-400"
  if (tone === "negative") return "text-red-600 dark:text-red-400"
  if (tone === "warning") return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

function scoreTone(score: number, direction: OpportunityDirection): string {
  if (direction === "risk_off") return score >= 65 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
  if (score >= 68) return "text-emerald-600 dark:text-emerald-400"
  if (score <= 32) return "text-red-600 dark:text-red-400"
  return "text-amber-600 dark:text-amber-400"
}

function LoadingOpportunityCard({ index }: { index: number }) {
  return (
    <article className="rounded-md border bg-card/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="h-4 w-40 animate-pulse rounded bg-muted" />
        <span className="h-5 w-8 animate-pulse rounded bg-muted" />
      </div>
      <span className="mt-2 block h-3 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, offset) => (
          <span key={`${index}-${offset}`} className="h-7 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </article>
  )
}

function OpportunityCard({ opportunity }: { opportunity: TradingOpportunity }) {
  const { locale } = useI18n()
  return (
    <article
      data-opportunity-card={opportunity.assetClass}
      data-opportunity-id={opportunity.id}
      className="min-w-0 rounded-md border bg-card/85 px-3 py-2 shadow-sm"
    >
      <header className="flex min-w-0 items-center gap-1.5">
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={text(opportunity.title, locale)}>
          {text(opportunity.title, locale)}
        </h3>
        <Badge variant="outline" className={cn("h-5 shrink-0 rounded-sm px-1.5 text-[10px]", directionTone(opportunity.direction))}>
          {directionLabel(opportunity.direction, locale)}
        </Badge>
        <span className="shrink-0 text-[10px] text-muted-foreground">{confidenceLabel(opportunity.confidence, locale)}</span>
        <p className={cn("shrink-0 text-lg font-bold leading-none tabular-nums", scoreTone(opportunity.score, opportunity.direction))}>
          {opportunity.score}
        </p>
      </header>

      <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground" title={text(opportunity.thesis, locale)}>
        {text(opportunity.thesis, locale)}
      </p>

      {/* Flat single row: four drivers side by side instead of a 2x2 block. */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {opportunity.evidence.slice(0, 4).map((item) => (
          <div key={`${item.label.en}-${item.value}`} className="min-w-0 rounded-sm border bg-background/60 px-1.5 py-1">
            <p className="truncate text-[9px] leading-3 text-muted-foreground">{text(item.label, locale)}</p>
            <p className={cn("truncate text-[11px] font-semibold leading-4 tabular-nums", evidenceTone(item.tone))}>{item.value}</p>
          </div>
        ))}
      </div>

      <footer className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[9px] text-muted-foreground">
        {opportunity.contradictions.length > 0 && (
          <span className="inline-flex min-w-0 items-center gap-1 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {opportunity.contradictions.map((item) => `${text(item.label, locale)} ${item.value}`).join(" · ")}
            </span>
          </span>
        )}
        <span className="ml-auto shrink-0">
          {text(opportunity.horizon, locale)} · {formatUpdatedAt(opportunity.updatedAt, locale)}
        </span>
      </footer>
    </article>
  )
}

export function OpportunityRadar({
  assetClass,
  title,
  subtitle,
  opportunities,
  loading = false,
  className,
}: OpportunityRadarProps) {
  const { locale } = useI18n()
  const emptyLabel = locale === "zh" ? "暂无足够数据生成机会卡片。" : "Not enough data to synthesize opportunity cards yet."
  // Cards size themselves to the viewport rather than sitting in fixed thirds, so
  // two cards fill the row instead of leaving a third of the width empty.
  const gridClass = "grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))]"

  return (
    <section className={cn("space-y-1.5", className)} data-opportunity-radar={assetClass}>
      <header className="flex min-w-0 items-center gap-1.5">
        <Activity className="h-4 w-4 shrink-0 text-primary" />
        <h2 className="shrink-0 text-sm font-bold tracking-tight">{text(title, locale)}</h2>
        <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={text(subtitle, locale)}>
          {text(subtitle, locale)}
        </p>
      </header>

      {loading && opportunities.length === 0 ? (
        <div className={gridClass}>
          {Array.from({ length: 2 }, (_, index) => (
            <LoadingOpportunityCard key={index} index={index} />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-md border px-3 py-3 text-center text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className={gridClass}>
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      )}
    </section>
  )
}

export function MethodologySummaryStrip() {
  const { locale } = useI18n()
  const wired = SOURCE_ROADMAP.filter((item) => item.status === "wired").length
  const planned = SOURCE_ROADMAP.filter((item) => item.status === "planned").length
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-md border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[11px] font-semibold">{locale === "zh" ? "方法库" : "Method Library"}</p>
        </div>
        <p className="mt-1 text-lg font-bold tabular-nums">{SIGNAL_METHOD_CATALOG.length}</p>
      </article>
      <article className="rounded-md border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-blue-600" />
          <p className="text-[11px] font-semibold">{locale === "zh" ? "论文 / 实战" : "Papers / Playbooks"}</p>
        </div>
        <p className="mt-1 text-lg font-bold tabular-nums">
          {RESEARCH_CORPUS_STATS.paperCount}/{RESEARCH_CORPUS_STATS.practitionerMethodCount}
        </p>
      </article>
      <article className="rounded-md border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-blue-600" />
          <p className="text-[11px] font-semibold">{locale === "zh" ? "数据分类" : "Data Classes"}</p>
        </div>
        <p className="mt-1 text-lg font-bold tabular-nums">{DATA_CATEGORY_CATALOG.length}</p>
      </article>
      <article className="rounded-md border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-[11px] font-semibold">{locale === "zh" ? "数据源状态" : "Source Status"}</p>
        </div>
        <p className="mt-1 text-lg font-bold tabular-nums">
          {wired}/{planned}
        </p>
      </article>
    </div>
  )
}
