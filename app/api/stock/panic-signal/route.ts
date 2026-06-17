import { NextResponse } from "next/server"

import { fetchFredSeries } from "@/lib/data-sources/fred"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { getTimeRange } from "@/lib/time-range"

export const revalidate = 300

// VIX thresholds. Since 1990, S&P is higher 12m after a >40 close ~90% of the
// time (avg ~+30%) — NOT 100%; 2008 stayed >40 for ~8 months while stocks fell
// another ~50%. Treat as a long-horizon "attractive zone", not a timing trigger.
const VIX_EXTREME = 40
const VIX_ELEVATED = 30
const VIX_WATCH = 20

// ICE BofA US HY OAS thresholds (bps). Long-run median ~400-500, so 400 is NOT
// elevated — it is baseline. Real distress is 800+ (2011, 2016); panic is 1000+
// (2008: 2182, 2020: 1087). Spread peaks LAG equity bottoms, so this is a stress
// gauge, not an exhaustion/buy signal.
const HY_EXTREME = 800
const HY_ELEVATED = 550

// SPX drawdown thresholds from 52-week high
const SPX_DRAW_EXTREME = -30
const SPX_DRAW_ELEVATED = -20

export type SignalZone = "extreme_buy" | "elevated" | "watch" | "neutral"

function vixZone(v: number): SignalZone {
  if (v >= VIX_EXTREME) return "extreme_buy"
  if (v >= VIX_ELEVATED) return "elevated"
  if (v >= VIX_WATCH) return "watch"
  return "neutral"
}

function hyZone(v: number): SignalZone {
  if (v >= HY_EXTREME) return "extreme_buy"
  if (v >= HY_ELEVATED) return "elevated"
  return "neutral"
}

function spxDrawZone(pct: number): SignalZone {
  if (pct <= SPX_DRAW_EXTREME) return "extreme_buy"
  if (pct <= SPX_DRAW_ELEVATED) return "elevated"
  return "neutral"
}

function zoneScore(z: SignalZone): number {
  switch (z) {
    case "extreme_buy": return 100
    case "elevated": return 65
    case "watch": return 35
    default: return 10
  }
}

export async function GET() {
  const range1y = getTimeRange("1y")
  const range3mo = getTimeRange("3mo")

  const [vixResult, hyResult, spxResult] = await Promise.all([
    fetchYahooSeries("^VIX", range3mo, "1d", revalidate),
    fetchFredSeries("BAMLH0A0HYM2", range1y, revalidate),
    fetchYahooSeries("^GSPC", range1y, "1wk", revalidate),
  ])

  // VIX
  const vixValue = vixResult?.currentValue ?? null
  const vixZ = vixValue !== null ? vixZone(vixValue) : "neutral"

  // HY Spread (FRED BAMLH0A0HYM2 is in percentage points, convert to bps)
  const hyRaw = hyResult?.currentValue ?? null
  const hyBps = hyRaw !== null ? hyRaw * 100 : null
  const hyZ = hyBps !== null ? hyZone(hyBps) : "neutral"

  // SPX drawdown from 52-week high
  let spxDrawPct: number | null = null
  const spxHistory = spxResult?.history ?? []
  if (spxHistory.length >= 2) {
    const values = spxHistory.map((p) => p.value).filter((v) => Number.isFinite(v))
    const high52 = Math.max(...values)
    const latest = values[values.length - 1]
    if (high52 > 0 && latest !== undefined) spxDrawPct = ((latest - high52) / high52) * 100
  }
  const spxZ = spxDrawPct !== null ? spxDrawZone(spxDrawPct) : "neutral"

  // Composite: weighted average of signal scores
  const scores = [
    { zone: vixZ, w: 0.45 },
    { zone: hyZ, w: 0.30 },
    { zone: spxZ, w: 0.25 },
  ]
  const compositeScore = scores.reduce((sum, s) => sum + zoneScore(s.zone) * s.w, 0)
  const activeSignals = scores.filter((s) => s.zone === "extreme_buy" || s.zone === "elevated").length
  const extremeSignals = scores.filter((s) => s.zone === "extreme_buy").length

  let windowBand: "active" | "watch" | "none"
  if (extremeSignals >= 2 || (extremeSignals >= 1 && activeSignals >= 2)) windowBand = "active"
  else if (activeSignals >= 1) windowBand = "watch"
  else windowBand = "none"

  return NextResponse.json({
    updatedAt: Date.now(),
    compositeScore: Math.round(compositeScore),
    windowBand,
    signals: {
      vix: {
        value: vixValue,
        zone: vixZ,
        thresholds: { extreme: VIX_EXTREME, elevated: VIX_ELEVATED },
        unit: "index",
      },
      hySpread: {
        value: hyBps,
        zone: hyZ,
        thresholds: { extreme: HY_EXTREME, elevated: HY_ELEVATED },
        unit: "bps",
      },
      spxDrawdown: {
        value: spxDrawPct !== null ? Math.round(spxDrawPct * 10) / 10 : null,
        zone: spxZ,
        thresholds: { extreme: SPX_DRAW_EXTREME, elevated: SPX_DRAW_ELEVATED },
        unit: "pct",
      },
    },
    upstream: {
      vix: vixResult ? "Yahoo Finance ^VIX" : "VIX unavailable",
      hySpread: hyResult ? "FRED BAMLH0A0HYM2 (ICE BofA HY OAS)" : "FRED unavailable (FRED_API_KEY required)",
      spx: spxResult ? "Yahoo Finance ^GSPC" : "SPX unavailable",
    },
  })
}
