"use client"

import { useMemo } from "react"
import { Info } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { usePersistentSWR } from "@/lib/client-persistence"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { CycleBand, HashRibbonStatus, MayerZone, PuellZone } from "@/app/api/crypto/cycle-position/route"

const REFRESH_MS = 300 * 1000

interface CyclePayload {
  updatedAt: number
  cycleScore: number
  cycleBand: CycleBand
  cycleSignalZh: string
  cycleSignalEn: string
  mayerMultiple: {
    value: number | null
    sma200: number | null
    smaLen: number
    zone: MayerZone
    zoneZh: string
    zoneEn: string
    score: number
  }
  hashRibbon: {
    ma10Eh: number | null
    ma30Eh: number | null
    ma60Eh: number | null
    status: HashRibbonStatus
    statusZh: string
    statusEn: string
    score: number
  }
  puellMultiple: {
    value: number | null
    zone: PuellZone
    zoneZh: string
    zoneEn: string
    score: number
  }
  upstream: Record<string, string>
  error?: string
}

async function fetchCyclePayload(url: string): Promise<CyclePayload> {
  const res = await fetch(url)
  const json = (await res.json()) as CyclePayload
  if (!res.ok) throw new Error(json.error ?? "Cycle position unavailable")
  return json
}

function cycleBandColor(band: CycleBand): string {
  switch (band) {
    case "bottom":
      return "text-purple-600 dark:text-purple-400"
    case "deep_value":
      return "text-emerald-600 dark:text-emerald-400"
    case "accumulation":
      return "text-teal-600 dark:text-teal-400"
    case "fair_value":
      return "text-sky-600 dark:text-sky-400"
    case "elevated":
      return "text-amber-600 dark:text-amber-400"
    case "top":
      return "text-red-600 dark:text-red-400"
    default:
      return "text-muted-foreground"
  }
}

function zoneBadgeClass(score: number): string {
  if (score >= 80) return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
  if (score >= 65) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
  if (score >= 50) return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30"
  if (score >= 30) return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
  if (score >= 15) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
  return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
}

function MiniRow({
  label,
  value,
  badge,
  badgeClass,
}: {
  label: string
  value: string
  badge: string
  badgeClass: string
}) {
  return (
    <div className="flex items-center justify-between gap-1.5 py-0.5">
      <span className="min-w-0 truncate text-[10.5px] text-muted-foreground">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-[10.5px] tabular-nums text-foreground">{value}</span>
        <span className={cn("rounded border px-1 py-px text-[9.5px] font-medium leading-none", badgeClass)}>
          {badge}
        </span>
      </div>
    </div>
  )
}

function HoverContents({
  payload,
  loading,
  error,
  updatedHint,
}: {
  payload: CyclePayload | null
  loading: boolean
  error: string | null
  updatedHint: string
}) {
  const { locale } = useI18n()

  if (loading) return <p className="px-3 py-3 text-[11px] text-muted-foreground">Loading…</p>
  if (error) return <p className="px-3 py-3 text-[11px] text-destructive">{error}</p>
  if (!payload) return null

  const modelLines =
    locale === "zh"
      ? [
          "周期位置指数（0–100）综合 3 大链上周期指标，识别 BTC 历史价值区间：",
          "",
          "① Mayer 倍数 (40%)：现价 / 200 日均线。历史统计显示 < 0.8 时为强力积累区，< 0.6 为极端买入区（历史 < 1% 时间）。",
          "② 矿工哈希带 (45%)：30 日 vs 60 日算力均线。MA30 穿越 MA60 以下 = 矿工投降；MA10 随后穿越 MA30 = 底部复苏确认信号（查尔斯·爱德华兹模型）。",
          "③ Puell 倍数 (15%)：日矿工收入 / 365 日均值。< 0.5 = 矿工亏损性挖矿，历史强买信号。",
          "",
          "信号带：80+ 周期底部 · 65+ 深度价值 · 50+ 积累区 · 35+ 公平价值 · 20+ 偏高 · <20 顶部",
          "",
          "约 5 分钟刷新。不构成投资建议。",
        ].join("\n")
      : [
          "Cycle Position Index (0–100) — composite of 3 on-chain cycle indicators identifying BTC historical value zones:",
          "",
          "① Mayer Multiple (40%): Price / 200-day SMA. Historically < 0.8 = strong accumulation; < 0.6 = extreme buy zone (< 1% of historical time).",
          "② Hash Ribbon (45%): 30d vs 60d hashrate MA. MA30 crossing below MA60 = miner capitulation; MA10 re-crossing above MA30 = bottom recovery signal (Charles Edwards model).",
          "③ Puell Multiple (15%): Daily miner revenue / 365-day average. < 0.5 = miners mining at a loss — historically strong buy signal.",
          "",
          "Bands: 80+ bottom · 65+ deep value · 50+ accumulation · 35+ fair value · 20+ elevated · <20 top",
          "",
          "Refreshes ~5 min. Not investment advice.",
        ].join("\n")

  const m = payload.mayerMultiple
  const h = payload.hashRibbon
  const p = payload.puellMultiple

  return (
    <div className="space-y-3 px-3 py-2.5 text-left">
      <p className="text-[10px] text-muted-foreground">
        {updatedHint ? `${updatedHint} · ` : ""}
        {locale === "zh" ? "约 5 分钟刷新" : "Refreshes ~5 min"}
      </p>

      {/* Mayer Multiple detail */}
      <section>
        <p className="mb-1 text-xs font-semibold text-foreground">
          {locale === "zh" ? "① Mayer 倍数" : "① Mayer Multiple"}
        </p>
        <div className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5 text-[10.5px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">
              {m.value !== null ? `${m.value.toFixed(3)}×` : "—"}
              {m.sma200 !== null ? ` · SMA${m.smaLen} $${m.sma200.toLocaleString()}` : ""}
            </span>
            <span className={cn("rounded border px-1.5 py-0.5 text-[9.5px] font-medium", zoneBadgeClass(m.score))}>
              {locale === "zh" ? m.zoneZh : m.zoneEn}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground/70">
            {locale === "zh"
              ? "< 0.8 = 积累区 · < 0.6 = 极端历史买点 · > 2.4 = 历史顶部"
              : "< 0.8 = accumulation · < 0.6 = extreme historic buy · > 2.4 = historic top"}
          </p>
        </div>
      </section>

      {/* Hash Ribbon detail */}
      <section>
        <p className="mb-1 text-xs font-semibold text-foreground">
          {locale === "zh" ? "② 矿工哈希带 (Hash Ribbon)" : "② Hash Ribbon (Miner Capitulation)"}
        </p>
        <div className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5 text-[10.5px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="tabular-nums text-muted-foreground">
              {h.ma10Eh !== null ? `MA10 ${h.ma10Eh} · MA30 ${h.ma30Eh} · MA60 ${h.ma60Eh} EH/s` : "—"}
            </span>
            <span className={cn("rounded border px-1.5 py-0.5 text-[9.5px] font-medium", zoneBadgeClass(h.score))}>
              {locale === "zh" ? h.statusZh : h.statusEn}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground/70">
            {locale === "zh"
              ? "MA30 < MA60 = 矿工投降 · MA10 复穿 MA30 = 底部确认"
              : "MA30 < MA60 = capitulation · MA10 re-crosses MA30 = bottom confirmed"}
          </p>
        </div>
      </section>

      {/* Puell Multiple detail */}
      <section>
        <p className="mb-1 text-xs font-semibold text-foreground">
          {locale === "zh" ? "③ Puell 倍数" : "③ Puell Multiple"}
        </p>
        <div className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5 text-[10.5px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="tabular-nums text-muted-foreground">
              {p.value !== null ? `${p.value.toFixed(3)}` : "—"}
            </span>
            <span className={cn("rounded border px-1.5 py-0.5 text-[9.5px] font-medium", zoneBadgeClass(p.score))}>
              {locale === "zh" ? p.zoneZh : p.zoneEn}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground/70">
            {locale === "zh"
              ? "日矿工收入 / 365 日均值。< 0.5 = 亏损挖矿 = 历史底部区间"
              : "Daily miner revenue / 365d avg. < 0.5 = mining at a loss = historic bottom zone"}
          </p>
        </div>
      </section>

      {/* Model notes */}
      <section className="rounded-md border border-border/55 bg-muted/20 px-2 py-2">
        <p className="text-xs font-semibold text-foreground">
          {locale === "zh" ? "评分模型说明" : "Scoring model notes"}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{modelLines}</p>
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          {Object.values(payload.upstream).join(" · ")}
        </p>
      </section>
    </div>
  )
}

export function CyclePositionCard({ className }: { className?: string }) {
  const { locale } = useI18n()
  const swr = usePersistentSWR<CyclePayload>(
    "crypto:cycle-position",
    "/api/crypto/cycle-position",
    fetchCyclePayload,
    { refreshInterval: REFRESH_MS },
  )
  const payload = swr.data ?? null
  const loading = swr.isLoading
  const error = payload ? null : swr.error?.message ?? null

  const updatedHint = useMemo(() => {
    if (!payload?.updatedAt) return ""
    try {
      return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(payload.updatedAt)
    } catch {
      return ""
    }
  }, [payload?.updatedAt, locale])

  const toneClass = payload ? cycleBandColor(payload.cycleBand) : "text-muted-foreground"
  const signal = loading && !payload
    ? (locale === "zh" ? "载入中…" : "Loading…")
    : error
      ? error
      : payload
        ? locale === "zh"
          ? payload.cycleSignalZh
          : payload.cycleSignalEn
        : null

  const scoreDisplay = loading && !payload ? "…" : error ? "—" : payload ? payload.cycleScore : "—"

  return (
    <div
      className={cn(
        "min-w-0 shrink-0 rounded-md border bg-card/95 px-2.5 py-2 text-left shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {locale === "zh" ? "周期位置" : "Cycle Position"}
        </p>
        <HoverCard openDelay={120} closeDelay={180}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label={locale === "zh" ? "悬停查看周期位置指标详情" : "Hover for cycle position details"}
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground",
                "outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            align="end"
            side="bottom"
            collisionPadding={16}
            className="max-h-[min(640px,_82vh)] w-[min(28rem,_94vw)] overflow-y-auto p-0"
          >
            <HoverContents payload={payload} loading={loading && !payload} error={error} updatedHint={updatedHint} />
          </HoverCardContent>
        </HoverCard>
      </div>

      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums leading-none tracking-tight md:text-[1.7rem]",
          toneClass,
        )}
      >
        {scoreDisplay}
        <span className="ml-0.5 text-base font-normal text-muted-foreground md:text-lg"> / 100</span>
      </p>

      {signal && (
        <p className={cn("mt-1 text-[13px] font-medium leading-snug", toneClass)}>
          {signal}
        </p>
      )}

      {/* Mini metrics row */}
      {payload && !loading && !error && (
        <div className="mt-2 space-y-0 border-t border-border/40 pt-1.5">
          <MiniRow
            label={locale === "zh" ? "Mayer×" : "Mayer×"}
            value={payload.mayerMultiple.value !== null ? payload.mayerMultiple.value.toFixed(2) : "—"}
            badge={locale === "zh" ? payload.mayerMultiple.zoneZh : payload.mayerMultiple.zoneEn}
            badgeClass={zoneBadgeClass(payload.mayerMultiple.score)}
          />
          <MiniRow
            label={locale === "zh" ? "哈希带" : "Hash Ribbon"}
            value={
              payload.hashRibbon.ma30Eh !== null
                ? `${payload.hashRibbon.ma30Eh} EH`
                : "—"
            }
            badge={locale === "zh" ? payload.hashRibbon.statusZh : payload.hashRibbon.statusEn}
            badgeClass={zoneBadgeClass(payload.hashRibbon.score)}
          />
          <MiniRow
            label={locale === "zh" ? "Puell×" : "Puell×"}
            value={payload.puellMultiple.value !== null ? payload.puellMultiple.value.toFixed(2) : "—"}
            badge={locale === "zh" ? payload.puellMultiple.zoneZh : payload.puellMultiple.zoneEn}
            badgeClass={zoneBadgeClass(payload.puellMultiple.score)}
          />
        </div>
      )}
    </div>
  )
}
