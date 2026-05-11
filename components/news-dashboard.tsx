"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"
import type { MarketNewsArticle } from "@/lib/types"

interface NewsApiResponse {
  updatedAt: number
  source?: string
  articles: MarketNewsArticle[]
  error?: string
}

const getToneLabel = (tone?: number) => {
  if (tone === undefined) return "Neutral"
  if (tone <= -2) return "Risk-off"
  if (tone >= 2) return "Risk-on"
  return "Neutral"
}

const getToneVariant = (tone?: number): "default" | "secondary" | "destructive" => {
  if (tone === undefined) return "secondary"
  if (tone <= -2) return "destructive"
  if (tone >= 2) return "default"
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

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-3">
        <div className="space-y-3">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Market News</h1>
              <p className="mt-0.5 max-w-4xl text-[11px] text-muted-foreground">
                聚合公开 RSS：Yahoo Finance、CNBC、MarketWatch、Investing、Fed、CoinDesk、Cointelegraph、Decrypt、CryptoSlate。
              </p>
            </div>
            <div className="rounded-full border px-3 py-1 text-[11px] text-muted-foreground">
              {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("zh-CN")}` : "Loading news"}
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
              Loading market news...
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
              <div className="space-y-2">
                {articles.length === 0 ? (
                  <Card>
                    <CardContent className="pt-4 text-xs text-muted-foreground">No market news available.</CardContent>
                  </Card>
                ) : (
                  articles.map((article) => (
                    <a key={article.url} href={article.url} target="_blank" rel="noreferrer" className="block">
                      <Card className="py-2.5 transition-shadow hover:shadow-md">
                        <CardContent className="p-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Badge variant={getToneVariant(article.tone)} className="h-4 px-1.5 text-[9px]">
                              {getToneLabel(article.tone)}
                            </Badge>
                            {isCryptoArticle(article) && (
                              <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                                Crypto
                              </Badge>
                            )}
                            <span>{article.domain}</span>
                            <span>{article.sourceCountry}</span>
                            <span>{new Date(article.publishedAt).toLocaleString("zh-CN")}</span>
                          </div>
                          <div className="mt-1.5 flex items-start justify-between gap-3">
                            <h2 className="text-sm font-semibold leading-snug">{article.title}</h2>
                            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  ))
                )}
              </div>

              <aside className="space-y-2">
                <Card className="py-2.5">
                  <CardHeader className="px-3 pb-1">
                    <CardTitle className="flex items-center gap-1.5 text-xs">
                      <Newspaper className="h-3.5 w-3.5" />
                      Feed Summary
                      <InfoTooltip
                        title="Tone 含义"
                        description={
                          "Tone 估值（如有）：> 2 偏 Risk-on；< -2 偏 Risk-off；其余 Neutral。\n本页聚合 Yahoo Finance、CNBC、MarketWatch、Investing、Fed、CoinDesk、Cointelegraph、Decrypt、CryptoSlate 等公开 RSS 源。"
                        }
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 text-xs">
                    <SummaryRow label="Source" value={source} />
                    <SummaryRow label="Articles" value={articles.length} />
                    <SummaryRow label="Crypto News" value={cryptoArticleCount} />
                    <SummaryRow label="Refresh" value="5 min" border={false} />
                  </CardContent>
                </Card>

                <Card className="py-2.5">
                  <CardHeader className="px-3 pb-1">
                    <CardTitle className="text-xs">Top Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 px-3 text-xs">
                    {topDomains.length === 0 ? (
                      <p className="text-muted-foreground">No source data yet.</p>
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
