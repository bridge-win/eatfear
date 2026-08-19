"use client"

import { useMemo } from "react"
import { Bitcoin, ShieldAlert } from "lucide-react"

import { InfoTooltip } from "@/components/info-tooltip"
import { usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { BuyWindowSignalZone } from "@/lib/api-routes/crypto/buy-window/route"

const REFRESH_MS = 5 * 60 * 1000

interface BuyWindowSignal {
  value: number | null
  zone: BuyWindowSignalZone
  thresholds: { extreme_buy: number; buy: number }
  unit: string
  descZh: string
  descEn: string
}

interface CryptoBuyWindowPayload {
  updatedAt: number
  compositeScore: number
  windowBand: "extreme" | "active" | "watch" | "none"
  signals: {
    mayerMultiple: BuyWindowSignal
    puellMultiple: BuyWindowSignal
    fearGreed: BuyWindowSignal
  }
  upstream: Record<string, string>
}

async function fetcher(url: string): Promise<CryptoBuyWindowPayload> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Crypto buy window unavailable")
  return res.json() as Promise<CryptoBuyWindowPayload>
}

function zonePill(zone: BuyWindowSignalZone, locale: string): { label: string; className: string } {
  switch (zone) {
    case "extreme_buy":
      return {
        label: locale === "zh" ? "极端买入" : "Extreme Buy",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      }
    case "buy":
      return {
        label: locale === "zh" ? "买入区" : "Buy Zone",
        className: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
      }
    case "watch":
      return {
        label: locale === "zh" ? "关注" : "Watch",
        className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
      }
    case "sell":
      return {
        label: locale === "zh" ? "高估" : "Overvalued",
        className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25",
      }
    default:
      return {
        label: locale === "zh" ? "正常" : "Neutral",
        className: "bg-muted/40 text-muted-foreground border-border/50",
      }
  }
}

function formatSignalValue(value: number | null, unit: string, name: string): string {
  if (value === null) return "—"
  if (unit === "index") return Math.round(value).toString()
  if (unit === "ratio") return value.toFixed(3)
  return value.toFixed(2)
}

function SignalRow({
  name,
  value,
  unit,
  zone,
  thresholds,
}: {
  name: string
  value: number | null
  unit: string
  zone: BuyWindowSignalZone
  thresholds: { extreme_buy: number; buy: number }
}) {
  const { locale } = useI18n()
  const pill = zonePill(zone, locale)
  const thresholdHint =
    unit === "index"
      ? `<${thresholds.buy}`
      : `<${thresholds.buy}`

  return (
    <div className="flex min-w-0 items-center justify-between gap-1.5 rounded border border-border/50 bg-muted/20 px-1.5 py-1">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium leading-none text-foreground">{name}</p>
        <p className="mt-0.5 truncate text-[9.5px] text-muted-foreground">{locale === "zh" ? "买入" : "buy"}: {thresholdHint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-[11px] font-mono tabular-nums text-foreground">
          {formatSignalValue(value, unit, name)}
        </span>
        <span className={cn("rounded border px-1 py-px text-[9.5px] font-semibold leading-none", pill.className)}>
          {pill.label}
        </span>
      </div>
    </div>
  )
}

export function CryptoBuyWindowCard({ className }: { className?: string }) {
  const { locale } = useI18n()

  const swr = usePersistentSWR<CryptoBuyWindowPayload>(
    "crypto:buy-window",
    "/api/crypto/buy-window",
    fetcher,
    { refreshInterval: REFRESH_MS },
  )

  const payload = swr.data ?? null
  const loading = swr.isLoading && !payload

  const bandConfig = useMemo(() => {
    if (!payload?.windowBand || payload.windowBand === "none") return null
    if (payload.windowBand === "extreme") {
      return {
        label: locale === "zh" ? "历史性极端低估区间" : "Historic Deep-Value Zone",
        sub: locale === "zh"
          ? "≥2个链上/情绪指标进入历史极值区。过往周期此类条件多对应深度价值——但样本仅3–4个周期，且指标可能持续数月而价格继续下跌。倾向分批建仓，而非一次抄底。"
          : "≥2 on-chain/sentiment gauges at historic extremes. Past cycles saw deep value here — but the sample is only 3–4 cycles, and gauges can persist for months while price falls further. Scale in; don't call the bottom.",
        className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      }
    }
    if (payload.windowBand === "active") {
      return {
        label: locale === "zh" ? "历史性偏低估区间" : "Historically Cheap Zone",
        sub: locale === "zh"
          ? "多项链上与情绪指标同时偏低。历史上对应较好的远期收益，但属于6–12个月的概率视角，并非择时信号。"
          : "On-chain and sentiment gauges low together. Historically maps to above-average forward returns — a 6–12 month probabilistic view, not a timing signal.",
        className: "border-teal-500/40 bg-teal-500/8 text-teal-700 dark:text-teal-300",
      }
    }
    return {
      label: locale === "zh" ? "信号观察中" : "Signals Building",
      sub: locale === "zh" ? "部分指标接近低估区，持续监控中。" : "Some gauges approaching cheap zones.",
      className: "border-amber-500/40 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    }
  }, [payload?.windowBand, locale])

  const tooltipContent = locale === "zh"
    ? [
        "BTC 周期低估条件监测（远期概率视角，非择时信号）",
        "",
        "① Mayer 倍数（40%权重）：BTC 现价 / 200日均线，长期均值约1.3–1.5",
        "  < 0.8 = 历史偏便宜（但非罕见，约1/3时间在0.95下方；2018/2022曾在此下方再跌30–50%）",
        "  < 0.6 = 罕见的深度低估（历史周期低点约0.41/0.48/0.51）。注：经典Mayer法则其实是 >2.4 为过热卖出。",
        "",
        "② Puell 倍数（35%权重）：日矿工收入 / 365日均值",
        "  < 0.5 = 矿工压力/积累区。2022年低点后12个月约+155%（+294%为抄到最低点并持有至2024峰值的事后数字）。",
        "  属于on-chain估值指标家族（MVRV/Puell等，ScienceDirect 2025研究），但Puell本身并非被单独证明最优。",
        "",
        "③ 恐慌指数（25%权重）：alternative.me 加密恐贪指数（2018年2月起）",
        "  < 20 = 远期收益偏高，但中途回撤大；指数2018熊市期间长期处于极度恐慌而价格继续大跌。",
        "",
        "重要：这些指标可能持续数月处于极值而价格继续下跌。研究显示定投/分批长期多优于抄底择时。请视为“偏低估的条件”而非买入触发。",
        "来源：OKX · blockchain.info · alternative.me · Glassnode · CoinDesk",
        "约5分钟刷新。不构成投资建议。",
      ].join("\n")
    : [
        "BTC Cycle Cheap-Conditions Monitor (forward-odds view, not a timing signal)",
        "",
        "① Mayer Multiple (40% weight): BTC price / 200d SMA; long-run avg ~1.3–1.5",
        "  <0.8 = historically cheap (not rare — ~1/3 of days sit below 0.95; fell another 30–50% below it in 2018/2022)",
        "  <0.6 = rare deep value (cycle lows ~0.41/0.48/0.51). Note: the canonical Mayer rule is actually >2.4 = overbought/sell.",
        "",
        "② Puell Multiple (35% weight): daily miner revenue / 365d avg",
        "  <0.5 = miner-stress/accumulation zone. ~+155% in 12m after the 2022 low (the +294% figure was buying the exact bottom and holding to the 2024 peak).",
        "  Part of the on-chain valuation family (MVRV/Puell, ScienceDirect 2025) — but Puell itself isn't proven the single best metric.",
        "",
        "③ Fear & Greed (25% weight): alternative.me crypto index (since Feb 2018)",
        "  <20 = above-average forward returns but large interim drawdowns; fear stayed extreme through the entire 2018 bear as price kept falling.",
        "",
        "Important: these gauges can stay extreme for months while price falls further. Research shows DCA/scaling beats dip-timing for most. Read as 'cheap conditions', not a buy trigger.",
        "Sources: OKX · blockchain.info · alternative.me · Glassnode · CoinDesk",
        "Refreshes ~5 min. Not investment advice.",
      ].join("\n")

  return (
    <div className={cn("rounded-md border bg-card/95 px-2 py-1.5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Bitcoin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="truncate text-xs font-semibold text-foreground">
            {locale === "zh" ? "BTC 周期低估监测" : "BTC Cycle Value Monitor"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {payload && (
            <span className="text-[10.5px] tabular-nums text-muted-foreground">
              {locale === "zh" ? "综合分" : "Score"}: {payload.compositeScore}
            </span>
          )}
          <InfoTooltip description={tooltipContent} />
        </div>
      </div>

      {loading ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{locale === "zh" ? "加载中…" : "Loading…"}</p>
      ) : !payload?.signals ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{locale === "zh" ? "数据不可用" : "Data unavailable"}</p>
      ) : (
        <>
          {bandConfig && (
            <div className={cn("mt-1 flex items-center gap-1.5 rounded border px-1.5 py-1", bandConfig.className)}>
              <ShieldAlert className="h-3 w-3 shrink-0" />
              <div>
                <p className="truncate text-[11px] font-semibold leading-tight">{bandConfig.label}</p>
              </div>
            </div>
          )}
          <div className="mt-1 grid gap-1">
            <SignalRow
              name={locale === "zh" ? "Mayer 倍数" : "Mayer Multiple"}
              value={payload.signals.mayerMultiple.value}
              unit={payload.signals.mayerMultiple.unit}
              zone={payload.signals.mayerMultiple.zone}
              thresholds={payload.signals.mayerMultiple.thresholds}
            />
            <SignalRow
              name={locale === "zh" ? "Puell 倍数" : "Puell Multiple"}
              value={payload.signals.puellMultiple.value}
              unit={payload.signals.puellMultiple.unit}
              zone={payload.signals.puellMultiple.zone}
              thresholds={payload.signals.puellMultiple.thresholds}
            />
            <SignalRow
              name={locale === "zh" ? "加密恐慌指数" : "Crypto Fear & Greed"}
              value={payload.signals.fearGreed.value}
              unit={payload.signals.fearGreed.unit}
              zone={payload.signals.fearGreed.zone}
              thresholds={payload.signals.fearGreed.thresholds}
            />
          </div>
        </>
      )}
    </div>
  )
}
