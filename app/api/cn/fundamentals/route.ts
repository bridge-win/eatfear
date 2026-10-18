import { NextResponse } from "next/server"
import { getCnFundamentals, isCnFundamentalsId } from "@/lib/cn/fundamentals"
import { getMarketSnapshot, SnapshotError } from "@/lib/cn/snapshot-store"
import { securityFromMarketRow } from "@/lib/cn/market-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? ""
  if (!/^(sh|sz|bj)\d{6}$/.test(id)) return NextResponse.json({ error: "Unsupported CN stock" }, { status: 400 })
  try {
    let security
    if (!isCnFundamentalsId(id)) {
      const row = (await getMarketSnapshot()).snapshot.rows.find(r => r.id === id && r.identityVerified && r.listingStatus !== "delisted")
      if (!row) return NextResponse.json({ error: "Unsupported CN stock" }, { status: 400 })
      security = securityFromMarketRow(row)
    }
    const data = await getCnFundamentals(id, fetch, Date.now(), security)
    return NextResponse.json(data, { headers: { "Cache-Control": data.status === "ok" ? "public, s-maxage=900, stale-while-revalidate=900" : "no-store" } })
  } catch (e) { return NextResponse.json({ error: e instanceof SnapshotError ? e.code : "fundamentals_unavailable" }, { status: e instanceof SnapshotError ? e.status : 503 }) }
}
