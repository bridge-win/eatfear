"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { SiteHeader } from "@/components/site-header"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { MarketNewsArticle } from "@/lib/types"

interface NewsApiResponse {
  updatedAt: number
  source?: string
  articles: MarketNewsArticle[]
  error?: string
}

type ToneKind = "neutral" | "riskOn" | "riskOff"

const getToneKind = (tone?: number): ToneKind => {
  if (tone === undefined) return "neutral"
  if (tone <= -2) return "riskOff"
  if (tone >= 2) return "riskOn"
  return "neutral"
}

const getToneVariant = (kind: ToneKind): "default" | "secondary" | "destructive" => {
  if (kind === "riskOff") return "destructive"
  if (kind === "riskOn") return "default"
  return "secondary"
}

const cryptoKeywords = ["bitcoin", "btc", "ethereum", "eth", "crypto", "stablecoin", "blockchain", "defi", "solana"]

const isCryptoArticle = (article: MarketNewsArticle) => {
  const haystack = `${article.title} ${article.domain}`.toLowerCase()
  return cryptoKeywords.some((keyword) => haystack.includes(keyword))
}

export function NewsDashboard() {
  const [articles, setArticles] = useState<MarketNewsArticle[]>([])
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [source, setSource] = useState<string>("Yahoo Finance + CoinDesk + Federal Reserve")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { locale, t } = useI18n()
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US"

  useEffect(() => {
    let isActive = true

    async function loadNews() {
      try {
        const response = await fetch("/api/news")
        const payload = (await response.json()) as NewsApiResponse

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load market news")
        }

        if (!isActive) return

        setArticles(payload.articles)
        setUpdatedAt(payload.updatedAt)
        setSource(payload.source ?? "Yahoo Finance + CoinDesk + Federal Reserve")
        setError(null)
      } catch (requestError) {
        if (isActive) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load market news")
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadNews()
    const interval = setInterval(loadNews, 5 * 60 * 1000)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [])

  const topDomains = useMemo(() => {
    const counts = articles.reduce<Record<string, number>>((accumulator, article) => {
      accumulator[article.domain] = (accumulator[article.domain] ?? 0) + 1
      return accumulator
    }, {})

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [articles])
  const cryptoArticleCount = useMemo(() => articles.filter(isCryptoArticle).length, [articles])

  const toneLabelFor = (kind: ToneKind) =>
    kind === "riskOn"
      ? t("news.tone.riskOn")
      : kind === "riskOff"
        ? t("news.tone.riskOff")
        : t("news.tone.neutral")

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-3">
        <div className="space-y-3">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{t("news.title")}</h1>
              <p className="mt-0.5 max-w-4xl text-[11px] text-muted-foreground">{t("news.subtitle")}</p>
            </div>
            <div className="rounded-full border px-3 py-1 text-[11px] text-muted-foreground">
              {updatedAt
                ? t("news.updated", { time: new Date(updatedAt).toLocaleString(dateLocale) })
                : t("news.loading")}
            </div>
          </header>

          {error && (
            <Card className="border-destructive/40">
              <CardContent className="pt-4 text-xs text-destructive">{error}</CardContent>
            </Card>
          )}

          {isLoading && articles.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              {t("news.loading")}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
              <div className="space-y-2">
                {articles.length === 0 ? (
                  <Card>
                    <CardContent className="pt-4 text-xs text-muted-foreground">{t("news.empty")}</CardContent>
                  </Card>
                ) : (
                  articles.map((article) => {
                    const kind = getToneKind(article.tone)
                    return (
                      <a key={article.url} href={article.url} target="_blank" rel="noreferrer" className="block">
                        <Card className="py-2.5 transition-shadow hover:shadow-md">
                          <CardContent className="p-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Badge variant={getToneVariant(kind)} className="h-4 px-1.5 text-[9px]">
                                {toneLabelFor(kind)}
                              </Badge>
                              {isCryptoArticle(article) && (
                                <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                                  Crypto
                                </Badge>
                              )}
                              <span>{article.domain}</span>
                              <span>{article.sourceCountry}</span>
                              <span>{new Date(article.publishedAt).toLocaleString(dateLocale)}</span>
                            </div>
                            <div className="mt-1.5 flex items-start justify-between gap-3">
                              <h2 className="text-sm font-semibold leading-snug">{article.title}</h2>
                              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    )
                  })
                )}
              </div>

              <aside className="space-y-2">
                <Card className="py-2.5">
                  <CardHeader className="px-3 pb-1">
                    <CardTitle className="flex items-center gap-1.5 text-xs">
                      <Newspaper className="h-3.5 w-3.5" />
                      {t("news.feedSummary")}
                      <InfoTooltip title={t("news.toneTitle")} description={t("news.toneDesc")} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 text-xs">
                    <SummaryRow label={t("news.row.source")} value={source} />
                    <SummaryRow label={t("news.row.articles")} value={articles.length} />
                    <SummaryRow label={t("news.row.crypto")} value={cryptoArticleCount} />
                    <SummaryRow label={t("news.row.refresh")} value="5 min" border={false} />
                  </CardContent>
                </Card>

                <Card className="py-2.5">
                  <CardHeader className="px-3 pb-1">
                    <CardTitle className="text-xs">{t("news.topSources")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 px-3 text-xs">
                    {topDomains.length === 0 ? (
                      <p className="text-muted-foreground">{t("news.noSourceData")}</p>
                    ) : (
                      topDomains.map(([domain, count]) => (
                        <div
                          key={domain}
                          className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5"
                        >
                          <span className="truncate">{domain}</span>
                          <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                            {count}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  border = true,
}: {
  label: string
  value: string | number
  border?: boolean
}) {
  return (
    <div className={cn("flex justify-between gap-3", border && "border-b pb-1.5")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  )
}
