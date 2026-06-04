"use client"

import { Activity, AlertTriangle, BookOpen, Clock, Database, ShieldCheck, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  DATA_CATEGORY_CATALOG,
  SIGNAL_METHOD_CATALOG,
  SOURCE_ROADMAP,
  getDataCategoriesForAssetClass,
  type DataCategoryDefinition,
  type LocalizedText,
  type OpportunityAssetClass,
  type OpportunityConfidence,
  type OpportunityDirection,
  type SignalMethodId,
  type TradingOpportunity,
} from "@/lib/opportunity-engine"
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

function methodLabel(method: SignalMethodId, locale: "zh" | "en"): string {
  const definition = SIGNAL_METHOD_CATALOG.find((item) => item.id === method)
  return definition ? text(definition.title, locale) : method
}

function SourceStatusBadge({ status }: { status: "wired" | "planned" | "research" }) {
  const { locale } = useI18n()
  const label =
    status === "wired"
      ? { zh: "已接入", en: "Wired" }
      : status === "planned"
        ? { zh: "计划接入", en: "Planned" }
        : { zh: "研究", en: "Research" }
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-sm px-1.5 text-[10px]",
        status === "wired" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
        status === "planned" && "border-amber-500/40 text-amber-700 dark:text-amber-300",
      )}
    >
      {text(label, locale)}
    </Badge>
  )
}

function CategoryPill({ category }: { category: DataCategoryDefinition }) {
  const { locale } = useI18n()
  return (
    <article className="min-w-0 rounded-md border bg-card/70 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <h3 className="truncate text-[11px] font-semibold">{text(category.title, locale)}</h3>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
        {text(category.purpose, locale)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {category.methods.slice(0, 3).map((method) => (
          <span key={method} className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {methodLabel(method, locale)}
          </span>
        ))}
      </div>
    </article>
  )
}

function LoadingOpportunityCard({ index }: { index: number }) {
  return (
    <article className="min-h-44 rounded-md border bg-card/60 px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="h-4 w-28 animate-pulse rounded bg-muted" />
        <span className="h-6 w-12 animate-pulse rounded bg-muted" />
      </div>
      <span className="mt-4 block h-3 w-full animate-pulse rounded bg-muted" />
      <span className="mt-2 block h-3 w-5/6 animate-pulse rounded bg-muted" />
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {Array.from({ length: 4 }, (_, offset) => (
          <span key={`${index}-${offset}`} className="h-8 animate-pulse rounded bg-muted" />
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
      className="min-w-0 rounded-md border bg-card/85 px-3 py-2.5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("h-5 rounded-sm px-1.5 text-[10px]", directionTone(opportunity.direction))}>
              {directionLabel(opportunity.direction, locale)}
            </Badge>
            <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px]">
              {confidenceLabel(opportunity.confidence, locale)}
            </Badge>
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold" title={text(opportunity.title, locale)}>
            {text(opportunity.title, locale)}
          </h3>
        </div>
        <p className={cn("shrink-0 text-2xl font-bold tabular-nums leading-7", scoreTone(opportunity.score, opportunity.direction))}>
          {opportunity.score}
        </p>
      </header>

      <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
        {text(opportunity.thesis, locale)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5">
          <Clock className="h-3 w-3" />
          {text(opportunity.horizon, locale)}
        </span>
        <span className="truncate rounded-sm bg-muted px-1.5 py-0.5">{opportunity.sourceCoverage}</span>
      </div>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {opportunity.evidence.slice(0, 4).map((item) => (
          <div key={`${item.label.en}-${item.value}`} className="min-w-0 rounded-sm border bg-background/60 px-2 py-1">
            <p className="truncate text-[9px] text-muted-foreground">{text(item.label, locale)}</p>
            <p className={cn("truncate text-[11px] font-semibold tabular-nums", evidenceTone(item.tone))}>{item.value}</p>
          </div>
        ))}
      </div>

      {opportunity.contradictions.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5 rounded-sm border border-amber-500/30 bg-amber-50/60 px-2 py-1.5 text-[10px] text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <p className="line-clamp-2">
            {opportunity.contradictions.map((item) => `${text(item.label, locale)} ${item.value}`).join(" · ")}
          </p>
        </div>
      )}

      <footer className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[9px] text-muted-foreground">
        <div className="flex min-w-0 flex-wrap gap-1">
          {opportunity.methods.slice(0, 4).map((method) => (
            <span key={method} className="rounded-sm bg-muted px-1.5 py-0.5">
              {methodLabel(method, locale)}
            </span>
          ))}
        </div>
        <span className="shrink-0">{formatUpdatedAt(opportunity.updatedAt, locale)}</span>
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
  const categories = getDataCategoriesForAssetClass(assetClass)
  const sourceItems = SOURCE_ROADMAP.filter((item) => categories.some((category) => category.id === item.category)).slice(0, 4)
  const emptyLabel = locale === "zh" ? "暂无足够数据生成机会卡片。" : "Not enough data to synthesize opportunity cards yet."

  return (
    <section className={cn("space-y-2", className)} data-opportunity-radar={assetClass}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold tracking-tight">{text(title, locale)}</h2>
          </div>
          <p className="mt-0.5 max-w-3xl text-[11px] leading-4 text-muted-foreground">{text(subtitle, locale)}</p>
        </div>
        <Badge variant="outline" className="h-6 rounded-sm px-2 text-[10px]">
          {locale === "zh" ? "研究驱动" : "Research-backed"}
        </Badge>
      </header>

      {loading && opportunities.length === 0 ? (
        <div className="grid gap-1.5 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <LoadingOpportunityCard key={index} index={index} />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-md border px-3 py-6 text-center text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="grid gap-1.5 lg:grid-cols-3">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      )}

      <div className="grid gap-1.5 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {categories.slice(0, 3).map((category) => (
            <CategoryPill key={category.id} category={category} />
          ))}
        </div>
        <div className="rounded-md border bg-card/70 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-semibold">{locale === "zh" ? "数据源路线" : "Source Roadmap"}</h3>
          </div>
          <div className="mt-2 grid gap-1">
            {sourceItems.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center justify-between gap-2 rounded-sm px-1.5 py-1 text-[10px] transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{item.title}</span>
                  {" "}
                  <span className="ml-1 text-muted-foreground">{text(item.useCase, locale)}</span>
                </span>
                <SourceStatusBadge status={item.status} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function MethodologySummaryStrip() {
  const { locale } = useI18n()
  const wired = SOURCE_ROADMAP.filter((item) => item.status === "wired").length
  const planned = SOURCE_ROADMAP.filter((item) => item.status === "planned").length
  return (
    <div className="grid gap-1.5 sm:grid-cols-3">
      <article className="rounded-md border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[11px] font-semibold">{locale === "zh" ? "方法库" : "Method Library"}</p>
        </div>
        <p className="mt-1 text-lg font-bold tabular-nums">{SIGNAL_METHOD_CATALOG.length}</p>
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
