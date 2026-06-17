"use client"

import { useEffect, useState } from "react"
import { X, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
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

function isBuyZone(zone: string): boolean {
  return zone === "extreme_buy" || zone === "buy"
}

export function PanicWindowBanner({ className }: PanicWindowBannerProps) {
  const { locale } = useI18n()
  const [cryptoData, setCryptoData] = useState<CryptoBuyWindow | null>(null)
  const [stockData, setStockData] = useState<StockPanicSignal | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const [cr, sr] = await Promise.allSettled([
          fetch("/api/crypto/buy-window").then((r) => (r.ok ? (r.json() as Promise<CryptoBuyWindow>) : null)),
          fetch("/api/stock/panic-signal").then((r) => (r.ok ? (r.json() as Promise<StockPanicSignal>) : null)),
        ])
        if (cancelled) return
        if (cr.status === "fulfilled" && cr.value) setCryptoData(cr.value)
        if (sr.status === "fulfilled" && sr.value) setStockData(sr.value)
      } catch {
        // silent fallback
      }
    }

    void poll()
    const interval = setInterval(() => { void poll() }, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

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
    ? locale === "zh" ? "极端买入窗口已开启" : "Extreme Buy Window Active"
    : locale === "zh" ? "买入窗口已开启" : "Buy Window Active"

  const subtitle = isExtreme
    ? locale === "zh"
      ? `${signals.length}个跨市场指标同时触发极端信号。历史研究：此类叠加信号后12个月正收益概率极高。`
      : `${signals.length} cross-market indicators at extreme readings. Historical studies: very high probability of positive returns 12 months forward.`
    : locale === "zh"
      ? `触发指标：${signals.join("、")}。恐慌性抛售信号，建议分批布局。`
      : `Triggered: ${signals.join(", ")}. Panic-selling signal — consider staged accumulation.`

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
