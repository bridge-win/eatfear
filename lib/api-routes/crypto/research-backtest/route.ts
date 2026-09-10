import { NextResponse } from "next/server"

import { fetchOkxDailyCandles } from "@/lib/okx-history"
import { evaluate, walkForward, verdict } from "@/lib/research/split"
import { RULES, buyHold, ruleById } from "@/lib/research/rules"

export const runtime = "nodejs"

const DAYS_WANTED = 3400
const REVALIDATE_SECONDS = 6 * 3600
const FEE = 0.0006

/**
 * Live, parameter-isolated backtest of one canonical rule on OKX daily candles.
 * Replaces the retired in-browser experiment: same discipline (select on train only,
 * score the untouched test window, walk-forward for consistency), one rule at a time.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const ccy = (url.searchParams.get("ccy") ?? "BTC").toUpperCase()
  const ruleId = url.searchParams.get("rule") ?? "faber_ma"
  const testStartParam = url.searchParams.get("testStart") ?? "2024-01-01"
  const stress = url.searchParams.get("stress") === "1"

  const rule = ruleById(ruleId)
  if (!rule) return NextResponse.json({ error: `unknown rule ${ruleId}`, rules: RULES.map((r) => ({ id: r.id, name: r.name, family: r.family })) }, { status: 400 })
  const testStart = Date.parse(testStartParam)
  if (!Number.isFinite(testStart)) return NextResponse.json({ error: "bad testStart" }, { status: 400 })

  const candles = await fetchOkxDailyCandles({ instId: `${ccy}-USDT`, daysWanted: DAYS_WANTED, revalidateSeconds: REVALIDATE_SECONDS })
  const bars = candles.filter((c) => c.timestamp < Date.now() - (Date.now() % 86_400_000)).map((c) => ({ time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
  if (bars.length < 800 || bars.filter((b) => b.time < testStart).length < 500) {
    return NextResponse.json({ error: `insufficient history: ${bars.length} bars` }, { status: 503 })
  }

  const config = { fee: FEE, slippage: 0.0005, wickWeight: stress ? 0.5 : 0 }
  const result = evaluate(rule, bars, testStart, config)
  const wf = walkForward(rule, bars, config)
  const bench = evaluate(buyHold, bars, testStart, config)

  return NextResponse.json(
    {
      ccy, rule: { id: rule.id, name: rule.name, family: rule.family, gridSize: rule.grid.length },
      window: { train: [new Date(bars[0].time).toISOString().slice(0, 10), new Date(testStart).toISOString().slice(0, 10)], test: [new Date(testStart).toISOString().slice(0, 10), new Date(bars[bars.length - 1].time).toISOString().slice(0, 10)] },
      costs: { fee: FEE, slippage: 0.0005, wickWeight: config.wickWeight },
      params: result.params, is: result.is, oos: result.oos,
      plane: result.plane, planeSpread: result.planeSpread, concentration: result.concentration, yearly: result.yearly,
      walkForward: { nWindows: wf.nWindows, winWindows: wf.winWindows, pctWindows: wf.pctWindows, paramSwitches: wf.paramSwitches, sharpe: wf.sharpe, windows: wf.windows },
      verdict: verdict(result, wf),
      benchmark: { is: bench.is, oos: bench.oos },
      equity: result.equity.filter((_, i) => i % 7 === 0),
      rules: RULES.map((r) => ({ id: r.id, name: r.name, family: r.family, gridSize: r.grid.length })),
    },
    { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600` } },
  )
}
