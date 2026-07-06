import { NextResponse } from "next/server"

import { fetchBlockchainInfoSeries } from "@/lib/data-sources/blockchain-info-charts"
import { fetchBtcHashrateSeries } from "@/lib/data-sources/mempool-hashrate"
import { fetchOkxDailyCandles } from "@/lib/okx-history"
import { getRangeDays, isTimeRangeId } from "@/lib/time-range"

export const revalidate = 300

export type MayerZone = "extreme_buy" | "buy" | "below_200d" | "fair" | "overvalued" | "extreme_sell"
export type HashRibbonStatus = "recovery" | "capitulation" | "crossover" | "healthy"
export type PuellZone = "extreme_distress" | "capitulation" | "accumulation" | "fair" | "elevated" | "top"
export type CycleBand = "bottom" | "deep_value" | "accumulation" | "fair_value" | "elevated" | "top"

function mayerZoneLabel(z: MayerZone): { zh: string; en: string } {
  const m: Record<MayerZone, { zh: string; en: string }> = {
    extreme_buy: { zh: "极端买入区", en: "Extreme Buy" },
    buy: { zh: "主要积累区", en: "Major Accumulation" },
    below_200d: { zh: "200日线以下", en: "Below 200d MA" },
    fair: { zh: "公平价值", en: "Fair Value" },
    overvalued: { zh: "偏高估值", en: "Overvalued" },
    extreme_sell: { zh: "极端高估", en: "Extreme Overvalued" },
  }
  return m[z]
}

function hashRibbonStatusLabel(s: HashRibbonStatus): { zh: string; en: string } {
  const m: Record<HashRibbonStatus, { zh: string; en: string }> = {
    recovery: { zh: "复苏信号 ✦", en: "Recovery Signal ✦" },
    capitulation: { zh: "矿工投降中", en: "Miner Capitulation" },
    crossover: { zh: "交叉观察", en: "Crossover Watch" },
    healthy: { zh: "算力健康", en: "Hashrate Healthy" },
  }
  return m[s]
}

function puellZoneLabel(z: PuellZone): { zh: string; en: string } {
  const m: Record<PuellZone, { zh: string; en: string }> = {
    extreme_distress: { zh: "极端低位", en: "Extreme Distress" },
    capitulation: { zh: "矿工底部", en: "Miner Bottom" },
    accumulation: { zh: "积累区间", en: "Accumulation" },
    fair: { zh: "正常区间", en: "Fair Range" },
    elevated: { zh: "偏高", en: "Elevated" },
    top: { zh: "周期顶部", en: "Cycle Top Signal" },
  }
  return m[z]
}

function cycleBandLabel(b: CycleBand): { zh: string; en: string } {
  const m: Record<CycleBand, { zh: string; en: string }> = {
    bottom: { zh: "周期底部 · 历史级机会", en: "Cycle Bottom · Historic" },
    deep_value: { zh: "深度价值区 · 强力积累", en: "Deep Value · Strong Accumulate" },
    accumulation: { zh: "积累区间 · 逐步建仓", en: "Accumulation · Build Positions" },
    fair_value: { zh: "公平价值 · 持有或观望", en: "Fair Value · Hold or Wait" },
    elevated: { zh: "偏高估值 · 降低仓位", en: "Elevated · Reduce Exposure" },
    top: { zh: "周期顶部 · 谨慎防守", en: "Cycle Top · Be Defensive" },
  }
  return m[b]
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedRange = url.searchParams.get("range")
  const rangeCandidate = requestedRange ?? ""
  const rangeId = isTimeRangeId(rangeCandidate) ? rangeCandidate : "1y"
  const daysWanted = Math.max(365, getRangeDays(rangeId))
  const [candles, hashrateSeries, minerRevRaw] = await Promise.all([
    fetchOkxDailyCandles({ instId: "BTC-USDT-SWAP", daysWanted, revalidateSeconds: revalidate }),
    fetchBtcHashrateSeries(Math.max(600, daysWanted)),
    fetchBlockchainInfoSeries("miners-revenue", daysWanted > 365 * 5 ? "all" : daysWanted > 365 * 2 ? "5years" : "2years", 1800),
  ])

  // ─── Mayer Multiple ───────────────────────────────────────────────────────
  let mayerValue: number | null = null
  let sma200: number | null = null
  let mayerZone: MayerZone = "fair"
  let mayerScore = 40

  if (candles.length >= 60) {
    const closes = candles.map((c) => c.close)
    const currentClose = closes[closes.length - 1]
    const smaLen = Math.min(closes.length, 200)
    const smaVal = closes.slice(-smaLen).reduce((s, v) => s + v, 0) / smaLen
    sma200 = smaVal
    mayerValue = smaVal > 0 ? currentClose / smaVal : null

    if (mayerValue !== null) {
      if (mayerValue < 0.6) { mayerZone = "extreme_buy"; mayerScore = 100 }
      else if (mayerValue < 0.8) { mayerZone = "buy"; mayerScore = 88 }
      else if (mayerValue < 1.0) { mayerZone = "below_200d"; mayerScore = 65 }
      else if (mayerValue < 1.5) { mayerZone = "fair"; mayerScore = 35 }
      else if (mayerValue < 2.4) { mayerZone = "overvalued"; mayerScore = 12 }
      else { mayerZone = "extreme_sell"; mayerScore = 3 }
    }
  }

  // ─── Hash Ribbon ──────────────────────────────────────────────────────────
  let hashMa10: number | null = null
  let hashMa30: number | null = null
  let hashMa60: number | null = null
  let hashStatus: HashRibbonStatus = "healthy"
  let hashScore = 35

  if (hashrateSeries && hashrateSeries.length >= 60) {
    const tail = hashrateSeries.slice(-90)
    hashMa60 = tail.slice(-60).reduce((s, v) => s + v, 0) / 60
    hashMa30 = tail.slice(-30).reduce((s, v) => s + v, 0) / 30
    hashMa10 = tail.slice(-10).reduce((s, v) => s + v, 0) / 10

    const ma30VsMa60 = hashMa60 > 0 ? (hashMa30 - hashMa60) / hashMa60 : 0
    const ma10VsMa30 = hashMa30 > 0 ? (hashMa10 - hashMa30) / hashMa30 : 0

    if (ma30VsMa60 < -0.01) {
      if (ma10VsMa30 > 0.005) {
        hashStatus = "recovery"
        hashScore = 90
      } else {
        hashStatus = "capitulation"
        hashScore = Math.min(75, 55 + Math.abs(ma30VsMa60) * 300)
      }
    } else if (Math.abs(ma30VsMa60) < 0.01) {
      hashStatus = "crossover"
      hashScore = 50
    } else {
      hashStatus = "healthy"
      hashScore = Math.max(5, 38 - ma30VsMa60 * 120)
    }
  }

  // ─── Puell Multiple ───────────────────────────────────────────────────────
  let puellValue: number | null = null
  let puellZone: PuellZone = "fair"
  let puellScore = 40

  const minerRevSeries = minerRevRaw.map((p) => p.value)
  if (minerRevSeries.length >= 30) {
    const current = minerRevSeries[minerRevSeries.length - 1]
    const maLen = Math.min(minerRevSeries.length, 365)
    const ma365 = minerRevSeries.slice(-maLen).reduce((s, v) => s + v, 0) / maLen
    puellValue = ma365 > 0 ? current / ma365 : null

    if (puellValue !== null) {
      if (puellValue < 0.3) { puellZone = "extreme_distress"; puellScore = 100 }
      else if (puellValue < 0.5) { puellZone = "capitulation"; puellScore = 85 }
      else if (puellValue < 0.7) { puellZone = "accumulation"; puellScore = 65 }
      else if (puellValue < 1.0) { puellZone = "fair"; puellScore = 45 }
      else if (puellValue < 2.0) { puellZone = "elevated"; puellScore = 22 }
      else { puellZone = "top"; puellScore = 5 }
    }
  }

  // ─── Composite Cycle Score ────────────────────────────────────────────────
  const cycleScore = Math.round(hashScore * 0.45 + mayerScore * 0.40 + puellScore * 0.15)

  let cycleBand: CycleBand
  if (cycleScore >= 80) cycleBand = "bottom"
  else if (cycleScore >= 65) cycleBand = "deep_value"
  else if (cycleScore >= 50) cycleBand = "accumulation"
  else if (cycleScore >= 35) cycleBand = "fair_value"
  else if (cycleScore >= 20) cycleBand = "elevated"
  else cycleBand = "top"

  const bandLabel = cycleBandLabel(cycleBand)

  return NextResponse.json({
    updatedAt: Date.now(),
    range: rangeId,
    cycleScore,
    cycleBand,
    cycleSignalZh: bandLabel.zh,
    cycleSignalEn: bandLabel.en,
    mayerMultiple: {
      value: mayerValue !== null ? Math.round(mayerValue * 1000) / 1000 : null,
      sma200: sma200 !== null ? Math.round(sma200) : null,
      smaLen: candles.length >= 200 ? 200 : candles.length,
      zone: mayerZone,
      zoneZh: mayerZoneLabel(mayerZone).zh,
      zoneEn: mayerZoneLabel(mayerZone).en,
      score: mayerScore,
    },
    hashRibbon: {
      ma10Eh: hashMa10 !== null ? Math.round((hashMa10 / 1e18) * 10) / 10 : null,
      ma30Eh: hashMa30 !== null ? Math.round((hashMa30 / 1e18) * 10) / 10 : null,
      ma60Eh: hashMa60 !== null ? Math.round((hashMa60 / 1e18) * 10) / 10 : null,
      status: hashStatus,
      statusZh: hashRibbonStatusLabel(hashStatus).zh,
      statusEn: hashRibbonStatusLabel(hashStatus).en,
      score: Math.round(hashScore),
    },
    puellMultiple: {
      value: puellValue !== null ? Math.round(puellValue * 1000) / 1000 : null,
      zone: puellZone,
      zoneZh: puellZoneLabel(puellZone).zh,
      zoneEn: puellZoneLabel(puellZone).en,
      score: puellScore,
    },
    upstream: {
      candles: candles.length > 0 ? `OKX BTC-USDT-SWAP daily · ${candles.length} bars` : "OKX unavailable",
      hashrate: hashrateSeries ? `mempool.space hashrate · ${hashrateSeries.length} bars` : "unavailable",
      minerRevenue: minerRevSeries.length > 0 ? `blockchain.info miners-revenue · ${minerRevSeries.length} bars` : "unavailable",
    },
  })
}
