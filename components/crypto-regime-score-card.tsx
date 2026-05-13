"use client"

import { Info } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import type { RegimeSignalBand } from "@/lib/crypto-regime-score"

const REFRESH_MS = 60 * 1000

const MODEL_INFO_DESCRIPTION = [
  "多因子 + 权重合成（总分 100）；所有分项均来自可追溯的公开市场 API（见 `/api/crypto/regime-score` 的 `upstream` 字段）。",
  "",
  "CoinGlass：`COINGLASS_API_KEY`（Header `CG-API-KEY`）——现货 BTC ETF 日度净流入；CEX BTC / USDT(ETH)+USDC 持仓加权 7 日变动。",
  "",
  "① 资金流（25%）：DefiLlama 稳定币总市值 7 日变动；CoinGlass ETF；CEX 稳定币库存。",
  "② 杠杆情绪（25%）：OKX BTC 永续费率、Rubik OI-USD（1h）、多空账户比及风险降权。",
  "③ 链上周期（20%）：Blockchain.info BTCUSD 日线 vs SMA200；CoinGecko 距 ATH%；CoinGlass CEX BTC；mempool.space 算力。",
  "④ 市场结构（15%）：OKX Taker、盘口失衡、4H 量比、24h 涨跌。",
  "⑤ 期权风险（15%）：Deribit DVOL + 期权 7 日 Put/Call。",
  "",
  "关键规则：Funding 极端、OI 暴拉时扣分；稳定币扩张且 ETF 周势能显著为正时可小幅加分。分数带：75–100 强多 … 0–30 强空。",
  "",
  "面板约每 60 秒刷新。不构成投资建议。",
].join("\n")

interface RegimeSummary {
  total: number
  rawWeighted: number
  band: RegimeSignalBand
  signalZh: string
}

interface RegimeFactorRow {
  id: string
  label: string
  score: number
  weighted: number
  lines: string[]
}

interface RegimePayload {
  updatedAt: number
  summary: RegimeSummary
  penaltiesZh: string[]
  boostsZh: string[]
  factors: RegimeFactorRow[]
  error?: string
}

function bandStyles(band: RegimeSignalBand) {
  switch (band) {
    case "strong_bull":
      return "text-emerald-600 dark:text-emerald-400"
    case "bull":
      return "text-teal-600 dark:text-teal-400"
    case "neutral":
      return "text-amber-600 dark:text-amber-400"
    case "bear":
      return "text-orange-600 dark:text-orange-400"
    default:
      return "text-red-600 dark:text-red-400"
  }
}

async function fetchRegimePayload(): Promise<RegimePayload> {
  const response = await fetch("/api/crypto/regime-score")
  const json = (await response.json()) as RegimePayload & { error?: string }
  if (!response.ok || !json.summary) throw new Error(json.error ?? "Regime score unavailable")
  return json
}

function RegimeDetailPanel({
  loading,
  error,
  payload,
  updatedHint,
}: {
  loading: boolean
  error: string | null
  payload: RegimePayload | null
  updatedHint: string
}) {
  return (
    <div className="space-y-2.5 px-3 py-2.5 text-left">
      <div>
        <p className="text-xs font-semibold tracking-tight text-foreground">BTC 多时框架</p>
        {loading ? (
          <p className="mt-1 text-[11px] text-muted-foreground">载入中…</p>
        ) : error ? (
          <p className="mt-1 text-[11px] text-destructive">{error}</p>
        ) : payload ? (
          <div className="mt-1 space-y-1.5">
            <p className={cn("text-xs font-medium leading-snug", bandStyles(payload.summary.band))}>{payload.summary.signalZh}</p>
            <p className="text-[10px] text-muted-foreground">
              <span className="tabular-nums font-medium text-foreground/90">{Math.round(payload.summary.total)}</span>
              {" / 100"}
              {updatedHint ? ` · ${updatedHint}` : ""}
              {` · 加权原始分 ${payload.summary.rawWeighted.toFixed(1)}`}
            </p>
            {payload.penaltiesZh.length ? (
              <p className="rounded bg-orange-950/25 px-1.5 py-1 text-[10px] text-orange-900 dark:text-orange-200">
                ⚠ {payload.penaltiesZh.join(" ")}
              </p>
            ) : null}
            {payload.boostsZh.length ? (
              <p className="rounded bg-teal-950/20 px-1.5 py-1 text-[10px] text-teal-900 dark:text-teal-100">
                ↑ {payload.boostsZh.join(" ")}
              </p>
            ) : null}
            <p className="pt-0.5 text-[10px] font-medium text-foreground">分项得分</p>
            <dl className="space-y-2">
              {payload.factors.map((f) => (
                <div key={f.id}>
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-0.5">
                    <dt className="text-[10px] text-muted-foreground">{f.label}</dt>
                    <dd className="text-[11px] font-semibold tabular-nums">
                      {f.score.toFixed(0)}
                      <span className="font-normal text-muted-foreground"> → {f.weighted.toFixed(1)}</span>
                    </dd>
                  </div>
                  <dd className="mt-1 space-y-0.5 text-[10px] leading-snug text-muted-foreground">
                    {f.lines.map((line, i) => (
                      <div key={`${f.id}-L${i}`}>{line}</div>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <details className="mt-2 rounded-md border border-border/55 bg-muted/20 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer select-none px-0 py-1 text-sm font-semibold text-foreground hover:text-foreground/90">
          评分模型说明
        </summary>
        <div className="pb-1 pt-1">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{MODEL_INFO_DESCRIPTION}</p>
          <p className="mt-2 text-[10px] text-muted-foreground/80">
            数据源：OKX / DefiLlama / CoinGlass / Blockchain.info / mempool.space · CoinGecko · Deribit
          </p>
        </div>
      </details>
    </div>
  )
}

export function CryptoRegimeScoreCard({ className }: { className?: string }) {
  const [payload, setPayload] = useState<RegimePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const next = await fetchRegimePayload()
      setPayload(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const updatedHint = useMemo(() => {
    if (!payload?.updatedAt) return ""
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(payload.updatedAt)
    } catch {
      return ""
    }
  }, [payload?.updatedAt])

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-0 rounded-md border bg-card/95 pl-1 pr-0.5 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div
        className="flex min-w-[1.75rem] items-center justify-center px-0.5"
        aria-label={
          loading
            ? "BTC 多时框架指数载入中"
            : error
              ? "BTC 多时框架指数不可用，悬停旁侧信息图标查看原因"
              : payload
                ? `BTC 多时框架指数 ${Math.round(payload.summary.total)}`
                : "BTC 多时框架指数"
        }
      >
        <span
          className={cn(
            "text-[1.35rem] font-bold tabular-nums leading-none md:text-2xl",
            error ? "text-muted-foreground" : payload ? bandStyles(payload.summary.band) : "text-foreground",
          )}
        >
          {loading ? "…" : error ? "—" : payload ? Math.round(payload.summary.total) : "—"}
        </span>
      </div>

      <HoverCard openDelay={120} closeDelay={180}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label="悬停或聚焦查看：BTC 多时框架信号、分项与模型说明"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground",
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
          className="max-h-[min(520px,_72vh)] w-[min(22rem,_92vw)] overflow-y-auto p-0"
        >
          <RegimeDetailPanel loading={loading} error={error} payload={payload} updatedHint={updatedHint} />
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}
