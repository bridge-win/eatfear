import { NextResponse } from "next/server"

import { backtestSignal, type BacktestBar, type SignalPredicate } from "@/lib/backtest/forward-returns"

export const revalidate = 3600

const OKX = "https://www.okx.com"

/**
 * Historical validation for transparent price-based signals: fetches BTC daily
 * candles and reports what actually happened after each signal fired (forward
 * return distribution, hit-rate, MAE, edge vs. baseline). This is the evidence
 * that turns a threshold into "occurred n times, 30d median +X%, hit-rate Y%".
 *
 * Predicates use only past bars (no lookahead); forward stats read future bars.
 */

async function fetchDailyCloses(instId: string, pages = 4): Promise<BacktestBar[]> {
  const bars: BacktestBar[] = []
  let after = ""
  for (let p = 0; p < pages; p += 1) {
    const url = `${OKX}/api/v5/market/history-candles?instId=${instId}&bar=1D&limit=100${after ? `&after=${after}` : ""}`
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, next: { revalidate } })
      if (!res.ok) break
      const json = (await res.json()) as { code: string; data?: string[][] }
      if (json.code !== "0" || !json.data?.length) break
      for (const row of json.data) {
        bars.push({ time: Number(row[0]), close: Number(row[4]), low: Number(row[3]) })
      }
      after = json.data[json.data.length - 1][0]
    } catch {
      break
    }
  }
  return bars.filter((b) => Number.isFinite(b.close) && b.close > 0).sort((a, b) => a.time - b.time)
}

function sma(bars: BacktestBar[], i: number, n: number): number {
  let s = 0
  let c = 0
  for (let k = Math.max(0, i - n + 1); k <= i; k += 1) {
    s += bars[k].close
    c += 1
  }
  return c > 0 ? s / c : NaN
}

function rsi(bars: BacktestBar[], i: number, n = 14): number {
  if (i < n) return NaN
  let gain = 0
  let loss = 0
  for (let k = i - n + 1; k <= i; k += 1) {
    const ch = bars[k].close - bars[k - 1].close
    if (ch >= 0) gain += ch
    else loss -= ch
  }
  if (loss === 0) return 100
  const rs = gain / n / (loss / n)
  return 100 - 100 / (1 + rs)
}

function trailingHigh(bars: BacktestBar[], i: number, n: number): number {
  let hi = 0
  for (let k = Math.max(0, i - n + 1); k <= i; k += 1) if (bars[k].close > hi) hi = bars[k].close
  return hi
}

const PREDICATES: Record<string, { predicate: SignalPredicate; labelZh: string; labelEn: string; direction: "long" | "short" }> = {
  mayer_cheap: {
    predicate: (i, b) => i >= 60 && b[i].close < sma(b, i, 200) * 0.8,
    labelZh: "Mayer < 0.8(低于 200 日均线 20%)",
    labelEn: "Mayer < 0.8 (20% below 200d SMA)",
    direction: "long",
  },
  mayer_rich: {
    predicate: (i, b) => i >= 60 && b[i].close > sma(b, i, 200) * 2.4,
    labelZh: "Mayer > 2.4(高于 200 日均线 140%)",
    labelEn: "Mayer > 2.4 (140% above 200d SMA)",
    direction: "short",
  },
  drawdown_20: {
    predicate: (i, b) => i >= 90 && b[i].close < trailingHigh(b, i, 90) * 0.8,
    labelZh: "较 90 日高点回撤 > 20%",
    labelEn: "> 20% drawdown from 90d high",
    direction: "long",
  },
  rsi_oversold: {
    predicate: (i, b) => rsi(b, i) < 30,
    labelZh: "RSI(14) < 30 超卖",
    labelEn: "RSI(14) < 30 oversold",
    direction: "long",
  },
  rsi_overbought: {
    predicate: (i, b) => rsi(b, i) > 70,
    labelZh: "RSI(14) > 70 超买",
    labelEn: "RSI(14) > 70 overbought",
    direction: "short",
  },
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ccy = (url.searchParams.get("ccy") ?? "BTC").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "BTC"
  const signal = url.searchParams.get("signal") ?? "mayer_cheap"
  const def = PREDICATES[signal]
  if (!def) {
    return NextResponse.json({ error: `Unknown signal '${signal}'`, available: Object.keys(PREDICATES) }, { status: 400 })
  }

  const bars = await fetchDailyCloses(`${ccy}-USDT`)
  if (bars.length < 120) {
    return NextResponse.json({ error: "Insufficient history", bars: bars.length }, { status: 502 })
  }

  const result = backtestSignal(bars, def.predicate, { horizonsBars: [7, 30, 90], minGapBars: 5 })
  const round = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null)

  return NextResponse.json({
    ccy,
    signal,
    direction: def.direction,
    labelZh: def.labelZh,
    labelEn: def.labelEn,
    updatedAt: Date.now(),
    coverage: {
      bars: result.totalBars,
      fromDate: new Date(bars[0].time).toISOString().slice(0, 10),
      toDate: new Date(bars[bars.length - 1].time).toISOString().slice(0, 10),
      rawSignalBars: result.rawSignalBars,
      signalEntries: result.signalEntries,
    },
    horizons: result.horizons.map((h) => ({
      days: h.horizonBars,
      count: h.count,
      hitRatePct: round(h.hitRate * 100),
      medianReturnPct: round(h.medianReturnPct),
      meanReturnPct: round(h.meanReturnPct),
      p25ReturnPct: round(h.p25ReturnPct),
      p75ReturnPct: round(h.p75ReturnPct),
      worstReturnPct: round(h.worstReturnPct),
      medianMaxAdverseExcursionPct: round(h.medianMaxAdverseExcursionPct),
      baselineMedianReturnPct: round(h.baselineMedianReturnPct),
      baselineHitRatePct: round(h.baselineHitRate * 100),
      edgeVsBaselinePct: round(h.edgeVsBaselinePct),
    })),
    upstream: `OKX ${ccy}-USDT daily history-candles · ${bars.length} bars`,
    disclaimer: "Past performance is not indicative of future results. Not investment advice.",
  })
}
