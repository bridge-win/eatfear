"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
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
      <main className="container mx-auto px-4 py-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Market News</h1>
              <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
                聚合公开 RSS：Yahoo Finance、CNBC、MarketWatch、Investing、Fed、CoinDesk、Cointelegraph、Decrypt、CryptoSlate。
              </p>
            </div>
            <div className="rounded-full border px-4 py-2 text-sm text-muted-foreground">
              {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString("zh-CN")}` : "Loading news"}
            </div>
          </div>

          {error && (
            <Card className="border-destructive/40">
              <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {isLoading && articles.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading market news...
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="space-y-3">
                {articles.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-sm text-muted-foreground">No market news available.</CardContent>
                  </Card>
                ) : (
                  articles.map((article) => (
                    <a key={article.url} href={article.url} target="_blank" rel="noreferrer" className="block">
                      <Card className="transition-shadow hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={getToneVariant(article.tone)}>{getToneLabel(article.tone)}</Badge>
                            {isCryptoArticle(article) && <Badge variant="outline">Crypto</Badge>}
                            <span>{article.domain}</span>
                            <span>{article.sourceCountry}</span>
                            <span>{new Date(article.publishedAt).toLocaleString("zh-CN")}</span>
                          </div>
                          <div className="mt-3 flex items-start justify-between gap-4">
                            <h2 className="text-base font-semibold leading-snug">{article.title}</h2>
                            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  ))
                )}
              </div>

              <aside className="space-y-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Newspaper className="h-5 w-5" />
                      Feed Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex justify-between gap-4 border-b pb-3">
                      <span className="text-muted-foreground">Source</span>
                      <span className="font-medium">{source}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b pb-3">
                      <span className="text-muted-foreground">Articles</span>
                      <span className="font-medium">{articles.length}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b pb-3">
                      <span className="text-muted-foreground">Crypto News</span>
                      <span className="font-medium">{cryptoArticleCount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Refresh</span>
                      <span className="font-medium">5 min</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {topDomains.length === 0 ? (
                      <p className="text-muted-foreground">No source data yet.</p>
                    ) : (
                      topDomains.map(([domain, count]) => (
                        <div key={domain} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                          <span className="truncate">{domain}</span>
                          <Badge variant="secondary">{count}</Badge>
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
