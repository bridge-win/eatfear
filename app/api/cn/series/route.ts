import { NextResponse } from "next/server"
import { BY_ID } from "@/lib/cn/catalog"
import { getSeries } from "@/lib/cn/providers"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "pmi"
  if (!Object.prototype.hasOwnProperty.call(BY_ID, id)) return NextResponse.json({ error: "Unknown series" }, { status: 400 })
  const data = await getSeries(id)
  return NextResponse.json(data, { headers: { "Cache-Control": data.status === "ok" ? "public, s-maxage=900, stale-while-revalidate=3600" : "no-store" } })
}
