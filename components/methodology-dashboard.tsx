"use client"

import { BookOpen, CheckCircle2, Database, ExternalLink, FlaskConical, ShieldCheck } from "lucide-react"

import { MethodologySummaryStrip } from "@/components/opportunity-radar"
import { Badge } from "@/components/ui/badge"
import { AppFrame } from "@/components/page-frame"
import {
  DATA_CATEGORY_CATALOG,
  SIGNAL_METHOD_CATALOG,
  SOURCE_ROADMAP,
  getValidationChecklist,
  type LocalizedText,
} from "@/lib/opportunity-engine"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function text(value: LocalizedText, locale: "zh" | "en"): string {
  return value[locale]
}

function statusLabel(status: "wired" | "planned" | "research", locale: "zh" | "en"): string {
  if (status === "wired") return locale === "zh" ? "已接入" : "Wired"
  if (status === "planned") return locale === "zh" ? "计划接入" : "Planned"
  return locale === "zh" ? "研究" : "Research"
}

function statusClass(status: "wired" | "planned" | "research"): string {
  if (status === "wired") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
  if (status === "planned") return "border-amber-500/40 text-amber-700 dark:text-amber-300"
  return "border-blue-500/40 text-blue-700 dark:text-blue-300"
}

interface ResearchCitation {
  authors: string
  title: string
  url: string
  note: { zh: string; en: string }
}

const RESEARCH_CITATIONS: ResearchCitation[] = [
  {
    authors: "Liu, Tsyvinski, Wu (2022, JoF)",
    title: "Common Risk Factors in Cryptocurrency",
    url: "https://doi.org/10.1111/jofi.13119",
    note: {
      zh: "CMKT、CSMB、CMOM 三因子解释加密横截面收益。",
      en: "CMKT, CSMB, and CMOM capture crypto cross-sectional returns.",
    },
  },
  {
    authors: "Grobys, Näsman, Sandretto (2026, RIBF)",
    title: "Using on-chain data to predict Bitcoin cycles",
    url: "https://doi.org/10.1016/j.ribaf.2026.103486",
    note: {
      zh: "同行评审验证 NUPL、MVRV Z-Score、CVDD；链上阈值仍需按周期衰减处理。",
      en: "Peer-reviewed evidence on NUPL, MVRV Z-Score, and CVDD; thresholds still need cycle-decay treatment.",
    },
  },
  {
    authors: "Gilchrist & Zakrajšek (2012, AER)",
    title: "Credit Spreads and Business Cycle Fluctuations",
    url: "https://doi.org/10.1257/aer.102.4.1692",
    note: {
      zh: "Excess Bond Premium 对衰退预测强，但不适合精确底部择时。",
      en: "Excess Bond Premium is strong for recession prediction, but weak for exact bottom timing.",
    },
  },
  {
    authors: "Lopez-Salido, Stein, Zakrajšek (2017, QJE)",
    title: "Credit-Market Sentiment and the Business Cycle",
    url: "https://doi.org/10.1093/qje/qjx014",
    note: {
      zh: "过低信用利差往往预示未来增长恶化，而非即时底部信号。",
      en: "Low credit spreads can predict later deterioration, not immediate bottom timing.",
    },
  },
]

export function MethodologyDashboard() {
  const { locale } = useI18n()

  return (
    <AppFrame>
      <main className="container mx-auto px-4 py-4">
        <div className="space-y-4">
          <header className="max-w-4xl">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">
                {locale === "zh" ? "交易机会方法论" : "Trading Opportunity Methodology"}
              </h1>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {locale === "zh"
                ? "把基金经理、CTA、量化交易和期货基本面常用数据组织成可解释的机会评分框架。所有信号都要求来源、周期、反证和验证纪律。"
                : "Organizes fund-manager, CTA, quant, and futures-fundamental data into explainable opportunity scoring. Every signal requires source, horizon, contradictions, and validation discipline."}
            </p>
          </header>

          <MethodologySummaryStrip />

          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">{locale === "zh" ? "研究置信依据" : "Research Confidence References"}</h2>
            </div>
            <div className="grid gap-1.5 md:grid-cols-2">
              {RESEARCH_CITATIONS.map((citation) => (
                <a
                  key={citation.url}
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border bg-card/80 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{citation.title}</h3>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{citation.authors}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{citation.note[locale]}</p>
                </a>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">{locale === "zh" ? "基础数据分类" : "Foundational Data Classes"}</h2>
            </div>
            <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {DATA_CATEGORY_CATALOG.map((category) => (
                <article key={category.id} className="rounded-md border bg-card/80 px-3 py-2.5">
                  <h3 className="text-sm font-semibold">{text(category.title, locale)}</h3>
                  <p className="mt-1 min-h-10 text-[11px] leading-5 text-muted-foreground">{text(category.purpose, locale)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {category.examples.slice(0, 5).map((example) => (
                      <span key={example} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {example}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">{locale === "zh" ? "分析方法库" : "Analysis Method Library"}</h2>
            </div>
            <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
              {SIGNAL_METHOD_CATALOG.map((method) => (
                <article key={method.id} className="rounded-md border bg-card/80 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{text(method.title, locale)}</h3>
                    <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px]">
                      {text(method.horizon, locale)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text(method.purpose, locale)}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{text(method.implementation, locale)}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {method.references.slice(0, 2).map((reference) => (
                      <a
                        key={reference.url}
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-w-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <span className="truncate">{reference.title}</span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold">{locale === "zh" ? "数据源路线" : "Source Roadmap"}</h2>
              </div>
              <div className="grid gap-1.5 md:grid-cols-2">
                {SOURCE_ROADMAP.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border bg-card/80 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{source.title}</h3>
                      <Badge variant="outline" className={cn("h-5 rounded-sm px-1.5 text-[10px]", statusClass(source.status))}>
                        {statusLabel(source.status, locale)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text(source.useCase, locale)}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold">{locale === "zh" ? "验证纪律" : "Validation Discipline"}</h2>
              </div>
              <div className="rounded-md border bg-card/80 px-3 py-2.5">
                <div className="space-y-2">
                  {getValidationChecklist().map((item) => (
                    <div key={item.en} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <p className="text-[11px] leading-5 text-muted-foreground">{text(item, locale)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AppFrame>
  )
}
