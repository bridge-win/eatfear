import { NextResponse } from "next/server"
import { getMarketSnapshot, SnapshotError } from "@/lib/cn/snapshot-store"
import { marketAnalysis } from "@/lib/cn/market-analysis"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(k => k !== "snapshotId") || params.getAll("snapshotId").length > 1) return NextResponse.json({ error: "invalid_parameters" }, { status: 400 })
    return NextResponse.json(marketAnalysis(await getMarketSnapshot(params.get("snapshotId"))), { headers: { "Cache-Control": "public, s-maxage=60" } })
  } catch (e) { return NextResponse.json({ error: e instanceof SnapshotError ? e.code : "analysis_unavailable" }, { status: e instanceof SnapshotError ? e.status : 503 }) }
}
