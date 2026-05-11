"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts"
import {
  Activity,
  AlertTriangle,
  Gauge,
  ShieldAlert,
  Waves,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { SeriesChart } from "@/components/series-chart"
import { getTimeRange, type TimeRangeId } from "@/lib/time-range"

type SignalDirection = "Buy Watch" | "Sell Watch" | "Neutral" | "High Risk"

interface KlinePoint {
  time: number
  label: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  changePercent: number
  upperWickRatio: number
  lowerWickRatio: number
  isClosed: boolean
}

interface LiquidationEvent {
  id: string
  time: number
  side: "long" | "short"
  usd: number
}

interface OpenInterestPoint {
  time: number
  value: number
}

interface FundingRatePoint {
  time: number
  rate: number
}

interface LongShortRatioPoint {
  time: number
  ratio: number
}

interface DepthLevel {
  price: number
  quantity: number
  notional: number
}

interface OrderBookState {
  bidDepth: number
  askDepth: number
  bidAskRatio: number
  imbalance: number
  bids: DepthLevel[]
  asks: DepthLevel[]
}

interface VolatilitySignal {
  direction: SignalDirection
  headline: string
  buyScore: number
  sellScore: number
  riskScore: number
  riskLevel: "Low" | "Medium" | "High"
  triggerReasons: string[]
  invalidationRules: string[]
}

interface HistorySignal extends VolatilitySignal {
  id: string
  time: number
  price: number
}

interface DerivativesResponse {
  source: string
  instrumentId: string
  base: string
  bar: string
  range: TimeRangeId
  ticker: {
    price: number
    change24h: number
    changePercent24h: number
    high24h: number
    low24h: number
    volume24hUsd: number
  }
  oneMinuteKlines: KlinePoint[]
  fiveMinuteKlines: KlinePoint[]
  rangeKlines: KlinePoint[]
  orderBook: OrderBookState
  openInterest: {
    btc: number
    usd: number
  }
  openInterestHistory: Array<{
    time: number
    valueUsd: number
  }>
  fundingRate: {
    rate: number
    nextFundingTime: number
  }
  fundingRateHistory: FundingRatePoint[]
  longShortAccountRatioHistory: LongShortRatioPoint[]
  contractLongShortRatioHistory: LongShortRatioPoint[]
}

const MAX_KLINES = 80
const FIVE_MINUTES = 5 * 60 * 1000
const DERIVATIVES_POLL_MS = 10 * 1000

const THRESHOLDS = {
  priceZ: 2.5,
  wickRatio: 0.55,
  volumeZ: 2.5,
  liquidationUsd: 1_000_000,
  oiDropPercent: -2,
  buyBidAskRatio: 1.2,
  sellBidAskRatio: 0.8,
}

const emptyOrderBook: OrderBookState = {
  bidDepth: 0,
  askDepth: 0,
  bidAskRatio: 1,
  imbalance: 0,
  bids: [],
  asks: [],
}

const formatUsd = (value: number, maximumFractionDigits = 0) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  })

const formatCompactUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)

const formatPercent = (value: number, digits = 2) => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const calculateZScore = (values: number[], currentValue: number) => {
  if (values.length < 8) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const standardDeviation = Math.sqrt(variance)
  if (standardDeviation === 0) return 0
  return (currentValue - mean) / standardDeviation
}

const sumLiquidations = (events: LiquidationEvent[], side: "long" | "short") =>
  events.reduce((sum, event) => (event.side === side ? sum + event.usd : sum), 0)

const calculateOiChangeRate = (history: OpenInterestPoint[]) => {
  const latest = history.at(-1)
  if (!latest) return 0
  const prior = [...history].reverse().find((point) => latest.time - point.time >= FIVE_MINUTES)
  if (!prior || prior.value === 0) return 0
  return ((latest.value - prior.value) / prior.value) * 100
}

const getCurrentSignal = ({
  latest1m,
  latest5m,
  fiveMinuteKlines,
  volumeZScore,
  fiveMinuteReturnZScore,
  longLiquidations,
  shortLiquidations,
  oiChangeRate,
  orderBook,
  base,
}: {
  latest1m?: KlinePoint
  latest5m?: KlinePoint
  fiveMinuteKlines: KlinePoint[]
  volumeZScore: number
  fiveMinuteReturnZScore: number
  longLiquidations: number
  shortLiquidations: number
  oiChangeRate: number
  orderBook: OrderBookState
  base: string
}): VolatilitySignal => {
  const previousFiveMinuteKlines = fiveMinuteKlines.slice(0, -1)
  const latestPrice = latest5m?.close ?? latest1m?.close ?? 0
  const previousLow = Math.min(...previousFiveMinuteKlines.map((kline) => kline.low))
  const previousHigh = Math.max(...previousFiveMinuteKlines.map((kline) => kline.high))
  const isBreakingLower = Boolean(latest5m && previousFiveMinuteKlines.length > 0 && latestPrice < previousLow)
  const isBreakingHigher = Boolean(latest5m && previousFiveMinuteKlines.length > 0 && latestPrice > previousHigh)
  const priceStillFallingWithOi = Boolean(latest5m && latest5m.changePercent < 0 && oiChangeRate > 0.2)
  const priceStillRisingWithOi = Boolean(latest5m && latest5m.changePercent > 0 && oiChangeRate > 0.2)

  const buyConditions = {
    downsideShock: fiveMinuteReturnZScore < -THRESHOLDS.priceZ,
    lowerWick: (latest5m?.lowerWickRatio ?? 0) > THRESHOLDS.wickRatio,
    volumeExpansion: volumeZScore > THRESHOLDS.volumeZ,
    longLiquidationExpansion: longLiquidations > THRESHOLDS.liquidationUsd,
    oiFlush: oiChangeRate < THRESHOLDS.oiDropPercent,
    bidDepthRecovery: orderBook.bidAskRatio > THRESHOLDS.buyBidAskRatio,
  }

  const sellConditions = {
    upsideShock: fiveMinuteReturnZScore > THRESHOLDS.priceZ,
    upperWick: (latest5m?.upperWickRatio ?? 0) > THRESHOLDS.wickRatio,
    volumeExpansion: volumeZScore > THRESHOLDS.volumeZ,
    shortLiquidationExpansion: shortLiquidations > THRESHOLDS.liquidationUsd,
    oiFlush: oiChangeRate < THRESHOLDS.oiDropPercent,
    askDepthRecovery: orderBook.bidAskRatio < THRESHOLDS.sellBidAskRatio,
  }

  const buyScore = clampScore(
    Number(buyConditions.downsideShock) * 18 +
      Number(buyConditions.lowerWick) * 18 +
      Number(buyConditions.volumeExpansion) * 16 +
      Number(buyConditions.longLiquidationExpansion) * 14 +
      Number(buyConditions.oiFlush) * 16 +
      Number(buyConditions.bidDepthRecovery) * 18,
  )

  const sellScore = clampScore(
    Number(sellConditions.upsideShock) * 18 +
      Number(sellConditions.upperWick) * 18 +
      Number(sellConditions.volumeExpansion) * 16 +
      Number(sellConditions.shortLiquidationExpansion) * 14 +
      Number(sellConditions.oiFlush) * 16 +
      Number(sellConditions.askDepthRecovery) * 18,
  )

  const highRiskBuyTrap = isBreakingLower && priceStillFallingWithOi
  const highRiskSellTrap = isBreakingHigher && priceStillRisingWithOi
  const liquidationStress = Math.min(28, ((longLiquidations + shortLiquidations) / THRESHOLDS.liquidationUsd) * 8)
  const orderBookStress = Math.min(20, Math.abs(orderBook.imbalance) * 0.4)
  const volatilityStress = Math.min(28, Math.abs(fiveMinuteReturnZScore) * 8 + Math.max(0, volumeZScore) * 3)
  const riskScore = clampScore(
    liquidationStress +
      orderBookStress +
      volatilityStress +
      Number(highRiskBuyTrap || highRiskSellTrap) * 35 +
      Number(oiChangeRate > 0.2) * 10,
  )

  const riskLevel = riskScore >= 70 ? "High" : riskScore >= 35 ? "Medium" : "Low"

  if (highRiskBuyTrap || highRiskSellTrap) {
    return {
      direction: "High Risk",
      headline: highRiskBuyTrap ? "下跌延续且 OI 回升，暂不接针" : "上涨延续且 OI 回升，暂不追空",
      buyScore,
      sellScore,
      riskScore,
      riskLevel: "High",
      triggerReasons: [
        highRiskBuyTrap ? "价格继续刷新 5m 新低" : "价格继续刷新 5m 新高",
        `OI 5m 变化率 ${formatPercent(oiChangeRate)}，杠杆仓位仍在增加`,
        highRiskBuyTrap ? "价格下跌与 OI 上升同步，存在继续踩踏风险" : "价格上涨与 OI 上升同步，存在继续逼空风险",
      ],
      invalidationRules: [
        "OI 5m 变化率转为下降并低于 -2%",
        "价格重新站回上一根 5m K 线实体区间",
        "订单簿 Bid / Ask Ratio 回到 0.9 - 1.1 的均衡区间",
      ],
    }
  }

  const hasCoreBuySetup =
    buyConditions.downsideShock &&
    buyConditions.lowerWick &&
    buyConditions.volumeExpansion &&
    buyConditions.oiFlush &&
    buyConditions.bidDepthRecovery
  const hasCoreSellSetup =
    sellConditions.upsideShock &&
    sellConditions.upperWick &&
    sellConditions.volumeExpansion &&
    sellConditions.oiFlush &&
    sellConditions.askDepthRecovery

  if (hasCoreBuySetup) {
    return {
      direction: "Buy Watch",
      headline: `${base} 暴跌插针后的反弹观察`,
      buyScore,
      sellScore,
      riskScore,
      riskLevel,
      triggerReasons: [
        `5m 跌幅 z-score ${fiveMinuteReturnZScore.toFixed(2)} < -${THRESHOLDS.priceZ}`,
        `下影线比例 ${((latest5m?.lowerWickRatio ?? 0) * 100).toFixed(0)}% > 55%`,
        `成交量 z-score ${volumeZScore.toFixed(2)} > ${THRESHOLDS.volumeZ}`,
        longLiquidations > 0
          ? `5m 多头爆仓 ${formatCompactUsd(longLiquidations)} 明显放大`
          : "公开源未返回逐笔爆仓，信号以 OI 清洗、盘口恢复和放量确认",
        `OI 5m 变化率 ${formatPercent(oiChangeRate)} < -2%`,
        `Bid / Ask Ratio ${orderBook.bidAskRatio.toFixed(2)} > 1.20，买盘深度恢复`,
      ],
      invalidationRules: [
        "价格跌破插针低点并持续创新低",
        "OI 转为上升且价格继续下跌",
        "Bid / Ask Ratio 跌回 1.0 以下或成交量扩张消失",
      ],
    }
  }

  if (hasCoreSellSetup) {
    return {
      direction: "Sell Watch",
      headline: `${base} 暴涨插针后的回落观察`,
      buyScore,
      sellScore,
      riskScore,
      riskLevel,
      triggerReasons: [
        `5m 涨幅 z-score ${fiveMinuteReturnZScore.toFixed(2)} > ${THRESHOLDS.priceZ}`,
        `上影线比例 ${((latest5m?.upperWickRatio ?? 0) * 100).toFixed(0)}% > 55%`,
        `成交量 z-score ${volumeZScore.toFixed(2)} > ${THRESHOLDS.volumeZ}`,
        shortLiquidations > 0
          ? `5m 空头爆仓 ${formatCompactUsd(shortLiquidations)} 明显放大`
          : "公开源未返回逐笔爆仓，信号以 OI 清洗、盘口恢复和放量确认",
        `OI 5m 变化率 ${formatPercent(oiChangeRate)} < -2%`,
        `Bid / Ask Ratio ${orderBook.bidAskRatio.toFixed(2)} < 0.80，卖盘深度恢复`,
      ],
      invalidationRules: [
        "价格突破插针高点并持续创新高",
        "OI 转为上升且价格继续上涨",
        "Bid / Ask Ratio 回到 1.0 以上或成交量扩张消失",
      ],
    }
  }

  return {
    direction: "Neutral",
    headline: "阈值未形成单边观察信号",
    buyScore,
    sellScore,
    riskScore,
    riskLevel,
    triggerReasons: [
      `5m return z-score ${fiveMinuteReturnZScore.toFixed(2)}，成交量 z-score ${volumeZScore.toFixed(2)}`,
      `上影线 ${(((latest5m?.upperWickRatio ?? 0) * 100)).toFixed(0)}%，下影线 ${(((latest5m?.lowerWickRatio ?? 0) * 100)).toFixed(0)}%`,
      `Bid / Ask Ratio ${orderBook.bidAskRatio.toFixed(2)}，OI 5m ${formatPercent(oiChangeRate)}`,
    ],
    invalidationRules: [
      "任一方向满足价格 z-score、插针、放量、爆仓、OI 清洗和订单簿恢复的完整组合",
      "价格继续创新高/新低且 OI 同步上升时切换为 High Risk",
    ],
  }
}

function MiniKlineChart({ title, data, info }: { title: string; data: KlinePoint[]; info?: string }) {
  const chartData = data.slice(-50)
  const minLow = chartData.length ? Math.min(...chartData.map((point) => point.low)) : 0
  const maxHigh = chartData.length ? Math.max(...chartData.map((point) => point.high)) : 1
  const priceRange = Math.max(maxHigh - minLow, Number.EPSILON)
  const candleWidth = 320 / Math.max(chartData.length, 1)
  const toY = (price: number) => 120 - ((price - minLow) / priceRange) * 100 - 10

  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {info && <InfoTooltip description={info} />}
        </div>
        <span className="text-[10px] text-muted-foreground">{chartData.length} candles</span>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">等待 K 线数据...</div>
      ) : (
        <svg viewBox="0 0 340 130" className="h-32 w-full overflow-visible">
          {chartData.map((point, index) => {
            const x = index * candleWidth + candleWidth / 2 + 8
            const isUp = point.close >= point.open
            const bodyTop = toY(Math.max(point.open, point.close))
            const bodyBottom = toY(Math.min(point.open, point.close))
            const bodyHeight = Math.max(2, bodyBottom - bodyTop)
            return (
              <g key={`${point.time}-${point.label}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={toY(point.high)}
                  y2={toY(point.low)}
                  stroke={isUp ? "rgb(22 163 74)" : "rgb(220 38 38)"}
                  strokeWidth="1.2"
                />
                <rect
                  x={x - Math.max(2, candleWidth * 0.28)}
                  y={bodyTop}
                  width={Math.max(3, candleWidth * 0.56)}
                  height={bodyHeight}
                  rx="1"
                  fill={isUp ? "rgb(22 163 74)" : "rgb(220 38 38)"}
                  opacity={point.isClosed ? 0.95 : 0.55}
                />
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  tone = "default",
  info,
}: {
  label: string
  value: string
  helper: string
  tone?: "default" | "green" | "red" | "amber"
  info?: { title?: string; description: string }
}) {
  const toneClass = {
    default: "text-foreground",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
  }[tone]

  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {info && <InfoTooltip title={info.title ?? label} description={info.description} />}
      </div>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function SignalBadge({ direction }: { direction: SignalDirection }) {
  if (direction === "Buy Watch") {
    return <Badge className="bg-green-600 text-white hover:bg-green-600">Buy Watch</Badge>
  }
  if (direction === "Sell Watch") {
    return <Badge className="bg-red-600 text-white hover:bg-red-600">Sell Watch</Badge>
  }
  if (direction === "High Risk") {
    return <Badge variant="destructive">High Risk</Badge>
  }
  return <Badge variant="secondary">Neutral</Badge>
}

interface BtcVolatilitySystemProps {
  instId?: string
  range?: TimeRangeId
}

export function BtcVolatilitySystem({ instId = "BTC-USDT-SWAP", range = "1mo" }: BtcVolatilitySystemProps) {
  const base = instId.split("-")[0] ?? "BTC"
  const rangeOption = getTimeRange(range)

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">(
    "connecting",
  )
  const [dataSource, setDataSource] = useState("OKX Public API")
  const [dataError, setDataError] = useState<string | null>(null)
  const [price, setPrice] = useState(0)
  const [priceChange24h, setPriceChange24h] = useState(0)
  const [oneMinuteKlines, setOneMinuteKlines] = useState<KlinePoint[]>([])
  const [fiveMinuteKlines, setFiveMinuteKlines] = useState<KlinePoint[]>([])
  const [rangeKlines, setRangeKlines] = useState<KlinePoint[]>([])
  const [orderBook, setOrderBook] = useState<OrderBookState>(emptyOrderBook)
  const [liquidations] = useState<LiquidationEvent[]>([])
  const [fundingRate, setFundingRate] = useState(0)
  const [openInterest, setOpenInterest] = useState(0)
  const [openInterestUsd, setOpenInterestUsd] = useState(0)
  const [openInterestHistory, setOpenInterestHistory] = useState<OpenInterestPoint[]>([])
  const [fundingRateHistory, setFundingRateHistory] = useState<FundingRatePoint[]>([])
  const [longShortAccountRatioHistory, setLongShortAccountRatioHistory] = useState<LongShortRatioPoint[]>([])
  const [contractLongShortRatioHistory, setContractLongShortRatioHistory] = useState<LongShortRatioPoint[]>([])
  const [historySignals, setHistorySignals] = useState<HistorySignal[]>([])
  const lastSignalKeyRef = useRef("")

  useEffect(() => {
    let isActive = true
    lastSignalKeyRef.current = ""
    setHistorySignals([])

    async function loadDerivativesData() {
      try {
        setConnectionStatus((status) => (status === "live" ? "live" : "connecting"))
        const response = await fetch(
          `/api/crypto/btc-derivatives?instId=${encodeURIComponent(instId)}&range=${range}`,
          { cache: "no-store" },
        )
        const payload = (await response.json()) as DerivativesResponse & { error?: string }

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load derivatives data")
        }

        if (!isActive) return

        setDataSource(payload.source)
        setPrice(payload.ticker.price)
        setPriceChange24h(payload.ticker.changePercent24h)
        setOneMinuteKlines(payload.oneMinuteKlines.slice(-MAX_KLINES))
        setFiveMinuteKlines(payload.fiveMinuteKlines.slice(-MAX_KLINES))
        setRangeKlines(payload.rangeKlines ?? [])
        setOrderBook(payload.orderBook)
        setOpenInterest(payload.openInterest.btc)
        setOpenInterestUsd(payload.openInterest.usd)
        setOpenInterestHistory(
          payload.openInterestHistory.map((point) => ({ time: point.time, value: point.valueUsd })),
        )
        setFundingRate(payload.fundingRate.rate)
        setFundingRateHistory(payload.fundingRateHistory)
        setLongShortAccountRatioHistory(payload.longShortAccountRatioHistory)
        setContractLongShortRatioHistory(payload.contractLongShortRatioHistory)
        setDataError(null)
        setConnectionStatus("live")
      } catch (error) {
        if (!isActive) return
        setDataError(error instanceof Error ? error.message : "Failed to load derivatives data")
        setConnectionStatus("offline")
      }
    }

    loadDerivativesData()
    const interval = setInterval(loadDerivativesData, DERIVATIVES_POLL_MS)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [instId, range])

  const now = Date.now()
  const recentLiquidations = useMemo(
    () => liquidations.filter((event) => now - event.time <= FIVE_MINUTES),
    [liquidations, now],
  )
  const latest1m = oneMinuteKlines.at(-1)
  const latest5m = fiveMinuteKlines.at(-1)
  const oneMinuteVolumeSample = oneMinuteKlines.slice(-31, -1).map((kline) => kline.volume)
  const fiveMinuteReturnSample = fiveMinuteKlines.slice(-31, -1).map((kline) => kline.changePercent)
  const volumeZScore = calculateZScore(oneMinuteVolumeSample, latest1m?.volume ?? 0)
  const fiveMinuteReturnZScore = calculateZScore(fiveMinuteReturnSample, latest5m?.changePercent ?? 0)
  const oiChangeRate = calculateOiChangeRate(openInterestHistory)
  const longLiquidations = sumLiquidations(recentLiquidations, "long")
  const shortLiquidations = sumLiquidations(recentLiquidations, "short")

  const currentSignal = useMemo(
    () =>
      getCurrentSignal({
        latest1m,
        latest5m,
        fiveMinuteKlines,
        volumeZScore,
        fiveMinuteReturnZScore,
        longLiquidations,
        shortLiquidations,
        oiChangeRate,
        orderBook,
        base,
      }),
    [
      latest1m,
      latest5m,
      fiveMinuteKlines,
      volumeZScore,
      fiveMinuteReturnZScore,
      longLiquidations,
      shortLiquidations,
      oiChangeRate,
      orderBook,
      base,
    ],
  )

  useEffect(() => {
    if (currentSignal.direction === "Neutral" || price === 0) return
    const signalKey = `${currentSignal.direction}-${currentSignal.buyScore}-${currentSignal.sellScore}-${currentSignal.riskScore}`
    if (lastSignalKeyRef.current === signalKey) return
    lastSignalKeyRef.current = signalKey
    setHistorySignals((previous) =>
      [
        {
          ...currentSignal,
          id: `${Date.now()}-${currentSignal.direction}`,
          time: Date.now(),
          price,
        },
        ...previous,
      ].slice(0, 12),
    )
  }, [currentSignal, price])

  const volumeChartData = oneMinuteKlines.slice(-40).map((kline) => ({ time: kline.label, volume: kline.volume }))

  const rangePriceChartData = rangeKlines.map((kline) => ({ timestamp: kline.time, value: kline.close }))
  const oiChartData = openInterestHistory.slice(-180).map((point) => ({ timestamp: point.time, value: point.value }))
  const fundingChartData = fundingRateHistory.map((point) => ({ timestamp: point.time, value: point.rate }))
  const accountRatioChartData = longShortAccountRatioHistory
    .slice(-180)
    .map((point) => ({ timestamp: point.time, value: point.ratio }))
  const contractRatioChartData = contractLongShortRatioHistory
    .slice(-180)
    .map((point) => ({ timestamp: point.time, value: point.ratio }))
  const latestAccountRatio = longShortAccountRatioHistory.at(-1)?.ratio ?? 0
  const latestContractRatio = contractLongShortRatioHistory.at(-1)?.ratio ?? 0

  const orderBookRows = [
    ...orderBook.asks.slice(0, 6).reverse().map((level) => ({ ...level, side: "ask" as const })),
    ...orderBook.bids.slice(0, 6).map((level) => ({ ...level, side: "bid" as const })),
  ]
  const maxDepth = Math.max(...orderBookRows.map((row) => row.notional), 1)

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={connectionStatus === "live" ? "default" : "secondary"}>
                    {connectionStatus === "live" ? "Live" : connectionStatus}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {dataSource} · {instId} · {rangeOption.label} ({rangeOption.yahooInterval || rangeOption.okxBar})
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">{base} 极端波动监控</h2>
                <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
                  价格 / K 线 / OI 历史 / 资金费率 / 多空比 / 订单簿失衡 全部使用 OKX 公开接口拉取。
                </p>
                {dataError && <p className="mt-1 text-[11px] text-destructive">{dataError}</p>}
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">{base} Price</p>
                <p className="text-2xl font-semibold tabular-nums">{price ? formatUsd(price, 2) : "..."}</p>
                <p className={priceChange24h >= 0 ? "text-xs text-green-600" : "text-xs text-red-600"}>
                  24h {formatPercent(priceChange24h)}
                </p>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="5m 涨跌 Z-Score"
                value={fiveMinuteReturnZScore.toFixed(2)}
                helper={`最新 5m ${formatPercent(latest5m?.changePercent ?? 0)}`}
                tone={fiveMinuteReturnZScore > 2.5 ? "green" : fiveMinuteReturnZScore < -2.5 ? "red" : "default"}
                info={{
                  title: "5 分钟收益率 Z-Score",
                  description:
                    "用最近 30 根 5m K 线的涨跌幅算均值/方差，与最新一根做标准化。\n|Z| > 2.5 表示当前 5m 行情超过 99% 历史样本的极端值，常作为暴涨/暴跌的一个量化触发器。",
                }}
              />
              <MetricCard
                label="插针比例"
                value={`↑${(((latest5m?.upperWickRatio ?? 0) * 100)).toFixed(0)}% / ↓${(((latest5m?.lowerWickRatio ?? 0) * 100)).toFixed(0)}%`}
                helper="基于当前 5m K 线高低点和实体"
                tone={(latest5m?.upperWickRatio ?? 0) > 0.55 || (latest5m?.lowerWickRatio ?? 0) > 0.55 ? "amber" : "default"}
                info={{
                  description: "上/下影线占整根 K 线的比例，越大说明长上下影针越明显，常对应快速冲高回落或闪崩反弹。",
                }}
              />
              <MetricCard
                label="Volume Z-Score"
                value={volumeZScore.toFixed(2)}
                helper={`1m 成交量 ${((latest1m?.volume ?? 0) / 1000).toFixed(2)}K ${base}`}
                tone={volumeZScore > 2.5 ? "amber" : "default"}
                info={{
                  description: "1 分钟成交量相对最近 30 根的标准化分数。> 2.5 表示放量，越大越极端。",
                }}
              />
              <MetricCard
                label="OI / Funding"
                value={`${formatPercent(oiChangeRate)} / ${fundingRate.toFixed(4)}%`}
                helper={`OI ${formatCompactUsd(openInterestUsd)} / ${openInterest.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${base}`}
                tone={oiChangeRate < -2 ? "green" : oiChangeRate > 0.2 ? "red" : "default"}
                info={{
                  description:
                    "OI（未平仓合约）短期变化率 + 当前永续资金费率。\nOI 急降配合价格止跌 = 杠杆清洗；资金费率高且持续为正 = 多头拥挤。",
                }}
              />
            </div>
          </div>

          <div className="border-t bg-muted/30 p-3 lg:border-l lg:border-t-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Current Signal</p>
                <h3 className="text-base font-semibold">{currentSignal.headline}</h3>
              </div>
              <SignalBadge direction={currentSignal.direction} />
            </div>
            <div className="space-y-2">
              <ScoreBar label="Buy Score" value={currentSignal.buyScore} />
              <ScoreBar label="Sell Score" value={currentSignal.sellScore} />
              <ScoreBar label={`Risk Score (${currentSignal.riskLevel})`} value={currentSignal.riskScore} />
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <p className="mb-1 font-medium">触发原因</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {currentSignal.triggerReasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-medium">失效条件</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {currentSignal.invalidationRules.map((rule) => (
                    <li key={rule}>- {rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {rangePriceChartData.length > 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm">
                {base} 价格 — {rangeOption.label} ({rangeOption.okxBar})
              </CardTitle>
              <InfoTooltip
                description={`基于 OKX 永续合约 ${rangeOption.okxBar} K 线收盘价。切换右上角时间周期可看到不同颗粒度（默认 1 月 / 1H 线）。`}
                source="OKX Public API"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{rangePriceChartData.length} bars</span>
          </CardHeader>
          <CardContent className="pt-0">
            <SeriesChart
              data={rangePriceChartData}
              unit="usd"
              height={180}
              color="rgb(99 102 241)"
              label={`${base} Close`}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                <CardTitle className="text-sm">实时 K 线与成交量</CardTitle>
                <InfoTooltip description="左：1 分钟 K 线（信号触发的基础颗粒度）；右：5 分钟 K 线（用于 5m 涨跌 Z-Score 与影线判断）；下：1m 成交量。" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 lg:grid-cols-2">
                <MiniKlineChart title="1m K 线" data={oneMinuteKlines} info="高频颗粒度，监控 1 分钟级别的瞬时动量。" />
                <MiniKlineChart title="5m K 线" data={fiveMinuteKlines} info="5 分钟颗粒度，配合插针比例判断暴涨暴跌。" />
              </div>
              <div className="rounded-lg border bg-background/80 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm font-medium">成交量图</h3>
                    <InfoTooltip description="1m 成交量柱状图。Volume Z-Score 高时通常对应资金大幅进出。" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Volume Z {volumeZScore.toFixed(2)}</span>
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeChartData}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                      <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} fontSize={10} />
                      <YAxis tickLine={false} axisLine={false} width={40} fontSize={10} />
                      <RechartsTooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        formatter={(value: number) => [`${Number(value).toFixed(2)} ${base}`, "Volume"]}
                      />
                      <Bar dataKey="volume" fill="rgb(59 130 246)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-1">
                <div className="flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4" />
                  <CardTitle className="text-sm">OI / Funding / 多空比</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard
                    label="Open Interest"
                    value={formatCompactUsd(openInterestUsd)}
                    helper={`OKX ${instId}`}
                    tone="default"
                    info={{ description: "未平仓合约价值（USD）。OI 上升 = 新仓涌入，下降 = 仓位平仓或被强平。" }}
                  />
                  <MetricCard
                    label="资金费率"
                    value={`${fundingRate.toFixed(4)}%`}
                    helper="当前预测/结算费率"
                    tone={fundingRate >= 0 ? "green" : "red"}
                    info={{
                      description:
                        "永续合约多空之间的周期性资金交换。正 = 多头给空头付费（多头拥挤），负 = 空头给多头付费（空头拥挤）。",
                    }}
                  />
                  <MetricCard
                    label="多空账户比"
                    value={latestAccountRatio ? latestAccountRatio.toFixed(2) : "..."}
                    helper={`合约账户 ${latestContractRatio ? latestContractRatio.toFixed(2) : "..."}`}
                    tone="amber"
                    info={{
                      description:
                        "OKX Rubik：多空账户数比 / 多空合约持仓比。> 1 多头占优；< 1 空头占优。极端值常对应反向行情。",
                    }}
                  />
                </div>
                <div className="rounded-lg border bg-background/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">Open Interest 历史</h3>
                    <span className="text-[10px] text-muted-foreground">5m {formatPercent(oiChangeRate)}</span>
                  </div>
                  <SeriesChart data={oiChartData} unit="usd" height={120} color="rgb(99 102 241)" label="OI" compact />
                </div>
                <div className="rounded-lg border bg-background/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">资金费率历史</h3>
                    <span className="text-[10px] text-muted-foreground">8h funding</span>
                  </div>
                  <SeriesChart
                    data={fundingChartData}
                    unit="percent"
                    height={120}
                    color="rgb(245 158 11)"
                    label="Funding"
                    compact
                  />
                </div>
                <div className="rounded-lg border bg-background/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">多空比历史</h3>
                    <span className="text-[10px] text-muted-foreground">account / contract</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <SeriesChart
                      data={accountRatioChartData}
                      unit="ratio"
                      height={110}
                      color="rgb(20 184 166)"
                      label="Account L/S"
                      compact
                    />
                    <SeriesChart
                      data={contractRatioChartData}
                      unit="ratio"
                      height={110}
                      color="rgb(59 130 246)"
                      label="Contract L/S"
                      compact
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <div className="flex items-center gap-1">
                  <Waves className="h-4 w-4" />
                  <CardTitle className="text-sm">订单簿状态</CardTitle>
                  <InfoTooltip description="OKX 现货深度 Top 20。Bid/Ask Ratio > 1.2 买盘明显占优；< 0.8 卖盘明显占优。" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard label="买盘深度" value={formatCompactUsd(orderBook.bidDepth)} helper="Top 20 bids" tone="green" />
                  <MetricCard label="卖盘深度" value={formatCompactUsd(orderBook.askDepth)} helper="Top 20 asks" tone="red" />
                  <MetricCard
                    label="Bid / Ask Ratio"
                    value={orderBook.bidAskRatio.toFixed(2)}
                    helper={`失衡 ${orderBook.imbalance.toFixed(1)}%`}
                    tone={orderBook.bidAskRatio > 1.2 ? "green" : orderBook.bidAskRatio < 0.8 ? "red" : "default"}
                  />
                </div>
                <div className="space-y-0.5 rounded-lg border bg-background/80 p-2 font-mono text-[11px]">
                  {orderBookRows.length === 0 ? (
                    <div className="py-8 text-center font-sans text-xs text-muted-foreground">等待订单簿数据...</div>
                  ) : (
                    orderBookRows.map((row) => (
                      <div
                        key={`${row.side}-${row.price}`}
                        className="relative grid grid-cols-3 gap-2 overflow-hidden rounded px-2 py-0.5"
                      >
                        <div
                          className={`absolute inset-y-0 right-0 ${row.side === "bid" ? "bg-green-500/10" : "bg-red-500/10"}`}
                          style={{ width: `${(row.notional / maxDepth) * 100}%` }}
                        />
                        <span className={row.side === "bid" ? "relative text-green-600" : "relative text-red-600"}>
                          {row.price.toFixed(1)}
                        </span>
                        <span className="relative text-right">{row.quantity.toFixed(3)}</span>
                        <span className="relative text-right">{formatCompactUsd(row.notional)}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-1">
                <Gauge className="h-4 w-4" />
                <CardTitle className="text-sm">安全阈值</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">5m z-score</span>
                <span>±{THRESHOLDS.priceZ}</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">上/下影线比例</span>
                <span>&gt; 55%</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">成交量 z-score</span>
                <span>&gt; {THRESHOLDS.volumeZ}</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">OI 5m 清洗</span>
                <span>&lt; -2%</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">订单簿恢复</span>
                <span>&gt; 1.2 / &lt; 0.8</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                <CardTitle className="text-sm">历史信号列表</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {historySignals.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                  暂无 Buy Watch、Sell Watch 或 High Risk 信号。
                </div>
              ) : (
                <div className="space-y-2">
                  {historySignals.map((signal) => (
                    <div key={signal.id} className="rounded-lg border p-2">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div>
                          <SignalBadge direction={signal.direction} />
                          <p className="mt-1 text-xs font-medium">{signal.headline}</p>
                        </div>
                        <div className="text-right text-[10px] text-muted-foreground">
                          <p>{new Date(signal.time).toLocaleTimeString("zh-CN")}</p>
                          <p>{formatUsd(signal.price, 2)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div className="rounded bg-muted p-1.5">
                          <p className="text-muted-foreground">Buy</p>
                          <p className="font-semibold">{signal.buyScore}</p>
                        </div>
                        <div className="rounded bg-muted p-1.5">
                          <p className="text-muted-foreground">Sell</p>
                          <p className="font-semibold">{signal.sellScore}</p>
                        </div>
                        <div className="rounded bg-muted p-1.5">
                          <p className="text-muted-foreground">Risk</p>
                          <p className="font-semibold">{signal.riskScore}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
            <CardContent className="text-xs">
              <p className="font-medium">风险提示</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                本系统仅用于监控与观察，不构成交易建议。极端行情中数据推送可能延迟或缺失。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
