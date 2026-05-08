"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  ShieldAlert,
  Waves,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SignalDirection = "Buy Watch" | "Sell Watch" | "Neutral" | "High Risk"
type StreamName =
  | "btcusdt@ticker"
  | "btcusdt@kline_1m"
  | "btcusdt@kline_5m"
  | "btcusdt@depth20@100ms"
  | "btcusdt@forceOrder"
  | "btcusdt@markPrice@1s"

interface TickerPayload {
  s: string
  c: string
  p: string
  P: string
}

interface KlinePayload {
  k: {
    t: number
    T: number
    i: "1m" | "5m"
    o: string
    h: string
    l: string
    c: string
    v: string
    x: boolean
  }
}

interface DepthPayload {
  bids: [string, string][]
  asks: [string, string][]
}

interface ForceOrderPayload {
  o: {
    S: "BUY" | "SELL"
    q: string
    ap: string
    T: number
  }
}

interface MarkPricePayload {
  r: string
}

interface BinanceStreamMessage {
  stream: StreamName
  data: TickerPayload | KlinePayload | DepthPayload | ForceOrderPayload | MarkPricePayload
}

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

interface OrderBookState {
  bidDepth: number
  askDepth: number
  bidAskRatio: number
  imbalance: number
  bids: DepthLevel[]
  asks: DepthLevel[]
}

interface DepthLevel {
  price: number
  quantity: number
  notional: number
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

const STREAM_URL =
  "wss://fstream.binance.com/stream?streams=btcusdt@ticker/btcusdt@kline_1m/btcusdt@kline_5m/btcusdt@depth20@100ms/btcusdt@forceOrder/btcusdt@markPrice@1s"

const MAX_KLINES = 80
const FIVE_MINUTES = 5 * 60 * 1000
const OPEN_INTEREST_POLL_MS = 30 * 1000

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

const normalizeKline = (payload: KlinePayload): KlinePoint => {
  const { k } = payload
  const open = Number(k.o)
  const high = Number(k.h)
  const low = Number(k.l)
  const close = Number(k.c)
  const volume = Number(k.v)
  const range = Math.max(high - low, Number.EPSILON)
  const upperWickRatio = Math.max(0, (high - Math.max(open, close)) / range)
  const lowerWickRatio = Math.max(0, (Math.min(open, close) - low) / range)

  return {
    time: k.t,
    label: new Date(k.t).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    open,
    high,
    low,
    close,
    volume,
    changePercent: ((close - open) / open) * 100,
    upperWickRatio,
    lowerWickRatio,
    isClosed: k.x,
  }
}

const upsertKline = (klines: KlinePoint[], next: KlinePoint) => {
  const index = klines.findIndex((kline) => kline.time === next.time)

  if (index === -1) {
    return [...klines, next].slice(-MAX_KLINES)
  }

  const updated = [...klines]
  updated[index] = next
  return updated
}

const sumLiquidations = (events: LiquidationEvent[], side: "long" | "short") =>
  events.reduce((sum, event) => (event.side === side ? sum + event.usd : sum), 0)

const calculateOiChangeRate = (history: OpenInterestPoint[]) => {
  const latest = history.at(-1)
  if (!latest) return 0

  const prior = [...history]
    .reverse()
    .find((point) => latest.time - point.time >= FIVE_MINUTES)

  if (!prior || prior.value === 0) return 0

  return ((latest.value - prior.value) / prior.value) * 100
}

const calculateOrderBook = (payload: DepthPayload): OrderBookState => {
  const bids = payload.bids.map(([price, quantity]) => {
    const parsedPrice = Number(price)
    const parsedQuantity = Number(quantity)

    return {
      price: parsedPrice,
      quantity: parsedQuantity,
      notional: parsedPrice * parsedQuantity,
    }
  })

  const asks = payload.asks.map(([price, quantity]) => {
    const parsedPrice = Number(price)
    const parsedQuantity = Number(quantity)

    return {
      price: parsedPrice,
      quantity: parsedQuantity,
      notional: parsedPrice * parsedQuantity,
    }
  })

  const bidDepth = bids.reduce((sum, level) => sum + level.notional, 0)
  const askDepth = asks.reduce((sum, level) => sum + level.notional, 0)
  const bidAskRatio = askDepth > 0 ? bidDepth / askDepth : 1
  const imbalance = bidDepth + askDepth > 0 ? ((bidDepth - askDepth) / (bidDepth + askDepth)) * 100 : 0

  return {
    bidDepth,
    askDepth,
    bidAskRatio,
    imbalance,
    bids,
    asks,
  }
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

  if (Object.values(buyConditions).every(Boolean)) {
    return {
      direction: "Buy Watch",
      headline: "暴跌插针后的反弹观察",
      buyScore,
      sellScore,
      riskScore,
      riskLevel,
      triggerReasons: [
        `5m 跌幅 z-score ${fiveMinuteReturnZScore.toFixed(2)} < -${THRESHOLDS.priceZ}`,
        `下影线比例 ${((latest5m?.lowerWickRatio ?? 0) * 100).toFixed(0)}% > 55%`,
        `成交量 z-score ${volumeZScore.toFixed(2)} > ${THRESHOLDS.volumeZ}`,
        `5m 多头爆仓 ${formatCompactUsd(longLiquidations)} 明显放大`,
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

  if (Object.values(sellConditions).every(Boolean)) {
    return {
      direction: "Sell Watch",
      headline: "暴涨插针后的回落观察",
      buyScore,
      sellScore,
      riskScore,
      riskLevel,
      triggerReasons: [
        `5m 涨幅 z-score ${fiveMinuteReturnZScore.toFixed(2)} > ${THRESHOLDS.priceZ}`,
        `上影线比例 ${((latest5m?.upperWickRatio ?? 0) * 100).toFixed(0)}% > 55%`,
        `成交量 z-score ${volumeZScore.toFixed(2)} > ${THRESHOLDS.volumeZ}`,
        `5m 空头爆仓 ${formatCompactUsd(shortLiquidations)} 明显放大`,
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

function MiniKlineChart({ title, data }: { title: string; data: KlinePoint[] }) {
  const chartData = data.slice(-36)
  const minLow = Math.min(...chartData.map((point) => point.low))
  const maxHigh = Math.max(...chartData.map((point) => point.high))
  const priceRange = Math.max(maxHigh - minLow, Number.EPSILON)
  const candleWidth = 320 / Math.max(chartData.length, 1)

  const toY = (price: number) => 120 - ((price - minLow) / priceRange) * 100 - 10

  return (
    <div className="rounded-xl border bg-background/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{chartData.length} candles</span>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">等待 K 线数据...</div>
      ) : (
        <svg viewBox="0 0 340 130" className="h-40 w-full overflow-visible">
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
}: {
  label: string
  value: string
  helper: string
  tone?: "default" | "green" | "red" | "amber"
}) {
  const toneClass = {
    default: "text-foreground",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
  }[tone]

  return (
    <div className="rounded-xl border bg-background/70 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
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

export function BtcVolatilitySystem() {
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">(
    "connecting",
  )
  const [price, setPrice] = useState(0)
  const [priceChange24h, setPriceChange24h] = useState(0)
  const [oneMinuteKlines, setOneMinuteKlines] = useState<KlinePoint[]>([])
  const [fiveMinuteKlines, setFiveMinuteKlines] = useState<KlinePoint[]>([])
  const [orderBook, setOrderBook] = useState<OrderBookState>(emptyOrderBook)
  const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([])
  const [fundingRate, setFundingRate] = useState(0)
  const [openInterest, setOpenInterest] = useState(0)
  const [openInterestHistory, setOpenInterestHistory] = useState<OpenInterestPoint[]>([])
  const [historySignals, setHistorySignals] = useState<HistorySignal[]>([])
  const lastSignalKeyRef = useRef("")

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempts = 0
    let ws: WebSocket | undefined

    const connect = () => {
      setConnectionStatus(reconnectAttempts === 0 ? "connecting" : "reconnecting")
      ws = new WebSocket(STREAM_URL)

      ws.onopen = () => {
        reconnectAttempts = 0
        setConnectionStatus("live")
      }

      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as BinanceStreamMessage

        if (message.stream === "btcusdt@ticker") {
          const ticker = message.data as TickerPayload
          setPrice(Number(ticker.c))
          setPriceChange24h(Number(ticker.P))
          return
        }

        if (message.stream === "btcusdt@kline_1m") {
          const kline = normalizeKline(message.data as KlinePayload)
          setOneMinuteKlines((previous) => upsertKline(previous, kline))
          return
        }

        if (message.stream === "btcusdt@kline_5m") {
          const kline = normalizeKline(message.data as KlinePayload)
          setFiveMinuteKlines((previous) => upsertKline(previous, kline))
          return
        }

        if (message.stream === "btcusdt@depth20@100ms") {
          setOrderBook(calculateOrderBook(message.data as DepthPayload))
          return
        }

        if (message.stream === "btcusdt@forceOrder") {
          const liquidation = message.data as ForceOrderPayload
          const eventTime = liquidation.o.T
          const averagePrice = Number(liquidation.o.ap)
          const quantity = Number(liquidation.o.q)
          const side: LiquidationEvent["side"] = liquidation.o.S === "SELL" ? "long" : "short"

          setLiquidations((previous) =>
            [
              ...previous.filter((item) => eventTime - item.time <= FIVE_MINUTES),
              {
                id: `${eventTime}-${liquidation.o.S}-${quantity}`,
                time: eventTime,
                side,
                usd: averagePrice * quantity,
              },
            ].slice(-80),
          )
          return
        }

        if (message.stream === "btcusdt@markPrice@1s") {
          const markPrice = message.data as MarkPricePayload
          setFundingRate(Number(markPrice.r) * 100)
        }
      }

      ws.onerror = () => {
        setConnectionStatus("offline")
      }

      ws.onclose = () => {
        setConnectionStatus("offline")
        reconnectAttempts += 1
        reconnectTimer = setTimeout(connect, Math.min(15_000, 2_000 * reconnectAttempts))
      }
    }

    connect()

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const fetchOpenInterest = async () => {
      try {
        const response = await fetch("https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT")
        const payload = (await response.json()) as { openInterest?: string; time?: number }
        const value = Number(payload.openInterest ?? 0)
        const time = payload.time ?? Date.now()

        if (!isActive || !Number.isFinite(value)) return

        setOpenInterest(value)
        setOpenInterestHistory((previous) =>
          [...previous.filter((point) => time - point.time <= 15 * 60 * 1000), { time, value }].slice(-40),
        )
      } catch {
        if (isActive) {
          setOpenInterestHistory((previous) => previous)
        }
      }
    }

    fetchOpenInterest()
    const interval = setInterval(fetchOpenInterest, OPEN_INTEREST_POLL_MS)

    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [])

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

  const volumeChartData = oneMinuteKlines.slice(-40).map((kline) => ({
    time: kline.label,
    volume: kline.volume,
  }))

  const oiChartData = openInterestHistory.map((point) => ({
    time: new Date(point.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    value: point.value,
  }))

  const orderBookRows = [
    ...orderBook.asks
      .slice(0, 6)
      .reverse()
      .map((level) => ({ ...level, side: "ask" as const })),
    ...orderBook.bids.slice(0, 6).map((level) => ({ ...level, side: "bid" as const })),
  ]
  const maxDepth = Math.max(...orderBookRows.map((row) => row.notional), 1)

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant={connectionStatus === "live" ? "default" : "secondary"}>
                    {connectionStatus === "live" ? "Live" : connectionStatus}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Binance Futures BTCUSDT</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">BTC 极端波动可视化系统</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  实时监控暴涨、暴跌、上下影线、爆仓、OI 清洗和订单簿失衡，并输出可观察机会与风险提示。
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">BTC Price</p>
                <p className="text-3xl font-semibold tabular-nums">{price ? formatUsd(price, 2) : "..."}</p>
                <p className={priceChange24h >= 0 ? "text-sm text-green-600" : "text-sm text-red-600"}>
                  24h {formatPercent(priceChange24h)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="5m 涨跌 Z-Score"
                value={fiveMinuteReturnZScore.toFixed(2)}
                helper={`最新 5m ${formatPercent(latest5m?.changePercent ?? 0)}`}
                tone={fiveMinuteReturnZScore > 2.5 ? "green" : fiveMinuteReturnZScore < -2.5 ? "red" : "default"}
              />
              <MetricCard
                label="插针比例"
                value={`↑${(((latest5m?.upperWickRatio ?? 0) * 100)).toFixed(0)}% / ↓${(((latest5m?.lowerWickRatio ?? 0) * 100)).toFixed(0)}%`}
                helper="基于当前 5m K 线高低点和实体"
                tone={(latest5m?.upperWickRatio ?? 0) > 0.55 || (latest5m?.lowerWickRatio ?? 0) > 0.55 ? "amber" : "default"}
              />
              <MetricCard
                label="Volume Z-Score"
                value={volumeZScore.toFixed(2)}
                helper={`1m 成交量 ${((latest1m?.volume ?? 0) / 1000).toFixed(2)}K BTC`}
                tone={volumeZScore > 2.5 ? "amber" : "default"}
              />
              <MetricCard
                label="OI / Funding"
                value={`${formatPercent(oiChangeRate)} / ${fundingRate.toFixed(4)}%`}
                helper={`Open Interest ${openInterest.toLocaleString("en-US", { maximumFractionDigits: 0 })} BTC`}
                tone={oiChangeRate < -2 ? "green" : oiChangeRate > 0.2 ? "red" : "default"}
              />
            </div>
          </div>

          <div className="border-t bg-muted/30 p-6 lg:border-l lg:border-t-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Signal</p>
                <h3 className="text-2xl font-semibold">{currentSignal.headline}</h3>
              </div>
              <SignalBadge direction={currentSignal.direction} />
            </div>
            <div className="space-y-3">
              <ScoreBar label="Buy Score" value={currentSignal.buyScore} />
              <ScoreBar label="Sell Score" value={currentSignal.sellScore} />
              <ScoreBar label={`Risk Score (${currentSignal.riskLevel})`} value={currentSignal.riskScore} />
            </div>
            <div className="mt-5 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <p className="mb-2 font-medium">触发原因</p>
                <ul className="space-y-1 text-muted-foreground">
                  {currentSignal.triggerReasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 font-medium">失效条件</p>
                <ul className="space-y-1 text-muted-foreground">
                  {currentSignal.invalidationRules.map((rule) => (
                    <li key={rule}>- {rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>实时 K 线与成交量</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <MiniKlineChart title="1m K 线" data={oneMinuteKlines} />
                <MiniKlineChart title="5m K 线" data={fiveMinuteKlines} />
              </div>
              <div className="rounded-xl border bg-background/80 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">成交量图</h3>
                  <span className="text-xs text-muted-foreground">Volume Z {volumeZScore.toFixed(2)}</span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeChartData}>
                      <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} fontSize={12} />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))" }}
                        formatter={(value: number) => [`${Number(value).toFixed(2)} BTC`, "Volume"]}
                      />
                      <Bar dataKey="volume" fill="rgb(59 130 246)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  <CardTitle>爆仓与杠杆清洗</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="多头爆仓" value={formatCompactUsd(longLiquidations)} helper="过去 5 分钟" tone="red" />
                  <MetricCard label="空头爆仓" value={formatCompactUsd(shortLiquidations)} helper="过去 5 分钟" tone="green" />
                  <MetricCard
                    label="总爆仓"
                    value={formatCompactUsd(longLiquidations + shortLiquidations)}
                    helper={`${recentLiquidations.length} events`}
                    tone="amber"
                  />
                </div>
                <div className="rounded-xl border bg-background/80 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-medium">Open Interest</h3>
                    <span className="text-xs text-muted-foreground">5m {formatPercent(oiChangeRate)}</span>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={oiChartData}>
                        <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} fontSize={12} />
                        <YAxis hide domain={["dataMin", "dataMax"]} />
                        <Tooltip formatter={(value: number) => [Number(value).toFixed(0), "OI BTC"]} />
                        <Area dataKey="value" stroke="rgb(99 102 241)" fill="rgb(99 102 241 / 0.18)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Waves className="h-5 w-5" />
                  <CardTitle>订单簿状态</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="买盘深度" value={formatCompactUsd(orderBook.bidDepth)} helper="Top 20 bids" tone="green" />
                  <MetricCard label="卖盘深度" value={formatCompactUsd(orderBook.askDepth)} helper="Top 20 asks" tone="red" />
                  <MetricCard
                    label="Bid / Ask Ratio"
                    value={orderBook.bidAskRatio.toFixed(2)}
                    helper={`失衡 ${orderBook.imbalance.toFixed(1)}%`}
                    tone={orderBook.bidAskRatio > 1.2 ? "green" : orderBook.bidAskRatio < 0.8 ? "red" : "default"}
                  />
                </div>
                <div className="space-y-1 rounded-xl border bg-background/80 p-3 font-mono text-xs">
                  {orderBookRows.length === 0 ? (
                    <div className="py-10 text-center font-sans text-sm text-muted-foreground">等待订单簿数据...</div>
                  ) : (
                    orderBookRows.map((row) => (
                      <div key={`${row.side}-${row.price}`} className="relative grid grid-cols-3 gap-2 overflow-hidden rounded px-2 py-1">
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                <CardTitle>安全阈值</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b pb-2">
                <span className="text-muted-foreground">5m z-score</span>
                <span>±{THRESHOLDS.priceZ}</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-2">
                <span className="text-muted-foreground">上/下影线比例</span>
                <span>&gt; 55%</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-2">
                <span className="text-muted-foreground">成交量 z-score</span>
                <span>&gt; {THRESHOLDS.volumeZ}</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-2">
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
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>历史信号列表</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {historySignals.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  暂无 Buy Watch、Sell Watch 或 High Risk 信号。
                </div>
              ) : (
                <div className="space-y-3">
                  {historySignals.map((signal) => (
                    <div key={signal.id} className="rounded-xl border p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <SignalBadge direction={signal.direction} />
                          <p className="mt-2 font-medium">{signal.headline}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{new Date(signal.time).toLocaleTimeString("zh-CN")}</p>
                          <p>{formatUsd(signal.price, 2)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-muted p-2">
                          <p className="text-muted-foreground">Buy</p>
                          <p className="font-semibold">{signal.buyScore}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                          <p className="text-muted-foreground">Sell</p>
                          <p className="font-semibold">{signal.sellScore}</p>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
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
            <CardContent className="pt-6 text-sm">
              <p className="font-medium">风险提示</p>
              <p className="mt-2 text-amber-900/80 dark:text-amber-100/80">
                本系统仅用于监控与观察，不构成交易建议。极端行情中 WebSocket、订单簿和爆仓推送可能延迟或缺失。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
