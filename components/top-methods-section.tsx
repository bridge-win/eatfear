"use client"

import { useMemo, useState } from "react"
import { ExternalLink, ListChecks, TrendingDown, TrendingUp, Scale, Repeat } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n"
import {
  METHOD_CATEGORY_LABELS,
  PLAYBOOK_SUMMARIES,
  getTopMethodSummaries,
  type PlaybookSummary,
  type TopMethodSummary,
} from "@/lib/top-methods"
import type { PractitionerPriority } from "@/lib/research-corpus"
import { cn } from "@/lib/utils"

function priorityBadgeClass(priority: PractitionerPriority): string {
  if (priority === "P0") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (priority === "P1") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-border bg-muted/40 text-muted-foreground"
}

function directionMeta(direction: PlaybookSummary["direction"], locale: "zh" | "en") {
  switch (direction) {
    case "long":
      return { icon: <TrendingUp className="h-3.5 w-3.5" />, label: locale === "zh" ? "做多" : "Long", cls: "text-emerald-600 dark:text-emerald-400" }
    case "short":
      return { icon: <TrendingDown className="h-3.5 w-3.5" />, label: locale === "zh" ? "做空" : "Short", cls: "text-red-600 dark:text-red-400" }
    case "trim":
      return { icon: <Scale className="h-3.5 w-3.5" />, label: locale === "zh" ? "止盈减仓" : "Trim", cls: "text-orange-600 dark:text-orange-400" }
    default:
      return { icon: <Repeat className="h-3.5 w-3.5" />, label: locale === "zh" ? "程序化定投" : "Program", cls: "text-sky-600 dark:text-sky-400" }
  }
}

export function TopMethodsSection() {
  const { locale } = useI18n()
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const methods = useMemo(() => getTopMethodSummaries(), [])

  const categories = useMemo(() => {
    const seen: string[] = []
    for (const m of methods) if (!seen.includes(m.category)) seen.push(m.category)
    return seen
  }, [methods])

  const visible = activeCategory === "all" ? methods : methods.filter((m) => m.category === activeCategory)

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold">
          {locale === "zh" ? "百方法总览 · 每个方法怎么赚钱、怎么亏钱" : "Top 100 Methods · how each makes money, and how it loses it"}
        </h2>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {locale === "zh"
          ? "7 个可执行 Playbook(含进出场/仓位/失效规则,见 docs/PLAYBOOKS_SPEC.md)+ 100 个实战信号方法(按数据族分组,P0=优先)。每条同时给出盈利逻辑与失效方式——没有失效方式的方法不值得使用。非投资建议。"
          : "7 executable playbooks (full entry/exit/sizing/invalidation rules, see docs/PLAYBOOKS_SPEC.md) + 100 practitioner methods grouped by data family (P0 = highest priority). Every entry states both the edge and the failure mode — a method without a failure mode is not worth using. Not investment advice."}
      </p>

      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-foreground">
          {locale === "zh" ? "第一层 · 可执行 Playbook(带完整交易规则)" : "Tier 1 · Executable playbooks (complete trade rules)"}
        </h3>
        <div className="grid gap-1.5 md:grid-cols-2">
          {PLAYBOOK_SUMMARIES.map((pb) => {
            const t = locale === "zh" ? pb.zh : pb.en
            const dir = directionMeta(pb.direction, locale)
            return (
              <article key={pb.id} className="rounded-md border bg-card/80 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[12.5px] font-semibold">{t.name}</h4>
                  <span className={cn("flex shrink-0 items-center gap-1 text-[10px] font-medium", dir.cls)}>
                    {dir.icon}
                    {dir.label}
                    <Badge variant="outline" className="ml-1 px-1 py-0 text-[9px] uppercase">
                      {pb.status === "active"
                        ? locale === "zh" ? "已激活" : "active"
                        : locale === "zh" ? "候选·待回测" : "candidate"}
                    </Badge>
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{locale === "zh" ? "盈利逻辑:" : "Edge: "}</span>
                  {t.edge}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                  <span className="font-medium text-red-700 dark:text-red-400">{locale === "zh" ? "失效方式:" : "Fails when: "}</span>
                  {t.risk}
                </p>
              </article>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-foreground">
          {locale === "zh" ? "第二层 · 100 个实战信号方法" : "Tier 2 · 100 practitioner signal methods"}
        </h3>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10.5px] transition-colors",
              activeCategory === "all" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {locale === "zh" ? "全部" : "All"} · {methods.length}
          </button>
          {categories.map((category) => {
            const label = METHOD_CATEGORY_LABELS[category]
            const count = methods.filter((m) => m.category === category).length
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10.5px] transition-colors",
                  activeCategory === category ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label ? label[locale] : category} · {count}
              </button>
            )
          })}
        </div>

        <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((method: TopMethodSummary) => {
            const t = locale === "zh" ? method.zh : method.en
            const categoryLabel = METHOD_CATEGORY_LABELS[method.category]
            return (
              <article key={method.id} className="rounded-md border bg-card/60 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[12px] font-semibold leading-snug">{t.name}</h4>
                  <span className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline" className={cn("px-1 py-0 text-[9px]", priorityBadgeClass(method.priority))}>
                      {method.priority}
                    </Badge>
                    <a
                      href={method.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={locale === "zh" ? `${t.name} 数据来源` : `${t.name} source`}
                      className="text-muted-foreground/60 hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </div>
                <p className="text-[9.5px] uppercase tracking-wide text-muted-foreground/70">
                  {categoryLabel ? categoryLabel[locale] : method.category} · {method.id}
                </p>
                <p className="mt-1 text-[10.5px] leading-4.5 text-muted-foreground">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{locale === "zh" ? "赚:" : "Edge: "}</span>
                  {t.edge}
                </p>
                <p className="mt-0.5 text-[10.5px] leading-4.5 text-muted-foreground">
                  <span className="font-medium text-red-700 dark:text-red-400">{locale === "zh" ? "亏:" : "Fails: "}</span>
                  {t.risk}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
