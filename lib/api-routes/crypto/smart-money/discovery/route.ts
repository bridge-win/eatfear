import { NextResponse } from "next/server"

import { fetchActorSources } from "@/lib/smart-money/server"
import type { SmartMoneyActor, SmartMoneyVenue } from "@/lib/smart-money/types"

export const dynamic = "force-dynamic"

const VENUES = new Set<SmartMoneyVenue>(["okx", "binance", "hyperliquid", "polymarket"])
const SORTS = new Set(["quality", "pnl", "roi", "drawdown", "capital", "copyability"])

type SortKey = "quality" | "pnl" | "roi" | "drawdown" | "capital" | "copyability"

function finite(value: number | null, fallback: number): number {
  return value !== null && Number.isFinite(value) ? value : fallback
}

function sortActors(actors: SmartMoneyActor[], sort: SortKey): SmartMoneyActor[] {
  return [...actors].sort((left, right) => {
    if (sort === "pnl") return finite(right.metrics.pnlUsd, -Infinity) - finite(left.metrics.pnlUsd, -Infinity)
    if (sort === "roi") return finite(right.metrics.roiPct, -Infinity) - finite(left.metrics.roiPct, -Infinity)
    if (sort === "drawdown") return finite(left.metrics.maxDrawdownPct, Infinity) - finite(right.metrics.maxDrawdownPct, Infinity)
    if (sort === "capital") return finite(right.metrics.accountValueUsd, -Infinity) - finite(left.metrics.accountValueUsd, -Infinity)
    if (sort === "copyability") return right.quality.copyabilityScore - left.quality.copyabilityScore
    const categoryRank = { elite: 3, proven: 2, watch: 1, unranked: 0 }
    const confidenceRank = { high: 2, medium: 1, low: 0 }
    return categoryRank[right.quality.category] - categoryRank[left.quality.category]
      || confidenceRank[right.quality.confidence] - confidenceRank[left.quality.confidence]
      || right.quality.score - left.quality.score
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const venueRaw = url.searchParams.get("venue")
  const venue = venueRaw && VENUES.has(venueRaw as SmartMoneyVenue) ? venueRaw as SmartMoneyVenue : null
  const sortRaw = url.searchParams.get("sort") ?? "quality"
  const sort = SORTS.has(sortRaw) ? sortRaw as SortKey : "quality"
  const limitRaw = Number(url.searchParams.get("limit") ?? "50")
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50
  const results = await fetchActorSources()
  const actors = sortActors(
    results.flatMap((result) => result.actors).filter((actor) => venue === null || actor.venue === venue),
    sort,
  ).slice(0, limit)
  const sources = results.map((result) => result.health)
  const availableSources = results.filter((result) => result.actors.length > 0).length
  const payload = { actors, sources, filters: { venue, sort, limit }, updatedAt: Date.now() }

  return NextResponse.json(payload, { status: availableSources > 0 ? 200 : 502 })
}
