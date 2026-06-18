"use client"

import { useEffect, useState } from "react"
import { X, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"

interface PanicWindowBannerProps {
  className?: string
}

interface CryptoBuyWindow {
  windowBand: "extreme" | "active" | "watch" | "none"
  compositeScore: number
  signals?: {
    mayerMultiple?: { zone: string }
    puellMultiple?: { zone: string }
    fearGreed?: { zone: string }
  }
}

interface StockPanicSignal {
  windowBand: "active" | "watch" | "none"
  compositeScore: number
}

type BannerTier = "extreme" | "active" | null
const REFRESH_MS = 5 * 60 * 1000

function isBuyZone(zone: string): boolean {
  return zone === "extreme_buy" || zone === "buy"
}

export function PanicWindowBanner({ className }: PanicWindowBannerProps) {
  const { locale } = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const crypto = usePersistentSWR<CryptoBuyWindow>(
    "panic-banner:crypto-buy-window",
    "/api/crypto/buy-window",
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const stock = usePersistentSWR<StockPanicSignal>(
    "panic-banner:stock-panic-signal",
    "/api/stock/panic-signal",
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const cryptoData = crypto.data ?? null
  const stockData = stock.data ?? null

  // Re-show banner if new signals come in after dismissal
  useEffect(() => {
    setDismissed(false)
  }, [cryptoData?.windowBand, stockData?.windowBand])

  const cryptoActive =
    cryptoData?.windowBand === "extreme" || cryptoData?.windowBand === "active"
  const stockActive = stockData?.windowBand === "active"

  const tier: BannerTier =
    cryptoData?.windowBand === "extreme" && stockActive
      ? "extreme"
      : cryptoActive || stockActive
        ? "active"
        : null

  if (!tier || dismissed) return null

  // Build signal summary
  const signals: string[] = []
  if (cryptoData?.signals) {
    const s = cryptoData.signals
    if (s.mayerMultiple && isBuyZone(s.mayerMultiple.zone)) signals.push(locale === "zh" ? "Mayer倍数" : "Mayer Multiple")
    if (s.puellMultiple && isBuyZone(s.puellMultiple.zone)) signals.push(locale === "zh" ? "Puell倍数" : "Puell Multiple")
    if (s.fearGreed && isBuyZone(s.fearGreed.zone)) signals.push(locale === "zh" ? "加密恐慌" : "Crypto F&G")
  }
  if (stockActive) signals.push(locale === "zh" ? "VIX/信用利差" : "VIX/Credit")

  const isExtreme = tier === "extreme"

  const title = isExtreme
    ? locale === "zh" ? "跨市场极端低估条件" : "Cross-Market Deep-Value Conditions"
    : locale === "zh" ? "历史性偏低估条件" : "Historically Attractive Conditions"

  const subtitle = isExtreme
    ? locale === "zh"
      ? `${signals.length}个跨市场指标同时处于历史极值（${signals.join("、")}）。过往此类条件对应较好的6–12个月远期收益，但这是概率视角而非择时信号——指标可能持续数月而价格继续下跌。`
      : `${signals.length} cross-market gauges at historic extremes (${signals.join(", ")}). Such conditions historically map to above-average 6–12 month forward returns — a probabilistic view, not a timing signal: gauges can stay extreme for months while prices fall further.`
    : locale === "zh"
      ? `偏高的指标：${signals.join("、")}。属于偏低估的条件区间。研究显示对多数人而言分批/定投长期优于抄底择时——倾向加快定投而非一次性抄底。`
      : `Elevated gauges: ${signals.join(", ")}. These are historically attractive conditions. Research shows staged/DCA buying beats dip-timing for most — lean in via scheduled buying rather than calling the bottom.`

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
        isExtreme
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-teal-500/40 bg-teal-500/8 text-teal-800 dark:text-teal-200",
        className,
      )}
    >
      <Zap className={cn("mt-0.5 h-4 w-4 shrink-0", isExtreme ? "animate-pulse" : "")} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[12px] leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed opacity-85">{subtitle}</p>
        <p className="mt-1 text-[10px] opacity-60">
          {locale === "zh" ? "不构成投资建议 · 数据约5分钟刷新" : "Not investment advice · refreshes ~5 min"}
        </p>
      </div>
      <button
        type="button"
        aria-label={locale === "zh" ? "关闭" : "Dismiss"}
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-sm p-0.5 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
