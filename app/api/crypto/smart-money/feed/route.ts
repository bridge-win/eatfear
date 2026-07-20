import { NextResponse } from "next/server"

import { calculateMarketConsensus } from "@/lib/smart-money/scoring"
import { fetchEventSources } from "@/lib/smart-money/server"

export const dynamic = "force-dynamic"

function eventTime(event: Awaited<ReturnType<typeof fetchEventSources>>[number]["events"][number]): number {
  return event.provenance.eventAt ?? 0
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccyRaw = (url.searchParams.get("ccy") ?? "BTC").trim().toUpperCase()
  const ccy = /^[A-Z0-9]{1,12}$/.test(ccyRaw) ? ccyRaw : "BTC"
  const limitRaw = Number(url.searchParams.get("limit") ?? "80")
  const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 80
  const minimumRaw = Number(url.searchParams.get("minUsd") ?? "0")
  const minimumUsd = Number.isFinite(minimumRaw) ? Math.max(0, minimumRaw) : 0
  const results = await fetchEventSources(ccy)
  const events = [...new Map(results
    .flatMap((result) => result.events)
    .filter((event) => event.provenance.eventAt !== null && (event.amountUsd === null || event.amountUsd >= minimumUsd))
    .sort((left, right) => eventTime(right) - eventTime(left))
    .map((event) => [event.id, event])).values()].slice(0, limit)
  const sources = results.map((result) => result.health)
  const allUnavailable = sources.every((source) => source.status === "unavailable")

  return NextResponse.json({
    events,
    consensus: calculateMarketConsensus(events),
    sources,
    filters: { ccy, limit, minimumUsd },
    updatedAt: Date.now(),
  }, { status: allUnavailable ? 502 : 200 })
}
