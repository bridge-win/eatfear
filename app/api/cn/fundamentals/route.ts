import { NextResponse } from "next/server"
import { getCnFundamentals, isCnFundamentalsId } from "@/lib/cn/fundamentals"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? ""
  if (!isCnFundamentalsId(id)) return NextResponse.json({ error: "Unsupported CN stock" }, { status: 400 })
  const data = await getCnFundamentals(id)
  return NextResponse.json(data, { headers: { "Cache-Control": data.status === "ok" ? "public, s-maxage=900, stale-while-revalidate=900" : "no-store" } })
}
