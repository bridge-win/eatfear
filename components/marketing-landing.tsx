"use client"

import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Database,
  ExternalLink,
  LineChart,
  Radar,
  ShieldCheck,
  Waypoints,
} from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { InfoPopover } from "@/components/info-popover"
import { AppFrame } from "@/components/page-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useI18n, type Locale } from "@/lib/i18n"
import {
  CORE_SOURCE_GROUPS,
  RESEARCH_CORPUS_STATS,
  SIGNAL_LAYERS,
  getPapersByFamily,
  getTopPractitionerMethods,
  type PractitionerPriority,
  type SignalLayer,
} from "@/lib/research-corpus"
import { cn } from "@/lib/utils"

type Copy = Record<Locale, string>

const heroCopy: Record<string, Copy> = {
  eyebrow: { zh: "交易机会信号中枢", en: "Trading Opportunity Signal Hub" },
  subtitle: {
    zh: "把 136 篇顶级论文、100 个实战信号方法、实时行情、宏观、链上、衍生品和风险控制合成一套可解释的交易机会框架。",
    en: "A research-backed signal workspace combining 136 papers, 100 practitioner methods, live markets, macro, on-chain, derivatives, and risk controls.",
  },
  primary: { zh: "打开加密信号", en: "Open crypto signals" },
  secondary: { zh: "查看方法论", en: "View methodology" },
}

const workflowSteps: readonly { title: Copy; body: Copy; icon: typeof Radar }[] = [
  {
    title: { zh: "先看机会雷达", en: "Start with Opportunity Radar" },
    body: {
      zh: "只把趋势、流动性、杠杆、估值和反证项同时满足的组合提升为机会卡。",
      en: "Only setups where trend, liquidity, leverage, valuation, and contradictions line up become opportunity cards.",
    },
    icon: Radar,
  },
  {
    title: { zh: "再点指标右上角 info", en: "Then open each info icon" },
    body: {
      zh: "每个指标解释数据源、适用周期、影响方向、失效场景和不能单独交易的原因。",
      en: "Every indicator explains source, horizon, directional read, failure mode, and why it is not a standalone trigger.",
    },
    icon: BookOpen,
  },
  {
    title: { zh: "最后用风险层定仓位", en: "Finish with the risk layer" },
    body: {
      zh: "高分信号仍然先过波动率、滑点、强平距离、事件日和反证项，再决定是否执行。",
      en: "Even high scores pass through volatility, slippage, liquidation distance, event risk, and contradiction checks first.",
    },
    icon: ShieldCheck,
  },
] as const

const routeTiles: readonly { href: string; title: Copy; body: Copy; icon: typeof BarChart3 }[] = [
  {
    href: "/crypto",
    title: { zh: "加密", en: "Crypto" },
    body: { zh: "BTC/ETH/SOL 等趋势、OI、Funding、Basis、稳定币、链上、期权和插针信号。", en: "Trend, OI, funding, basis, stablecoins, on-chain, options, and wick signals." },
    icon: BarChart3,
  },
  {
    href: "/stock",
    title: { zh: "股票", en: "Stock" },
    body: { zh: "美股、港股、越南概念股、因子 ETF、信用、美元、利率和广度。", en: "US/HK/Vietnam names, factor ETFs, credit, dollar, rates, and breadth." },
    icon: LineChart,
  },
  {
    href: "/macro",
    title: { zh: "宏观", en: "Macro" },
    body: { zh: "FRED、收益率、通胀、M2、信用、美元、就业、PMI、商品和跨资产风险。", en: "FRED, yields, inflation, M2, credit, dollar, labor, PMI, commodities, and cross-asset risk." },
    icon: Database,
  },
] as const

function text(copy: Copy, locale: Locale): string {
  return copy[locale]
}

function priorityClass(priority: PractitionerPriority): string {
  if (priority === "P0") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
  if (priority === "P1") return "border-amber-500/40 text-amber-700 dark:text-amber-300"
  return "border-slate-500/40 text-muted-foreground"
}

function statusClass(status: "wired" | "planned" | "research"): string {
  if (status === "wired") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
  if (status === "planned") return "border-amber-500/40 text-amber-700 dark:text-amber-300"
  return "border-blue-500/40 text-blue-700 dark:text-blue-300"
}

function statusLabel(status: "wired" | "planned" | "research", locale: Locale): string {
  if (status === "wired") return locale === "zh" ? "已接入" : "Wired"
  if (status === "planned") return locale === "zh" ? "计划接入" : "Planned"
  return locale === "zh" ? "研究中" : "Research"
}

function LayerRow({ layer, locale, index }: { layer: SignalLayer; locale: Locale; index: number }) {
  const papers = layer.primaryFamilies.flatMap((family) => getPapersByFamily(family, 1)).slice(0, 3)
  return (
    <article className="grid min-w-0 gap-3 border-t py-4 first:border-t-0 md:grid-cols-[9rem_1fr_12rem]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">L{index + 1}</span>
        <div>
          <h3 className="text-sm font-semibold leading-5">{layer.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {layer.primaryFamilies.map((family) => (
              <span key={family} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {family}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{layer.description}</p>
      <div className="flex items-start justify-between gap-2 md:justify-end">
        <p className="max-w-40 text-[10px] leading-4 text-muted-foreground md:text-right">{layer.actionRule}</p>
        <InfoPopover
          title={layer.title}
          description={[
            "Data sources:",
            ...layer.dataSources.map((source) => `- ${source}`),
            "",
            "Research anchors:",
            ...papers.map((paper) => `- ${paper.title} (${paper.year})`),
          ].join("\n")}
          source="Research corpus"
          className="mt-0.5"
        />
      </div>
    </article>
  )
}

export default function MarketingLanding() {
  const { locale } = useI18n()
  const topMethods = getTopPractitionerMethods(8)
  const visibleSources = CORE_SOURCE_GROUPS.slice(0, 8)

  return (
    <AppFrame className="bg-background">
      <main>
        <section className="border-b">
          <div className="container mx-auto grid min-h-[calc(100svh-3rem)] gap-6 px-4 py-6 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div className="max-w-2xl">
              <Badge variant="outline" className="rounded-sm px-2 py-1 text-[10px]">
                {text(heroCopy.eyebrow, locale)}
              </Badge>
              <h1 className="mt-4 text-5xl leading-none sm:text-6xl lg:text-7xl">
                <BrandLogo markClassName="h-[0.82em] w-[0.82em]" />
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                {text(heroCopy.subtitle, locale)}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/crypto">
                  <Button className="h-9 gap-2 rounded-md px-3 text-sm">
                    {text(heroCopy.primary, locale)}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/methodology">
                  <Button variant="outline" className="h-9 gap-2 rounded-md px-3 text-sm">
                    {text(heroCopy.secondary, locale)}
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: locale === "zh" ? "论文" : "Papers", value: RESEARCH_CORPUS_STATS.paperCount },
                  { label: locale === "zh" ? "实战方法" : "Playbooks", value: RESEARCH_CORPUS_STATS.practitionerMethodCount },
                  { label: locale === "zh" ? "P0 信号" : "P0 Signals", value: RESEARCH_CORPUS_STATS.p0PractitionerMethodCount },
                  { label: locale === "zh" ? "数据源" : "Sources", value: RESEARCH_CORPUS_STATS.sourceGroupCount },
                ].map((item) => (
                  <div key={item.label} className="border-t pt-2">
                    <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 border bg-card/50 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b pb-3">
                <div className="flex items-center gap-2">
                  <Waypoints className="h-4 w-4 text-primary" />
                  <div>
                    <h2 className="text-sm font-semibold">{locale === "zh" ? "信号工作台" : "Signal Workbench"}</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {locale === "zh" ? "从证据到执行的 6 层过滤" : "Six filters from evidence to execution"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-sm px-1.5 text-[10px]">
                  {locale === "zh" ? "研究驱动" : "Research-backed"}
                </Badge>
              </div>
              <div className="divide-y">
                {SIGNAL_LAYERS.map((layer, index) => (
                  <LayerRow key={layer.id} layer={layer} locale={locale} index={index} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-muted/20">
          <div className="container mx-auto px-4 py-6">
            <div className="grid gap-3 lg:grid-cols-3">
              {workflowSteps.map((step) => {
                const Icon = step.icon
                return (
                  <article key={text(step.title, locale)} className="border bg-background px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold">{text(step.title, locale)}</h2>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{text(step.body, locale)}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-4 py-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">{locale === "zh" ? "进入对应市场" : "Open the right market"}</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {routeTiles.map((tile) => {
                const Icon = tile.icon
                return (
                  <Link
                    key={tile.href}
                    href={tile.href}
                    className="group grid gap-3 border bg-card/60 px-3 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[1.5rem_1fr_auto]"
                  >
                    <Icon className="mt-0.5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                    <div>
                      <h3 className="text-sm font-semibold">{text(tile.title, locale)}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text(tile.body, locale)}</p>
                    </div>
                    <ArrowRight className="hidden h-4 w-4 self-center text-muted-foreground group-hover:text-foreground sm:block" />
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">{locale === "zh" ? "优先实战信号" : "Priority playbooks"}</h2>
              </div>
              <div className="mt-3 divide-y border bg-card/60">
                {topMethods.map((method) => (
                  <a
                    key={method.id}
                    href={method.url}
                    target="_blank"
                    rel="noreferrer"
                    className="grid gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{method.method}</p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{method.source} · {method.category}</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-sm px-1.5 text-[10px]", priorityClass(method.priority))}>
                        {method.priority}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">{method.interpretation}</p>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">{locale === "zh" ? "数据源路线" : "Data source map"}</h2>
              </div>
              <div className="mt-3 divide-y border bg-card/60">
                {visibleSources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="grid gap-1 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold">{source.title}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="outline" className={cn("rounded-sm px-1.5 text-[10px]", statusClass(source.status))}>
                          {statusLabel(source.status, locale)}
                        </Badge>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">{source.useCase}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppFrame>
  )
}
