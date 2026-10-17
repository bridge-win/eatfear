import { NextResponse } from "next/server"
import { getCnSecurities } from "@/lib/cn/securities"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function GET() {
  const data = await getCnSecurities()
  return NextResponse.json(data, { headers: { "Cache-Control": data.status === "ok" ? "public, s-maxage=60, stale-while-revalidate=60" : "no-store" } })
}
