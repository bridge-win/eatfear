"use client"

import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Coins,
  Database,
  ExternalLink,
  Globe,
  Shield,
  Zap,
} from "lucide-react"

import { AppFrame } from "@/components/page-frame"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"
import { SOURCE_ROADMAP, type LocalizedText } from "@/lib/opportunity-engine"

function t(value: LocalizedText, locale: "zh" | "en"): string {
  return value[locale]
}

function statusBadgeClass(status: "wired" | "planned" | "research"): string {
  if (status === "wired") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "planned") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
}

function statusLabel(status: "wired" | "planned" | "research", locale: "zh" | "en"): string {
  if (locale === "zh") {
    if (status === "wired") return "已接入"
    if (status === "planned") return "计划接入"
    return "研究"
  }
  if (status === "wired") return "Wired"
  if (status === "planned") return "Planned"
  return "Research"
}

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  price: { zh: "行情价格", en: "Market Price" },
  derivatives: { zh: "衍生品与杠杆", en: "Derivatives & Leverage" },
  macro: { zh: "跨资产宏观", en: "Cross-Asset Macro" },
  futures_fundamental: { zh: "期货基本面", en: "Futures Fundamentals" },
  equity_fundamental: { zh: "股票基本面", en: "Equity Fundamentals" },
  crypto_native: { zh: "加密原生数据", en: "Crypto-Native Data" },
  text_sentiment: { zh: "文本与情绪", en: "Text & Sentiment" },
}

interface PillarBullet {
  text: { zh: string; en: string }
}

interface SignalPillar {
  icon: React.ReactNode
  title: { zh: string; en: string }
  bullets: PillarBullet[]
  sources: { zh: string; en: string }
}

const SIGNAL_PILLARS: SignalPillar[] = [
  {
    icon: <Coins className="h-5 w-5 text-amber-500" />,
    title: { zh: "链上周期", en: "On-Chain Cycle" },
    bullets: [
      {
        text: {
          zh: "Mayer Multiple：历史周期低点约 0.41–0.51；>2.4 进入峰值区间",
          en: "Mayer Multiple: cycle lows historically near 0.41–0.51; >2.4 = peak zone",
        },
      },
      {
        text: {
          zh: "Puell Multiple：<0.5 = 矿工投降区间；>4 = 矿工收入峰值",
          en: "Puell Multiple: <0.5 = miner capitulation zone; >4 = revenue peak",
        },
      },
      {
        text: {
          zh: "MVRV Z-Score：<0 = 历史吸引区间；>7 = 峰值高风险",
          en: "MVRV Z-Score: <0 = historically attractive; >7 = peak risk",
        },
      },
    ],
    sources: { zh: "信号来源：Glassnode、Coin Metrics（计划）", en: "Signals: Glassnode, Coin Metrics (planned)" },
  },
  {
    icon: <BarChart3 className="h-5 w-5 text-violet-500" />,
    title: { zh: "衍生品与拥挤度", en: "Derivatives & Crowding" },
    bullets: [
      {
        text: {
          zh: "资金费率：>0.1%/8h = 极端多头拥挤；<−0.01%/8h = 空头集中 / 恐慌",
          en: "Funding rate: >0.1%/8h = extreme long crowding; <−0.01%/8h = fear/shorts pile in",
        },
      },
      {
        text: {
          zh: "多空比：>70% 多头 / >4:1 = 极端拥挤；期货贴水 = 罕见底部信号",
          en: "L/S ratio: >70% long / >4:1 = extreme crowding; backwardation = rare bottom signal",
        },
      },
      {
        text: {
          zh: "Basis（年化）：2024年2月峰值 25%；2025年末跌至 4.5%；负值 = 恐慌",
          en: "Basis (annualized): peaked 25% Feb 2024; collapsed to 4.5% late 2025; negative = fear",
        },
      },
    ],
    sources: { zh: "信号来源：OKX（已接入）、CoinGlass（计划）", en: "Signals: OKX (wired), CoinGlass (planned)" },
  },
  {
    icon: <Globe className="h-5 w-5 text-sky-500" />,
    title: { zh: "跨资产宏观", en: "Cross-Asset Macro" },
    bullets: [
      {
        text: {
          zh: "BTC–纳指相关性：峰值 0.87；宏观压力期飙升；加密特有事件时断裂",
          en: "BTC–Nasdaq correlation: peaked 0.87; spikes during macro stress; breaks in crypto-specific events",
        },
      },
      {
        text: {
          zh: "DXY 反向：滚动相关 −0.72；EM 危机时断裂；DXY 下跌 10% 历史上为 BTC 强顺风",
          en: "DXY inverse: rolling −0.72 correlation; breaks in EM crises; 10% DXY drop = strong BTC tailwind",
        },
      },
      {
        text: {
          zh: "VIX >40 = 股票长期视角历史机会；HY 利差 >800bps = 真实困境；>1000bps = 恐慌",
          en: "VIX >40 = historically attractive for equities long-horizon; HY Spread >800bps = real distress; >1000bps = panic",
        },
      },
    ],
    sources: { zh: "信号来源：FRED（已接入）、Yahoo Finance（已接入）", en: "Signals: FRED (wired), Yahoo Finance (wired)" },
  },
  {
    icon: <Brain className="h-5 w-5 text-rose-500" />,
    title: { zh: "情绪与关注度", en: "Sentiment & Attention" },
    bullets: [
      {
        text: {
          zh: "恐慌贪婪指数：<20 = 极度恐慌；历史上极度恐慌后 BTC 30日均值回报为正",
          en: "Fear & Greed: <20 = extreme fear; BTC +mean 30d return positive after extreme fear historically",
        },
      },
      {
        text: {
          zh: "ETF 净流量：日流量与 BTC 相关性约 0.73；多日累计信号比单日更可靠",
          en: "ETF net flows: daily correlation ~0.73 with BTC; multi-day cumulative more reliable than single-day",
        },
      },
      {
        text: {
          zh: "看跌/看涨比：股票 PCR >1.2 = 对冲高峰；AAII 看跌 >50% = 反向买入信号",
          en: "Put/Call ratio: equity PCR >1.2 = hedging climax; AAII bearish >50% = contrarian buy signal",
        },
      },
    ],
    sources: { zh: "信号来源：Alternative.me、CoinGlass（计划）", en: "Signals: Alternative.me, CoinGlass (planned)" },
  },
]

interface Citation {
  authors: string
  title: string
  url: string
  signal: { zh: string; en: string }
  note: { zh: string; en: string }
}

const CITATIONS: Citation[] = [
  {
    authors: "Moskowitz, Ooi, Pedersen (2012)",
    title: "Time Series Momentum",
    url: "https://www.aqr.com/insights/research/journal-article/time-series-momentum",
    signal: { zh: "CTA 趋势跟随基础", en: "CTA trend following basis" },
    note: {
      zh: "跨期货市场验证自身趋势延续",
      en: "Cross-futures evidence for own-trend persistence",
    },
  },
  {
    authors: "Asness, Moskowitz, Pedersen (2013)",
    title: "Value and Momentum Everywhere",
    url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1363476",
    signal: { zh: "跨资产因子", en: "Cross-asset factors" },
    note: {
      zh: "价值与动量在各资产类别中普遍存在",
      en: "Value and momentum appear across all major asset classes",
    },
  },
  {
    authors: "Koijen, Moskowitz, Pedersen, Vrugt (2018)",
    title: "Carry",
    url: "https://www.nber.org/papers/w19325",
    signal: { zh: "各类资产的 Carry", en: "Carry across asset classes" },
    note: {
      zh: "Carry 在股票、债券、商品、信用、期权中均有解释力",
      en: "Carry explains expected returns across equities, bonds, commodities, credit, options",
    },
  },
  {
    authors: "Liu & Tsyvinski (2021)",
    title: "Risks and Returns of Cryptocurrency",
    url: "https://www.nber.org/papers/w25882",
    signal: { zh: "动量 + 关注度", en: "Momentum + attention" },
    note: {
      zh: "加密资产收益与动量、投资者关注度相关",
      en: "Crypto returns relate to momentum and investor attention, not only traditional macro",
    },
  },
  {
    authors: "BIS Working Paper 1087",
    title: "Crypto carry and funding rate dynamics",
    url: "https://www.bis.org/publ/work1087.htm",
    signal: { zh: "资金费率 Carry", en: "Funding rate carry" },
    note: {
      zh: "永续资金费率平均年化 ~7-8%；>0.1%/8h 标志拥挤",
      en: "Perp funding averages ~7-8% APY long-run; >0.1%/8h marks crowding",
    },
  },
  {
    authors: "Chi et al (2023, JFM)",
    title: "Basis-Momentum Factor in Crypto Futures",
    url: "https://doi.org/10.1002/fut.22457",
    signal: { zh: "Basis-Momentum 因子", en: "Basis-Momentum factor" },
    note: {
      zh: "高 basis-momentum 做多做空组合年化 ~222%",
      en: "High-basis-momentum long-short achieved ~222% annualized — strongest cross-sectional factor",
    },
  },
  {
    authors: "Harvey, Liu, Zhu (2016)",
    title: "…and the Cross-Section of Expected Returns",
    url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2249314",
    signal: { zh: "多重检验风险", en: "Multiple-testing risk" },
    note: {
      zh: "因子挖掘存在多重检验问题，信号须附验证状态",
      en: "Factor discovery suffers from multiple-testing bias; signals need validation metadata",
    },
  },
  {
    authors: "Bailey & Lopez de Prado",
    title: "The Deflated Sharpe Ratio",
    url: "https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf",
    signal: { zh: "回测选择偏差", en: "Backtest selection bias" },
    note: {
      zh: "识别多次试验后膨胀的夏普比率幻觉",
      en: "Flags selection bias and inflated Sharpe ratios after multiple trials",
    },
  },
]

interface ThresholdRow {
  signal: string
  watch: string
  elevated: string
  extreme: string
}

const THRESHOLD_ROWS: ThresholdRow[] = [
  { signal: "VIX", watch: "20", elevated: "30", extreme: "40" },
  { signal: "HY Spread", watch: "—", elevated: "550bps", extreme: "800bps" },
  { signal: "SPX Drawdown", watch: "—", elevated: "−20%", extreme: "−30%" },
  { signal: "BTC Funding", watch: "±0.03%/8h", elevated: "±0.07%/8h", extreme: "±0.10%/8h" },
  { signal: "BTC Mayer", watch: "—", elevated: "<0.7", extreme: "<0.5" },
  { signal: "Fear & Greed", watch: "<30", elevated: "<20", extreme: "<10" },
]

export default function AnalysisFramework() {
  const { locale } = useI18n()

  const categorizedSources = SOURCE_ROADMAP.reduce<Record<string, typeof SOURCE_ROADMAP[number][]>>((acc, item) => {
    const key = item.category
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <AppFrame>
      <main className="container mx-auto px-4 py-6">
        <div className="space-y-8">

          {/* Section 1: Hero */}
          <header className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {locale === "zh" ? "框架概览" : "Framework Overview"}
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  {locale === "zh" ? "市场分析框架" : "Market Analysis Framework"}
                </h1>
              </div>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {locale === "zh"
                ? "基于研究验证的 BTC 和美股市场状态追踪框架 — 融合链上周期、衍生品拥挤度、跨资产宏观 regime 和情绪信号。"
                : "A research-backed system for tracking Bitcoin and US equity market conditions — combining on-chain cycle positioning, derivatives crowding, cross-asset macro regime, and sentiment signals."}
            </p>
          </header>

          {/* Section 2: Four signal pillars */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {locale === "zh" ? "信号体系" : "Signal System"}
                </p>
                <h2 className="text-base font-bold">
                  {locale === "zh" ? "四大信号支柱" : "Four Signal Pillars"}
                </h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {SIGNAL_PILLARS.map((pillar, i) => (
                <Card key={i} className="rounded-lg border bg-card/80 py-0">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      {pillar.icon}
                      {t(pillar.title, locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <ul className="space-y-1.5">
                      {pillar.bullets.map((bullet, j) => (
                        <li key={j} className="flex gap-2 text-xs text-muted-foreground leading-5">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                          {t(bullet.text, locale)}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border/50">
                      {t(pillar.sources, locale)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Section 3: Academic citations */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {locale === "zh" ? "学术依据" : "Academic Foundation"}
                </p>
                <h2 className="text-base font-bold">
                  {locale === "zh" ? "研究基础" : "Research Foundation"}
                </h2>
              </div>
            </div>
            <div className="rounded-lg border bg-card/80 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                      {locale === "zh" ? "引用" : "Citation"}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground hidden sm:table-cell">
                      {locale === "zh" ? "关键信号" : "Key Signal"}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground hidden md:table-cell">
                      {locale === "zh" ? "置信说明" : "Confidence Note"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CITATIONS.map((citation, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 align-top">
                        <div className="space-y-0.5">
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
                          >
                            {citation.title}
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                          <p className="text-[10px] text-muted-foreground">{citation.authors}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top hidden sm:table-cell">
                        <span className="text-muted-foreground">{t(citation.signal, locale)}</span>
                      </td>
                      <td className="px-3 py-2.5 align-top hidden md:table-cell">
                        <span className="text-muted-foreground leading-5">{t(citation.note, locale)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Data Sources catalog */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {locale === "zh" ? "数据层" : "Data Layer"}
                </p>
                <h2 className="text-base font-bold">
                  {locale === "zh" ? "数据源路线图" : "Data Source Roadmap"}
                </h2>
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(categorizedSources).map(([category, sources]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {CATEGORY_LABELS[category]?.[locale] ?? category}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-lg border bg-card/80 px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium hover:text-primary inline-flex items-center gap-1 transition-colors leading-5"
                          >
                            {source.title}
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${statusBadgeClass(source.status)}`}
                          >
                            {statusLabel(source.status, locale)}
                          </Badge>
                        </div>
                        <p className="text-[10px] leading-4 text-muted-foreground">
                          {source.useCase[locale]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Practitioner Signal Thresholds */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {locale === "zh" ? "实操参考" : "Practitioner Reference"}
                </p>
                <h2 className="text-base font-bold">
                  {locale === "zh" ? "信号阈值速查表" : "Signal Thresholds Quick Reference"}
                </h2>
              </div>
            </div>
            <div className="rounded-lg border bg-card/80 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                      {locale === "zh" ? "信号" : "Signal"}
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                      {locale === "zh" ? "关注" : "Watch"}
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-amber-600 dark:text-amber-400">
                      {locale === "zh" ? "偏高" : "Elevated"}
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-rose-600 dark:text-rose-400">
                      {locale === "zh" ? "极端" : "Extreme"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {THRESHOLD_ROWS.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-medium">{row.signal}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{row.watch}</td>
                      <td className="px-3 py-2 text-center text-amber-600 dark:text-amber-400 font-medium">
                        {row.elevated}
                      </td>
                      <td className="px-3 py-2 text-center text-rose-600 dark:text-rose-400 font-medium">
                        {row.extreme}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 6: Footer disclaimer */}
          <footer className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
            <p className="text-[11px] leading-5 text-muted-foreground">
              {locale === "zh"
                ? "信号阈值来源于历史数据分析。历史条件不保证未来收益。请将其作为概率性框架使用，而非择时系统。"
                : "Signal thresholds are derived from historical analysis. Past conditions do not guarantee future returns. Use as a probabilistic framework, not a timing system."}
            </p>
          </footer>

        </div>
      </main>
    </AppFrame>
  )
}
