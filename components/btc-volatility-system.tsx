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
import { type ApiKeyStatus } from "@/components/api-key-warning"
import { type DataSourceId, getDataSourceEndpoint } from "@/components/data-source-selector"
import { InfoTooltip } from "@/components/info-tooltip"
import { SeriesChart } from "@/components/series-chart"
import { useT } from "@/lib/i18n"
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

interface TopTraderRatioPoint {
  time: number
  longShortAccountRatio: number
  longShortPositionRatio: number
}

interface TakerVolumePoint {
  time: number
  sellVolume: number
  buyVolume: number
  netVolume: number
  cvd: number
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
  spotPrice: number
  perpPremium: number
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
  topTraderPositionHistory: TopTraderRatioPoint[]
  takerVolumeHistory: TakerVolumePoint[]
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

/* Deterministic formatters — purposely avoid Intl compact notation because
   Node's ICU and browser Intl disagree about whether `$0` renders with or
   without trailing zeros, which trips React hydration. */
const formatUsd = (value: number, maximumFractionDigits = 0) => {
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  const fixed = abs.toFixed(maximumFractionDigits)
  const [whole, frac] = fixed.split(".")
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${sign}$${frac ? `${withCommas}.${frac}` : withCommas}`
}

const formatCompactUsd = (value: number) => {
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

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

type TFn = (key: string, vars?: Record<string, string | number>) => string

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
  t,
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
  t: TFn
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
      headline: highRiskBuyTrap
        ? t("vol.sig.highRisk.headline.down")
        : t("vol.sig.highRisk.headline.up"),
      buyScore,
      sellScore,
      riskScore,
      riskLevel: "High",
      triggerReasons: [
        highRiskBuyTrap
          ? t("vol.sig.highRisk.trigger.newLow")
          : t("vol.sig.highRisk.trigger.newHigh"),
        t("vol.sig.highRisk.trigger.oiRate", { pct: formatPercent(oiChangeRate) }),
        highRiskBuyTrap
          ? t("vol.sig.highRisk.trigger.downSync")
          : t("vol.sig.highRisk.trigger.upSync"),
      ],
      invalidationRules: [
        t("vol.sig.highRisk.invalid.oiTurn"),
        t("vol.sig.highRisk.invalid.priceReclaim"),
        t("vol.sig.highRisk.invalid.bookEq"),
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
      headline: t("vol.sig.buy.headline", { base }),
      buyScore,
      sellScore,
      riskScore,
      riskLevel,
      triggerReasons: [
        t("vol.sig.buy.trigger.priceZ", { z: fiveMinuteReturnZScore.toFixed(2), th: THRESHOLDS.priceZ }),
        t("vol.sig.buy.trigger.lowerWick", { pct: ((latest5m?.lowerWickRatio ?? 0) * 100).toFixed(0) }),
        t("vol.sig.buy.trigger.volZ", { z: volumeZScore.toFixed(2), th: THRESHOLDS.volumeZ }),
        longLiquidations > 0
          ? t("vol.sig.buy.trigger.longLiq", { usd: formatCompactUsd(longLiquidations) })
          : t("vol.sig.buy.trigger.noLiq"),
        t("vol.sig.buy.trigger.oiFlush", { pct: formatPercent(oiChangeRate) }),
        t("vol.sig.buy.trigger.bidRecovery", { r: orderBook.bidAskRatio.toFixed(2) }),
      ],
      invalidationRules: [
        t("vol.sig.buy.invalid.newLow"),
        t("vol.sig.buy.invalid.oiUp"),
        t("vol.sig.buy.invalid.bidFail"),
      ],
    }
  }

  if (hasCoreSellSetup) {
    return {
      direction: "Sell Watch",
      headline: t("vol.sig.sell.headline", { base }),
      buyScore,
      sellScore,
      riskScore,
      riskLevel,
      triggerReasons: [
        t("vol.sig.sell.trigger.priceZ", { z: fiveMinuteReturnZScore.toFixed(2), th: THRESHOLDS.priceZ }),
        t("vol.sig.sell.trigger.upperWick", { pct: ((latest5m?.upperWickRatio ?? 0) * 100).toFixed(0) }),
        t("vol.sig.sell.trigger.volZ", { z: volumeZScore.toFixed(2), th: THRESHOLDS.volumeZ }),
        shortLiquidations > 0
          ? t("vol.sig.sell.trigger.shortLiq", { usd: formatCompactUsd(shortLiquidations) })
          : t("vol.sig.buy.trigger.noLiq"),
        t("vol.sig.buy.trigger.oiFlush", { pct: formatPercent(oiChangeRate) }),
        t("vol.sig.sell.trigger.askRecovery", { r: orderBook.bidAskRatio.toFixed(2) }),
      ],
      invalidationRules: [
        t("vol.sig.sell.invalid.newHigh"),
        t("vol.sig.sell.invalid.oiUp"),
        t("vol.sig.sell.invalid.askFail"),
      ],
    }
  }

  return {
    direction: "Neutral",
    headline: t("vol.sig.neutral.headline"),
    buyScore,
    sellScore,
    riskScore,
    riskLevel,
    triggerReasons: [
      t("vol.sig.neutral.trigger.zscores", { pz: fiveMinuteReturnZScore.toFixed(2), vz: volumeZScore.toFixed(2) }),
      t("vol.sig.neutral.trigger.wicks", {
        up: ((latest5m?.upperWickRatio ?? 0) * 100).toFixed(0),
        dn: ((latest5m?.lowerWickRatio ?? 0) * 100).toFixed(0),
      }),
      t("vol.sig.neutral.trigger.bookOi", { r: orderBook.bidAskRatio.toFixed(2), pct: formatPercent(oiChangeRate) }),
    ],
    invalidationRules: [
      t("vol.sig.neutral.invalid.fullCombo"),
      t("vol.sig.neutral.invalid.highRiskSwitch"),
    ],
  }
}

function MiniKlineChart({ title, data, info }: { title: string; data: KlinePoint[]; info?: string }) {
  const t = useT()
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
        <span className="text-[10px] text-muted-foreground">{t("vol.candles", { n: chartData.length })}</span>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">{t("vol.waitKline")}</div>
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
  dataSource?: DataSourceId
  onApiKeyStatusChange?: (status: ApiKeyStatus | null) => void
}

export function BtcVolatilitySystem({
  instId = "BTC-USDT-SWAP",
  range = "1mo",
  dataSource: sourceId = "okx",
  onApiKeyStatusChange,
}: BtcVolatilitySystemProps) {
  const t = useT()
  const base = instId.split("-")[0] ?? "BTC"
  const rangeOption = getTimeRange(range)

  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">(
    "connecting",
  )
  const [dataSourceLabel, setDataSourceLabel] = useState("OKX Public API")
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
  const [topTraderPositionHistory, setTopTraderPositionHistory] = useState<TopTraderRatioPoint[]>([])
  const [takerVolumeHistory, setTakerVolumeHistory] = useState<TakerVolumePoint[]>([])
  const [spotPrice, setSpotPrice] = useState(0)
  const [perpPremium, setPerpPremium] = useState(0)
  const [historySignals, setHistorySignals] = useState<HistorySignal[]>([])
  const lastSignalKeyRef = useRef("")

  useEffect(() => {
    let isActive = true
    lastSignalKeyRef.current = ""
    setHistorySignals([])

    const apiEndpoint = getDataSourceEndpoint(sourceId)

    async function loadDerivativesData() {
      try {
        setConnectionStatus((status) => (status === "live" ? "live" : "connecting"))
        const response = await fetch(
          `${apiEndpoint}?instId=${encodeURIComponent(instId)}&range=${range}`,
          { cache: "no-store" },
        )
        const payload = (await response.json()) as DerivativesResponse & {
          error?: string
          apiKeyStatus?: ApiKeyStatus
        }

        if (!isActive) return

        // Handle API key status
        if (payload.apiKeyStatus) {
          onApiKeyStatusChange?.(payload.apiKeyStatus)
        } else {
          onApiKeyStatusChange?.(null)
        }

        if (!response.ok && !payload.ticker) {
          throw new Error(payload.error ?? "Failed to load derivatives data")
        }

        setDataSourceLabel(payload.source)
        setPrice(payload.ticker?.price ?? 0)
        setPriceChange24h(payload.ticker?.changePercent24h ?? 0)
        setOneMinuteKlines((payload.oneMinuteKlines ?? []).slice(-MAX_KLINES))
        setFiveMinuteKlines((payload.fiveMinuteKlines ?? []).slice(-MAX_KLINES))
        setRangeKlines(payload.rangeKlines ?? [])
        setOrderBook(payload.orderBook ?? emptyOrderBook)
        setOpenInterest(payload.openInterest?.btc ?? 0)
        setOpenInterestUsd(payload.openInterest?.usd ?? 0)
        setOpenInterestHistory(
          (payload.openInterestHistory ?? []).map((point) => ({ time: point.time, value: point.valueUsd })),
        )
        setFundingRate(payload.fundingRate?.rate ?? 0)
        setFundingRateHistory(payload.fundingRateHistory ?? [])
        setLongShortAccountRatioHistory(payload.longShortAccountRatioHistory ?? [])
        setContractLongShortRatioHistory(payload.contractLongShortRatioHistory ?? [])
        setTopTraderPositionHistory(payload.topTraderPositionHistory ?? [])
        setTakerVolumeHistory(payload.takerVolumeHistory ?? [])
        setSpotPrice(payload.spotPrice ?? 0)
        setPerpPremium(payload.perpPremium ?? 0)
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
  }, [instId, range, sourceId, onApiKeyStatusChange])

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
        t,
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
      t,
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

  /**
   * Rolling z-score history across the selected range. Uses a 30-bar window
   * over kline percent change; same definition as the 5m Z-Score tile, just
   * applied along the wider time axis so a 1Y view shows historic extremes.
   */
  const zScoreHistoryData = useMemo(() => {
    if (rangeKlines.length < 12) return []
    const window = 30
    const out: { timestamp: number; value: number }[] = []
    for (let i = window; i < rangeKlines.length; i++) {
      const slice = rangeKlines.slice(i - window, i).map((k) => k.changePercent)
      const z = calculateZScore(slice, rangeKlines[i].changePercent)
      out.push({ timestamp: rangeKlines[i].time, value: z })
    }
    return out
  }, [rangeKlines])

  /**
   * Volume z-score history — same rolling window, applied to per-bar volume.
   * High readings flag periods of unusual capital rotation.
   */
  const volumeZScoreHistoryData = useMemo(() => {
    if (rangeKlines.length < 12) return []
    const window = 30
    const out: { timestamp: number; value: number }[] = []
    for (let i = window; i < rangeKlines.length; i++) {
      const slice = rangeKlines.slice(i - window, i).map((k) => k.volume)
      const z = calculateZScore(slice, rangeKlines[i].volume)
      out.push({ timestamp: rangeKlines[i].time, value: z })
    }
    return out
  }, [rangeKlines])
  /* Historical curves use the full range pulled from the API (which now scales with the global TimeRange). */
  const oiChartData = openInterestHistory.map((point) => ({ timestamp: point.time, value: point.value }))
  const fundingChartData = fundingRateHistory.map((point) => ({ timestamp: point.time, value: point.rate }))
  const accountRatioChartData = longShortAccountRatioHistory.map((point) => ({ timestamp: point.time, value: point.ratio }))
  const contractRatioChartData = contractLongShortRatioHistory.map((point) => ({ timestamp: point.time, value: point.ratio }))
  const latestAccountRatio = longShortAccountRatioHistory.at(-1)?.ratio ?? 0
  const latestContractRatio = contractLongShortRatioHistory.at(-1)?.ratio ?? 0
  const topTraderAccountRatioChartData = topTraderPositionHistory.map((point) => ({ timestamp: point.time, value: point.longShortAccountRatio }))
  const topTraderPositionRatioChartData = topTraderPositionHistory.map((point) => ({ timestamp: point.time, value: point.longShortPositionRatio }))
  const latestTopTraderAccountRatio = topTraderPositionHistory.at(-1)?.longShortAccountRatio ?? 0
  const latestTopTraderPositionRatio = topTraderPositionHistory.at(-1)?.longShortPositionRatio ?? 0
  const cvdChartData = takerVolumeHistory.map((point) => ({ timestamp: point.time, value: point.cvd }))
  const latestCvd = takerVolumeHistory.at(-1)?.cvd ?? 0

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
                    {dataSourceLabel} · {instId} · {rangeOption.label} ({rangeOption.yahooInterval || rangeOption.okxBar})
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">{t("vol.title", { base })}</h2>
                <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{t("vol.subtitle")}</p>
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
                label={t("vol.metric.5mZ.label")}
                value={fiveMinuteReturnZScore.toFixed(2)}
                helper={t("vol.metric.5mZ.helper", { pct: formatPercent(latest5m?.changePercent ?? 0) })}
                tone={fiveMinuteReturnZScore > 2.5 ? "green" : fiveMinuteReturnZScore < -2.5 ? "red" : "default"}
                info={{
                  title: t("vol.metric.5mZ.title"),
                  description: t("vol.metric.5mZ.info"),
                }}
              />
              <MetricCard
                label={t("vol.metric.wick.label")}
                value={`↑${(((latest5m?.upperWickRatio ?? 0) * 100)).toFixed(0)}% / ↓${(((latest5m?.lowerWickRatio ?? 0) * 100)).toFixed(0)}%`}
                helper={t("vol.metric.wick.helper")}
                tone={(latest5m?.upperWickRatio ?? 0) > 0.55 || (latest5m?.lowerWickRatio ?? 0) > 0.55 ? "amber" : "default"}
                info={{
                  description: t("vol.metric.wick.info"),
                }}
              />
              <MetricCard
                label={t("vol.metric.volZ.label")}
                value={volumeZScore.toFixed(2)}
                helper={t("vol.metric.volZ.helper", {
                  vol: ((latest1m?.volume ?? 0) / 1000).toFixed(2),
                  base,
                })}
                tone={volumeZScore > 2.5 ? "amber" : "default"}
                info={{
                  description: t("vol.metric.volZ.info"),
                }}
              />
              <MetricCard
                label={t("vol.metric.oi.label")}
                value={`${formatPercent(oiChangeRate)} / ${fundingRate.toFixed(4)}%`}
                helper={`OI ${formatCompactUsd(openInterestUsd)} / ${openInterest.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${base}`}
                tone={oiChangeRate < -2 ? "green" : oiChangeRate > 0.2 ? "red" : "default"}
                info={{
                  description: t("vol.metric.oi.info"),
                }}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={t("vol.metric.basis.label")}
                value={`${perpPremium >= 0 ? "+" : ""}${perpPremium.toFixed(4)}%`}
                helper={t("vol.metric.basis.helper", { spot: spotPrice > 0 ? formatUsd(spotPrice, 2) : "..." })}
                tone={perpPremium > 0.05 ? "green" : perpPremium < -0.05 ? "red" : "default"}
                info={{
                  title: "Perp Premium / Basis",
                  description: t("vol.metric.basis.info"),
                }}
              />
              <MetricCard
                label={t("vol.metric.topAcct.label")}
                value={latestTopTraderAccountRatio ? latestTopTraderAccountRatio.toFixed(2) : "..."}
                helper="Top Trader Account L/S"
                tone={latestTopTraderAccountRatio > 1.5 ? "green" : latestTopTraderAccountRatio < 0.7 ? "red" : "default"}
                info={{
                  description: t("vol.metric.topAcct.info"),
                }}
              />
              <MetricCard
                label={t("vol.metric.topPos.label")}
                value={latestTopTraderPositionRatio ? latestTopTraderPositionRatio.toFixed(2) : "..."}
                helper="Top Trader Position L/S"
                tone={latestTopTraderPositionRatio > 1.5 ? "green" : latestTopTraderPositionRatio < 0.7 ? "red" : "default"}
                info={{
                  description: t("vol.metric.topPos.info"),
                }}
              />
              <MetricCard
                label={t("vol.metric.cvd.label")}
                value={latestCvd ? formatCompactUsd(latestCvd) : "..."}
                helper={t("vol.metric.cvd.helper")}
                tone={latestCvd > 0 ? "green" : latestCvd < 0 ? "red" : "default"}
                info={{
                  title: "Cumulative Volume Delta",
                  description: t("vol.metric.cvd.info"),
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
                <p className="mb-1 font-medium">{t("vol.triggerReasons")}</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {currentSignal.triggerReasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-medium">{t("vol.invalidationRules")}</p>
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
                {t("vol.priceTitle", { base, label: rangeOption.label, bar: rangeOption.okxBar })}
              </CardTitle>
              <InfoTooltip
                description={t("vol.priceInfo", { bar: rangeOption.okxBar })}
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

      {zScoreHistoryData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1">
              <CardTitle className="text-sm">{t("vol.zHistory.title")}</CardTitle>
              <InfoTooltip
                description={t("vol.zHistory.info", { window: 30, bar: rangeOption.okxBar })}
                source="OKX Public API"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">±2.5 = extreme</span>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("vol.zHistory.return")}
              </p>
              <SeriesChart
                data={zScoreHistoryData}
                unit="ratio"
                height={140}
                color="rgb(99 102 241)"
                label="Return Z"
                compact
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("vol.zHistory.volume")}
              </p>
              <SeriesChart
                data={volumeZScoreHistoryData}
                unit="ratio"
                height={140}
                color="rgb(245 158 11)"
                label="Volume Z"
                compact
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                <CardTitle className="text-sm">{t("vol.candlesAndVolume")}</CardTitle>
                <InfoTooltip description={t("vol.candlesAndVolumeInfo")} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 lg:grid-cols-2">
                <MiniKlineChart title={t("vol.kline.1m")} data={oneMinuteKlines} info={t("vol.kline.1m.info")} />
                <MiniKlineChart title={t("vol.kline.5m")} data={fiveMinuteKlines} info={t("vol.kline.5m.info")} />
              </div>
              <div className="rounded-lg border bg-background/80 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm font-medium">{t("vol.volumeChart")}</h3>
                    <InfoTooltip description={t("vol.volumeChart.info")} />
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
                  <CardTitle className="text-sm">{t("vol.section.oiFundingLs")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard
                    label={t("vol.metric.oiTitle.label")}
                    value={formatCompactUsd(openInterestUsd)}
                    helper={`OKX ${instId}`}
                    tone="default"
                    info={{ description: t("vol.metric.oiTitle.info") }}
                  />
                  <MetricCard
                    label={t("vol.metric.funding.label")}
                    value={`${fundingRate.toFixed(4)}%`}
                    helper={t("vol.metric.funding.helper")}
                    tone={fundingRate >= 0 ? "green" : "red"}
                    info={{
                      description: t("vol.metric.funding.info"),
                    }}
                  />
                  <MetricCard
                    label={t("vol.metric.lsAcct.label")}
                    value={latestAccountRatio ? latestAccountRatio.toFixed(2) : "..."}
                    helper={t("vol.metric.lsAcct.helper", { ratio: latestContractRatio ? latestContractRatio.toFixed(2) : "..." })}
                    tone="amber"
                    info={{
                      description: t("vol.metric.lsAcct.info"),
                    }}
                  />
                </div>
                <div className="rounded-lg border bg-background/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">{t("vol.oiHistory")}</h3>
                    <span className="text-[10px] text-muted-foreground">5m {formatPercent(oiChangeRate)}</span>
                  </div>
                  <SeriesChart data={oiChartData} unit="usd" height={120} color="rgb(99 102 241)" label="OI" compact />
                </div>
                <div className="rounded-lg border bg-background/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">{t("vol.fundingHistory")}</h3>
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
                    <h3 className="text-sm font-medium">{t("vol.lsHistory")}</h3>
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
                {topTraderAccountRatioChartData.length > 0 && (
                  <div className="rounded-lg border bg-background/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <h3 className="text-sm font-medium">{t("vol.topLsHistory")}</h3>
                        <InfoTooltip description={t("vol.topLsHistory.info")} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">top trader</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <SeriesChart
                        data={topTraderAccountRatioChartData}
                        unit="ratio"
                        height={110}
                        color="rgb(168 85 247)"
                        label="Top Account L/S"
                        compact
                      />
                      <SeriesChart
                        data={topTraderPositionRatioChartData}
                        unit="ratio"
                        height={110}
                        color="rgb(236 72 153)"
                        label="Top Position L/S"
                        compact
                      />
                    </div>
                  </div>
                )}
                {cvdChartData.length > 0 && (
                  <div className="rounded-lg border bg-background/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <h3 className="text-sm font-medium">{t("vol.cvdSection")}</h3>
                        <InfoTooltip description={t("vol.cvdSection.info")} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatCompactUsd(latestCvd)}</span>
                    </div>
                    <SeriesChart
                      data={cvdChartData}
                      unit="usd"
                      height={120}
                      color="rgb(34 197 94)"
                      label="CVD"
                      compact
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <div className="flex items-center gap-1">
                  <Waves className="h-4 w-4" />
                  <CardTitle className="text-sm">{t("vol.book.title")}</CardTitle>
                  <InfoTooltip description={t("vol.book.info")} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard label={t("vol.book.bid")} value={formatCompactUsd(orderBook.bidDepth)} helper="Top 20 bids" tone="green" />
                  <MetricCard label={t("vol.book.ask")} value={formatCompactUsd(orderBook.askDepth)} helper="Top 20 asks" tone="red" />
                  <MetricCard
                    label="Bid / Ask Ratio"
                    value={orderBook.bidAskRatio.toFixed(2)}
                    helper={t("vol.book.imbalance", { pct: orderBook.imbalance.toFixed(1) })}
                    tone={orderBook.bidAskRatio > 1.2 ? "green" : orderBook.bidAskRatio < 0.8 ? "red" : "default"}
                  />
                </div>
                <div className="space-y-0.5 rounded-lg border bg-background/80 p-2 font-mono text-[11px]">
                  {orderBookRows.length === 0 ? (
                    <div className="py-8 text-center font-sans text-xs text-muted-foreground">{t("vol.book.waiting")}</div>
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
                <CardTitle className="text-sm">{t("vol.thresholds")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">{t("vol.threshold.5mZ")}</span>
                <span>±{THRESHOLDS.priceZ}</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">{t("vol.threshold.wick")}</span>
                <span>&gt; 55%</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">{t("vol.threshold.volZ")}</span>
                <span>&gt; {THRESHOLDS.volumeZ}</span>
              </div>
              <div className="flex justify-between gap-4 border-b pb-1">
                <span className="text-muted-foreground">{t("vol.threshold.oi")}</span>
                <span>&lt; -2%</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("vol.threshold.book")}</span>
                <span>&gt; 1.2 / &lt; 0.8</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                <CardTitle className="text-sm">{t("vol.history.title")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {historySignals.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                  {t("vol.history.empty")}
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
                          <p>{new Date(signal.time).toLocaleTimeString()}</p>
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
              <p className="font-medium">{t("vol.risk.title")}</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">{t("vol.risk.body")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
