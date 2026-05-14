import { NextResponse } from "next/server"
import type { MarketNewsArticle } from "@/lib/types"

export const revalidate = 300

interface RssSource {
  name: string
  url: string
  domain: string
  sourceCountry: string
  language: string
}

const rssSources: RssSource[] = [
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    domain: "finance.yahoo.com",
    sourceCountry: "US",
    language: "English",
  },
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    domain: "coindesk.com",
    sourceCountry: "US",
    language: "English",
  },
  {
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    domain: "cointelegraph.com",
    sourceCountry: "Global",
    language: "English",
  },
  {
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    domain: "decrypt.co",
    sourceCountry: "US",
    language: "English",
  },
  {
    name: "CryptoSlate",
    url: "https://cryptoslate.com/feed/",
    domain: "cryptoslate.com",
    sourceCountry: "Global",
    language: "English",
  },
  {
    name: "CNBC Markets",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    domain: "cnbc.com",
    sourceCountry: "US",
    language: "English",
  },
  {
    name: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
    domain: "marketwatch.com",
    sourceCountry: "US",
    language: "English",
  },
  {
    name: "Investing.com Economy",
    url: "https://www.investing.com/rss/news_25.rss",
    domain: "investing.com",
    sourceCountry: "Global",
    language: "English",
  },
  {
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    domain: "federalreserve.gov",
    sourceCountry: "US",
    language: "English",
  },
]

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()

const stripTags = (value: string) => decodeXml(value.replace(/<[^>]*>/g, " "))

const extractTag = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match ? decodeXml(match[1]) : ""
}

const extractAttribute = (item: string, tag: string, attribute: string) => {
  const match = item.match(new RegExp(`<${tag}[^>]*\\s${attribute}=["']([^"']+)["'][^>]*>`, "i"))
  return match ? decodeXml(match[1]) : undefined
}

const normalizeDate = (value: string) => {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

async function fetchRssSource(source: RssSource): Promise<MarketNewsArticle[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate },
  })

  if (!response.ok) return []

  const xml = await response.text()
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []

  return items.flatMap((item) => {
    const title = stripTags(extractTag(item, "title"))
    const url = stripTags(extractTag(item, "link"))
    const publishedAt = extractTag(item, "pubDate") || extractTag(item, "dc:date")

    if (!title || !url) return []

    return [
      {
        title,
        url,
        domain: source.domain,
        sourceCountry: source.sourceCountry,
        language: source.language,
        publishedAt: normalizeDate(publishedAt),
        imageUrl: extractAttribute(item, "media:content", "url") ?? extractAttribute(item, "media:thumbnail", "url"),
      },
    ]
  })
}

export async function GET() {
  const results = await Promise.allSettled(rssSources.map(fetchRssSource))
  const seenUrls = new Set<string>()
  const articles = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((article) => {
      if (seenUrls.has(article.url)) return false
      seenUrls.add(article.url)
      return true
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 80)

  return NextResponse.json(
    {
      updatedAt: Date.now(),
      source: rssSources.map((source) => source.name).join(" + "),
      articles,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  )
}
