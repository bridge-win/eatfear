"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell, ExternalLink, Newspaper, Plus, Star, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { MarketNewsArticle } from "@/lib/types"

type AssetClass = "crypto" | "stock"

interface WatchSymbol {
  symbol: string
  assetClass: AssetClass
  createdAt: number
}

interface ScorePayload {
  summary?: {
    opportunityScore?: number
    euphoriaScore?: number
    signalEn?: string
    band?: string
  }
}

interface NewsPayload {
  articles?: MarketNewsArticle[]
}

const STORAGE_KEY = "eatfear:watchlist:v1"
const DEFAULT_WATCHLIST: WatchSymbol[] = [
  { symbol: "BTC", assetClass: "crypto", createdAt: 0 },
  { symbol: "ETH", assetClass: "crypto", createdAt: 0 },
  { symbol: "NVDA", assetClass: "stock", createdAt: 0 },
]

function readWatchlist(): WatchSymbol[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_WATCHLIST
  try {
    const parsed = JSON.parse(raw) as WatchSymbol[]
    return parsed.filter((item) => /^[A-Z0-9.=-]{1,12}$/.test(item.symbol))
  } catch {
    return DEFAULT_WATCHLIST
  }
}

function writeWatchlist(items: WatchSymbol[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/-USDT-SWAP$/, "")
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export function WatchlistWorkspace() {
  const { toast } = useToast()
  const [items, setItems] = useState<WatchSymbol[]>(DEFAULT_WATCHLIST)
  const [symbolInput, setSymbolInput] = useState("")
  const [assetClass, setAssetClass] = useState<AssetClass>("crypto")
  const [scores, setScores] = useState<Record<string, { blackSwan: ScorePayload | null; euphoria: ScorePayload | null }>>({})
  const [news, setNews] = useState<MarketNewsArticle[]>([])
  const symbols = useMemo(() => items.map((item) => item.symbol), [items])

  useEffect(() => {
    setItems(readWatchlist())
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") writeWatchlist(items)
  }, [items])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const cryptoItems = items.filter((item) => item.assetClass === "crypto")
      const scoreEntries = await Promise.all(
        cryptoItems.map(async (item) => {
          const [blackSwan, euphoria] = await Promise.all([
            fetchJson<ScorePayload>(`/api/crypto/black-swan?ccy=${encodeURIComponent(item.symbol)}`),
            fetchJson<ScorePayload>(`/api/crypto/euphoria?ccy=${encodeURIComponent(item.symbol)}`),
          ])
          return [item.symbol, { blackSwan, euphoria }] as const
        }),
      )
      const newsPayload = await fetchJson<NewsPayload>(`/api/news?symbols=${encodeURIComponent(symbols.join(","))}`)
      if (cancelled) return
      setScores(Object.fromEntries(scoreEntries))
      setNews(newsPayload?.articles?.slice(0, 12) ?? [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [items, symbols])

  const addSymbol = () => {
    const symbol = normalizeSymbol(symbolInput)
    if (!/^[A-Z0-9.=-]{1,12}$/.test(symbol)) {
      toast({ title: "Invalid symbol", description: "Use symbols like BTC, ETH, NVDA, SPY.", variant: "destructive" })
      return
    }
    if (items.some((item) => item.symbol === symbol && item.assetClass === assetClass)) {
      toast({ title: "Already watched", description: `${symbol} is already in your watchlist.` })
      return
    }
    setItems((current) => [{ symbol, assetClass, createdAt: Date.now() }, ...current].slice(0, 30))
    setSymbolInput("")
  }

  const removeSymbol = (symbol: string, itemAssetClass: AssetClass) => {
    setItems((current) => current.filter((item) => !(item.symbol === symbol && item.assetClass === itemAssetClass)))
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Watchlist</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Track saved symbols with free-source signals, symbol-matched news, and notification readiness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assetClass}
            onChange={(event) => setAssetClass(event.target.value === "stock" ? "stock" : "crypto")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Asset class"
          >
            <option value="crypto">Crypto</option>
            <option value="stock">Stock</option>
          </select>
          <Input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder="BTC, ETH, NVDA"
            className="h-9 w-40"
            onKeyDown={(event) => {
              if (event.key === "Enter") addSymbol()
            }}
          />
          <Button onClick={addSymbol} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const score = scores[item.symbol]
            const longScore = score?.blackSwan?.summary?.opportunityScore
            const shortScore = score?.euphoria?.summary?.euphoriaScore
            const activeScore = Math.max(longScore ?? 0, shortScore ?? 0)
            const activeDirection = (shortScore ?? 0) > (longScore ?? 0) ? "Short / take profit" : "Long / accumulation"
            return (
              <article key={`${item.assetClass}:${item.symbol}`} className="rounded-md border bg-card/95 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current text-amber-500" />
                      <h2 className="truncate text-base font-semibold">{item.symbol}</h2>
                      <Badge variant="secondary">{item.assetClass}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.assetClass === "crypto" ? activeDirection : "News tracking active"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.symbol}`}
                    onClick={() => removeSymbol(item.symbol, item.assetClass)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {item.assetClass === "crypto" ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Long</p>
                      <p className="text-lg font-bold tabular-nums">{longScore === undefined ? "-" : Math.round(longScore)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Short</p>
                      <p className="text-lg font-bold tabular-nums">{shortScore === undefined ? "-" : Math.round(shortScore)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Active</p>
                      <p className="text-lg font-bold tabular-nums">{activeScore || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Stock panic, news, and alert routes use Yahoo/FRED/free RSS. Per-stock euphoria scoring is planned behind free source availability.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/crypto/signal-backtest?ccy=${encodeURIComponent(item.symbol)}&signal=black-swan`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Backtest <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                    <Bell className="h-3 w-3" />
                    Alert-ready
                  </span>
                </div>
              </article>
            )
          })}
        </div>

        <aside className="rounded-md border bg-card/95 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Matched News</h2>
          </div>
          <div className="mt-3 space-y-3">
            {news.length === 0 ? (
              <p className="text-sm text-muted-foreground">No symbol-matched headlines yet.</p>
            ) : (
              news.map((article) => (
                <a key={article.url} href={article.url} target="_blank" rel="noreferrer" className="block border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium leading-snug hover:underline">{article.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {(article.matchedSymbols ?? []).join(", ")} · {article.domain} · {new Date(article.publishedAt).toLocaleString()}
                  </p>
                </a>
              ))
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}
