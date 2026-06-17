"use client"

import { useMemo } from "react"
import { Bitcoin, ShieldAlert } from "lucide-react"

import { InfoTooltip } from "@/components/info-tooltip"
import { usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { BuyWindowSignalZone } from "@/app/api/crypto/buy-window/route"

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
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-foreground">{name}</p>
        <p className="text-[10px] text-muted-foreground">{locale === "zh" ? "买入" : "buy"}: {thresholdHint}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[12px] font-mono tabular-nums text-foreground">
          {formatSignalValue(value, unit, name)}
        </span>
        <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", pill.className)}>
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
        label: locale === "zh" ? "极端买入窗口" : "Extreme Buy Window",
        sub: locale === "zh"
          ? "≥2个指标进入历史极值区。学术研究显示此类叠加信号后12个月+200%以上历史概率极高。"
          : "≥2 indicators at historic extremes. Academic studies show >200% forward returns in comparable setups.",
        className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      }
    }
    if (payload.windowBand === "active") {
      return {
        label: locale === "zh" ? "买入窗口开启" : "Buy Window Active",
        sub: locale === "zh"
          ? "多项链上与情绪指标同时进入买入区，历史上对应强力积累时机。"
          : "Multiple on-chain and sentiment indicators in buy zones — historically strong accumulation timing.",
        className: "border-teal-500/40 bg-teal-500/8 text-teal-700 dark:text-teal-300",
      }
    }
    return {
      label: locale === "zh" ? "信号观察中" : "Signals Building",
      sub: locale === "zh" ? "部分指标接近买入区，持续监控中。" : "Some indicators approaching buy zones.",
      className: "border-amber-500/40 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    }
  }, [payload?.windowBand, locale])

  const tooltipContent = locale === "zh"
    ? [
        "BTC 周期买入窗口监测",
        "",
        "① Mayer 倍数（40%权重）：BTC 现价 / 200日均线",
        "  < 0.8 = 历史主要积累区 | < 0.6 = 历史99%底部以上（极端买入）",
        "",
        "② Puell 倍数（35%权重）：日矿工收入 / 365日均值",
        "  < 0.5 = 矿工底部。2022年12月触发 → 随后12个月 +294%",
        "  经ScienceDirect 2025年学术研究交叉验证（三个BTC周期）",
        "",
        "③ 恐慌指数（25%权重）：alternative.me 恐贪指数",
        "  < 20 = 历史高胜率买入窗口 | < 10 = 极端恐慌",
        "",
        "窗口触发：≥2信号进入买入区。极端窗口：≥2信号进入极端买入区。",
        "来源：OKX · blockchain.info · alternative.me",
        "约5分钟刷新。不构成投资建议。",
      ].join("\n")
    : [
        "BTC Cycle Buy Window Monitor",
        "",
        "① Mayer Multiple (40% weight): BTC price / 200d SMA",
        "  <0.8 = major accumulation zone | <0.6 = extreme buy (top 99th pct historically)",
        "",
        "② Puell Multiple (35% weight): daily miner revenue / 365d avg",
        "  <0.5 = miner bottom. Dec 2022 signal → +294% in 12 months.",
        "  Cross-validated by ScienceDirect 2025 academic study (3 BTC cycles).",
        "",
        "③ Fear & Greed (25% weight): alternative.me index",
        "  <20 = historically high-win-rate buy windows | <10 = extreme panic",
        "",
        "Window: ≥2 signals in buy zone. Extreme: ≥2 in extreme buy.",
        "Sources: OKX · blockchain.info · alternative.me",
        "Refreshes ~5 min. Not investment advice.",
      ].join("\n")

  return (
    <div className={cn("rounded-lg border bg-card/95 px-3 py-2.5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Bitcoin className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold tracking-tight text-foreground">
            {locale === "zh" ? "BTC 周期买入窗口" : "BTC Cycle Buy Window"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {payload && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {locale === "zh" ? "综合分" : "Score"}: {payload.compositeScore}
            </span>
          )}
          <InfoTooltip description={tooltipContent} />
        </div>
      </div>

      {loading ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{locale === "zh" ? "加载中…" : "Loading…"}</p>
      ) : !payload?.signals ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{locale === "zh" ? "数据不可用" : "Data unavailable"}</p>
      ) : (
        <>
          {bandConfig && (
            <div className={cn("mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5", bandConfig.className)}>
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold">{bandConfig.label}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed opacity-80">{bandConfig.sub}</p>
              </div>
            </div>
          )}
          <div className="mt-1 divide-y divide-border/50">
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
