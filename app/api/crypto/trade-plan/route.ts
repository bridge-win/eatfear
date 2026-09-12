import { NextResponse } from "next/server"
import { buildPlanFeatures, planDecision, HORIZONS, PLAN_VERSION, type Horizon } from "@/lib/crypto-trade-plan"
import { fetchPlanMarket } from "@/lib/crypto-plan-market"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  const ccy = (new URL(request.url).searchParams.get("ccy") ?? "BTC").toUpperCase()
  if (!/^[A-Z0-9]{2,12}$/.test(ccy)) return NextResponse.json({ error: "invalid_currency" }, { status: 400 })
  const asOf = Date.now()
  const plans = await Promise.all((Object.keys(HORIZONS) as Horizon[]).map(async (horizon) => {
    try {
      const market = await fetchPlanMarket(ccy, horizon, asOf)
      const feature = buildPlanFeatures(market.bars, horizon).at(-1)!
      return { horizon, interval: HORIZONS[horizon].interval, market: market.market, source: market.source, warnings: market.warnings, feature, decision: planDecision(feature, horizon, asOf), weights: HORIZONS[horizon].weights }
    } catch {
      return { horizon, error: "market_history_unavailable" }
    }
  }))
  return NextResponse.json({ ccy, asOf, version: PLAN_VERSION, mode: "spot_long_cash", validation: "not_validated", executionEnabled: false, plans }, { status: plans.every((p) => "error" in p) ? 503 : 200, headers: { "Cache-Control": "public, s-maxage=30" } })
}
