import { NextResponse } from "next/server"

import { buildDiscoverResponse } from "@/lib/discover/server"

export const revalidate = 900
export const runtime = "nodejs"
export const maxDuration = 10

const CACHE_HEADER = "public, s-maxage=900, stale-while-revalidate=300"

export async function GET() {
  try {
    const payload = await buildDiscoverResponse()
    return NextResponse.json(payload, { headers: { "Cache-Control": CACHE_HEADER } })
  } catch {
    return NextResponse.json({ error: "Discover data unavailable" }, { status: 502 })
  }
}
