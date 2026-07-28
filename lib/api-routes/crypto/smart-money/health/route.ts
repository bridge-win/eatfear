import { NextResponse } from "next/server"

import { probeSmartMoneySources } from "@/lib/smart-money/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const sources = await probeSmartMoneySources()
  return NextResponse.json({ sources, updatedAt: Date.now() })
}
