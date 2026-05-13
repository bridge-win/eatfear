/**
 * Multi-factor BTC regime score (0–100). Upstream aggregates:
 * CoinGlass (ETF + CEX inventories), OKX perpetuals, Deribit (DVOL + option flows),
 * DefiLlama stablecoins, Blockchain.com BTC index, mempool.space hashrate, CoinGecko ATH.
 */

export const REGIME_WEIGHTS = {
  capitalFlows: 0.25,
  leverage: 0.25,
  onchainCycle: 0.2,
  marketStructure: 0.15,
  options: 0.15,
} as const

export type RegimeSignalBand = "strong_bull" | "bull" | "neutral" | "bear" | "strong_bear"

export interface RegimeFactorPayload {
  id: keyof typeof REGIME_WEIGHTS
  label: string
  score: number
  weighted: number
  detailLines: string[]
}

export interface RegimeScoreComputation {
  total: number
  rawWeighted: number
  signalBand: RegimeSignalBand
  signalLabelZh: string
  factors: RegimeFactorPayload[]
  penaltiesZh: string[]
  boostsZh: string[]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const linTo100 = (x: number, lo: number, hi: number) => {
  if (hi === lo) return 50
  return clamp(((x - lo) / (hi - lo)) * 100, 0, 100)
}

const linInv100 = (x: number, lo: number, hi: number) => 100 - linTo100(x, lo, hi)

export interface RawRegimeMetrics {
  stablecoinPct7d: number | null
  etfAvgDailyUsdLast5: number | null
  etfDailyDeltaVsPriorWeekUsd: number | null
  exchangeStablePct7d: number | null
  exchangeBtcPct7d: number | null
  fundingRatePct: number | null
  oiUsdSeries: number[]
  longShortRatio: number | null
  takerNetRecent: number | null
  orderBookImbalancePct: number | null
  priceChange24hPct: number | null
  volumeSpikeRatio: number | null
  priceVsSma200GapPct: number | null
  athDistancePct: number | null
  dvolClose: number | null
  hashrateRatioTail: number | null
  optionPutCallRatio7d: number | null
}

function signalFromTotal(total: number): { band: RegimeSignalBand; labelZh: string } {
  if (total >= 75) return { band: "strong_bull", labelZh: "强多 · 可顺势加仓" }
  if (total >= 60) return { band: "bull", labelZh: "偏多 · 回调买入" }
  if (total >= 45) return { band: "neutral", labelZh: "中性 · 观望" }
  if (total >= 30) return { band: "bear", labelZh: "偏空 · 降低仓位" }
  return { band: "strong_bear", labelZh: "强空 · 防守或等极端反转" }
}

function blendWeighted(entries: Array<{ score: number; weight: number }>): number {
  let num = 0
  let den = 0
  for (const e of entries) {
    if (!Number.isFinite(e.score)) continue
    num += e.score * e.weight
    den += e.weight
  }
  if (den <= 0) return 48
  return clamp(num / den, 0, 100)
}

function fmtUsdMm(v: number) {
  return `$${Math.round(v / 1e6)}M`
}

function scoreCapitalFlows(m: RawRegimeMetrics): RegimeFactorPayload {
  const lines: string[] = []
  const blocks: Array<{ score: number; weight: number }> = []

  if (m.stablecoinPct7d !== null) {
    blocks.push({ score: linTo100(m.stablecoinPct7d, -1.2, 2), weight: 0.38 })
    lines.push(`DefiLlama 稳定币总市值 7D ${m.stablecoinPct7d >= 0 ? "+" : ""}${m.stablecoinPct7d.toFixed(2)}%`)
  } else lines.push("DefiLlama 稳定币 7D：数据暂缺")

  const etfBits: Array<{ score: number; weight: number }> = []
  const etfLines: string[] = []
  if (m.etfAvgDailyUsdLast5 !== null && Number.isFinite(m.etfAvgDailyUsdLast5)) {
    const mm = m.etfAvgDailyUsdLast5 / 1_000_000
    etfBits.push({
      score: linTo100(mm, -320, 450),
      weight: 0.7,
    })
    etfLines.push(`CoinGlass 现货 BTC ETF · 近5期日均净流入 ${fmtUsdMm(m.etfAvgDailyUsdLast5)}`)
  }

  if (m.etfDailyDeltaVsPriorWeekUsd !== null && Number.isFinite(m.etfDailyDeltaVsPriorWeekUsd)) {
    const mm = m.etfDailyDeltaVsPriorWeekUsd / 1_000_000
    etfBits.push({
      score: linTo100(mm, -230, 230),
      weight: 0.3,
    })
    etfLines.push(
      `ETF 势能 · 最近7期日均 − 前置7期日均 = ${fmtUsdMm(m.etfDailyDeltaVsPriorWeekUsd)}`,
    )
  }

  if (etfBits.length > 0) {
    lines.push(...etfLines)
    const etfScore = blendWeighted(etfBits)
    blocks.push({ score: etfScore, weight: 0.37 })
  } else lines.push("CoinGlass 现货 BTC ETF：暂无数据（请配置 COINGLASS_API_KEY，或核对 `/api/crypto/regime-score` 响应里的 upstream.coinGlass）")

  if (m.exchangeStablePct7d !== null && Number.isFinite(m.exchangeStablePct7d)) {
    blocks.push({ score: linTo100(m.exchangeStablePct7d, -0.45, 0.65), weight: 0.25 })
    lines.push(`CEX 稳定币加权库存 7D ${m.exchangeStablePct7d >= 0 ? "+" : ""}${m.exchangeStablePct7d.toFixed(2)}% (USDT+USDC CoinGlass)`)
  } else {
    lines.push("CEX 稳定币加权库存 · 需 CoinGlass / COINGLASS_API_KEY")
  }

  const score = blendWeighted(blocks)
  return {
    id: "capitalFlows",
    label: "资金流",
    score,
    weighted: score * REGIME_WEIGHTS.capitalFlows,
    detailLines: lines,
  }
}

function scoreLeverage(m: RawRegimeMetrics): RegimeFactorPayload {
  const lines: string[] = []
  const absFunding = m.fundingRatePct === null ? null : Math.abs(m.fundingRatePct)

  let fundingScore = 50
  if (absFunding !== null) {
    fundingScore = linInv100(absFunding, 0.02, 0.22)
    lines.push(`OKX BTC 永续 |费率| ${absFunding.toFixed(3)}%/期${absFunding > 0.15 ? " · 偏极端" : ""}`)
  } else lines.push("资金费率：数据暂缺")

  let oiMom = 0
  if (m.oiUsdSeries.length >= 2) {
    const first = m.oiUsdSeries[0]
    const last = m.oiUsdSeries[m.oiUsdSeries.length - 1]
    if (first > 0) oiMom = ((last - first) / first) * 100
  }

  let oiScore = 50
  if (m.oiUsdSeries.length >= 2) {
    if (oiMom >= -5 && oiMom <= 12) oiScore = linTo100(oiMom, -5, 12)
    else if (oiMom > 12 && oiMom <= 22) oiScore = 85 - (oiMom - 12) * 2
    else if (oiMom > 22) oiScore = clamp(65 - (oiMom - 22) * 1.5, 15, 65)
    else oiScore = linTo100(oiMom, -25, -5)
    lines.push(`OKX OI(USD Rubik·1h) · 窗口 Δ ${oiMom >= 0 ? "+" : ""}${oiMom.toFixed(1)}%`)
  } else lines.push("OI 历史：暂缺")

  if (m.longShortRatio !== null) {
    const lsScore =
      m.longShortRatio > 1.35 ? linInv100(m.longShortRatio, 1.35, 1.75) : linTo100(m.longShortRatio, 0.85, 1.35)
    lines.push(`OKX BTC 永续 多空账户比 ${m.longShortRatio.toFixed(3)}`)
    const blended = 0.45 * fundingScore + 0.4 * oiScore + 0.15 * lsScore
    return {
      id: "leverage",
      label: "杠杆情绪",
      score: clamp(blended, 0, 100),
      weighted: clamp(blended, 0, 100) * REGIME_WEIGHTS.leverage,
      detailLines: lines,
    }
  }

  const blended = 0.5 * fundingScore + 0.5 * oiScore
  return {
    id: "leverage",
    label: "杠杆情绪",
    score: clamp(blended, 0, 100),
    weighted: clamp(blended, 0, 100) * REGIME_WEIGHTS.leverage,
    detailLines: lines,
  }
}

function scoreOnchainCycle(m: RawRegimeMetrics): RegimeFactorPayload {
  const lines: string[] = []
  const blocks: Array<{ score: number; weight: number }> = []

  if (m.priceVsSma200GapPct !== null) {
    blocks.push({
      score: linTo100(m.priceVsSma200GapPct, -18, 18),
      weight: 0.38,
    })
    lines.push(`Blockchain.info BTCUSD 指数 vs SMA200 · ${m.priceVsSma200GapPct >= 0 ? "+" : ""}${m.priceVsSma200GapPct.toFixed(2)}%`)
  } else lines.push("Blockchain.info BTCUSD SMA200：数据不足")

  if (m.athDistancePct !== null) {
    const draw = Math.abs(m.athDistancePct)
    blocks.push({
      score: linTo100(draw, 6, 68),
      weight: 0.32,
    })
    lines.push(`CoinGecko · 现价较 ATH ${m.athDistancePct.toFixed(2)}%`)
  } else lines.push("ATH 回撤：CoinGecko 暂缺")

  if (m.exchangeBtcPct7d !== null) {
    blocks.push({
      score: linInv100(m.exchangeBtcPct7d, -1.5, 1.5),
      weight: 0.17,
    })
    lines.push(`CoinGlass CEX BTC 加权库存 7D ${m.exchangeBtcPct7d >= 0 ? "+" : ""}${m.exchangeBtcPct7d.toFixed(2)}%（流出利多）`)
  } else {
    lines.push("CEX BTC 库存 7D：需 CoinGlass / COINGLASS_API_KEY")
  }

  if (m.hashrateRatioTail !== null) {
    blocks.push({
      score: linTo100((m.hashrateRatioTail - 1) * 120, -8, 8),
      weight: 0.13,
    })
    lines.push(`mempool.space 全网算力 · 末期/尾部均值比值 ${m.hashrateRatioTail.toFixed(4)}`)
  } else lines.push("全网算力动量：mempool.space 暂缺")

  const score = blendWeighted(blocks)
  return {
    id: "onchainCycle",
    label: "链上周期",
    score,
    weighted: score * REGIME_WEIGHTS.onchainCycle,
    detailLines: lines,
  }
}

function scoreMarketStructure(m: RawRegimeMetrics): RegimeFactorPayload {
  const lines: string[] = []
  let cvdScore = 50
  if (m.takerNetRecent !== null && Number.isFinite(m.takerNetRecent)) {
    const n = m.takerNetRecent
    cvdScore = linTo100(n, -1, 1)
    lines.push(`OKX Taker(1h)·近窗净强弱 ${n >= 0 ? "+" : ""}${n.toFixed(3)}`)
  } else lines.push("OKX Taker：—")

  let depthScore = 50
  if (m.orderBookImbalancePct !== null) {
    depthScore = linTo100(m.orderBookImbalancePct, -25, 25)
    lines.push(`OKX BTC 永续 Top20 深度失衡 ${m.orderBookImbalancePct >= 0 ? "+" : ""}${m.orderBookImbalancePct.toFixed(1)}%`)
  } else lines.push("深度：—")

  let volScore = 50
  if (m.volumeSpikeRatio !== null) {
    volScore = linTo100(m.volumeSpikeRatio, 0.65, 1.85)
    lines.push(`OKX BTC 永续 4H · 量比 ${m.volumeSpikeRatio.toFixed(2)}`)
  } else lines.push("量比：—")

  let trendScore = 50
  if (m.priceChange24hPct !== null) {
    trendScore = linTo100(m.priceChange24hPct, -4, 4)
    lines.push(`OKX BTC 永续 24h ${m.priceChange24hPct >= 0 ? "+" : ""}${m.priceChange24hPct.toFixed(2)}%`)
  }

  const score = clamp(0.28 * cvdScore + 0.28 * depthScore + 0.24 * volScore + 0.2 * trendScore, 0, 100)
  return {
    id: "marketStructure",
    label: "市场结构",
    score,
    weighted: score * REGIME_WEIGHTS.marketStructure,
    detailLines: lines,
  }
}

function scoreOptions(m: RawRegimeMetrics): RegimeFactorPayload {
  const lines: string[] = []

  let dvolBand = 50
  if (m.dvolClose !== null) {
    const v = m.dvolClose
    dvolBand = clamp(94 - Math.abs(v - 43) * 1.95, 24, 94)
    if (v > 68) dvolBand -= (v - 68) * 1.05
    if (v < 24) dvolBand -= (24 - v) * 0.85
    dvolBand = clamp(dvolBand, 0, 100)
    lines.push(`Deribit BTC DVOL 收盘 ${v.toFixed(1)}`)
  } else lines.push("Deribit DVOL：数据暂缺")

  let skew = 50
  if (m.optionPutCallRatio7d !== null) {
    const r = m.optionPutCallRatio7d
    skew = linInv100(r, 0.48, 0.93)
    lines.push(`Deribit BTC 期权 Put/Call(7d 成交 BTC) · ${r.toFixed(3)}`)
  } else lines.push("Deribit Put/Call：—")

  const score =
    m.dvolClose === null && m.optionPutCallRatio7d === null
      ? 48
      : m.dvolClose === null
        ? skew
        : m.optionPutCallRatio7d === null
          ? dvolBand
          : clamp(0.62 * dvolBand + 0.38 * skew, 0, 100)

  return {
    id: "options",
    label: "期权风险",
    score,
    weighted: score * REGIME_WEIGHTS.options,
    detailLines: lines,
  }
}

export function computeRegimeScore(m: RawRegimeMetrics): RegimeScoreComputation {
  const factors = [
    scoreCapitalFlows(m),
    scoreLeverage(m),
    scoreOnchainCycle(m),
    scoreMarketStructure(m),
    scoreOptions(m),
  ]

  const rawWeighted = factors.reduce((s, f) => s + f.weighted, 0)
  const penaltiesZh: string[] = []
  const boostsZh: string[] = []

  const absFunding = m.fundingRatePct === null ? 0 : Math.abs(m.fundingRatePct)
  let oiMom = 0
  if (m.oiUsdSeries.length >= 2) {
    const first = m.oiUsdSeries[0]
    const last = m.oiUsdSeries[m.oiUsdSeries.length - 1]
    if (first > 0) oiMom = ((last - first) / first) * 100
  }

  let total = rawWeighted

  if (absFunding > 0.12 && oiMom > 14) {
    total -= 10
    penaltiesZh.push("资金费率偏极端且 OI 快速抬升 → 杠杆拥挤，总分降权")
  }
  if (absFunding > 0.2) {
    total -= 6
    penaltiesZh.push("资金费率极端 → 轧空/踩踏风险升维")
  }
  if (oiMom > 28) {
    total -= 5
    penaltiesZh.push("OI 飙涨过快 → 清算与波动风险")
  }

  const momentumOk =
    (m.stablecoinPct7d ?? -1) > 0.23 &&
    (m.etfDailyDeltaVsPriorWeekUsd ?? Number.NEGATIVE_INFINITY) > 42_000_000 &&
    (m.etfAvgDailyUsdLast5 ?? 0) > 110_000_000

  if (momentumOk) {
    total += 4
    boostsZh.push("DefiLlama 稳定币扩张 + CoinGlass ETF 周势能转正 → 提高趋势置信度")
  }

  total = clamp(total, 0, 100)
  const { band, labelZh } = signalFromTotal(total)

  return {
    total,
    rawWeighted: clamp(rawWeighted, 0, 100),
    signalBand: band,
    signalLabelZh: labelZh,
    factors,
    penaltiesZh,
    boostsZh,
  }
}
