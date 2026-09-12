"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { useI18n } from "@/lib/i18n"
import { HORIZONS, PLAN_POLICY, type Horizon, type PlanFeature, type planDecision } from "@/lib/crypto-trade-plan"
import validation from "@/public/research/btc-plan-validation.json"

interface LivePlan {
  horizon: Horizon
  market?: string
  source?: string
  error?: string
  feature?: PlanFeature
  decision?: ReturnType<typeof planDecision>
}
interface PlanPayload { ccy: string; asOf: number; plans: LivePlan[] }
const fetcher = async (url: string): Promise<PlanPayload> => {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? "market_history_unavailable")
  return body
}
const money = (n: number | undefined) => n === undefined ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)
const percent = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`

export function CryptoTradePlanPanel({ ccy }: { ccy: string }) {
  const { locale } = useI18n()
  const zh = locale === "zh"
  const { data, error, isLoading, mutate, isValidating } = useSWR<PlanPayload>(`/api/crypto/trade-plan?ccy=${encodeURIComponent(ccy)}`, fetcher, { refreshInterval: 60_000, dedupingInterval: 30_000, revalidateOnFocus: true, keepPreviousData: false })
  const [now, setNow] = useState(0)
  const [mobileHorizon, setMobileHorizon] = useState<Horizon>("2d")
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer) }, [])
  const staleResponse = data && now > data.asOf + 180_000
  const names = { "2d": zh ? "未来两天" : "Next 2 days", "2w": zh ? "未来两周" : "Next 2 weeks", "2m": zh ? "未来两个月" : "Next 2 months" }
  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-label={zh ? "多周期交易计划" : "Multi-horizon trade plan"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">{ccy} · {zh ? "交易计划" : "Trade plan"}</h2>
          <span className="text-xs text-amber-600 dark:text-amber-400">{zh ? "研究模型 · 尚未通过样本外验证" : "Research model · not validated out of sample"}</span>
        </div>
        <button type="button" onClick={() => void mutate()} disabled={isValidating} className="min-h-8 rounded px-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">{isValidating ? (zh ? "更新中…" : "Updating…") : zh ? "刷新" : "Refresh"}</button>
      </div>
      <div className="grid grid-cols-3 gap-1 border-b p-1 lg:hidden" aria-label={zh ? "选择交易周期" : "Choose horizon"}>
        {(Object.keys(HORIZONS) as Horizon[]).map((horizon) => <button key={horizon} type="button" aria-pressed={mobileHorizon === horizon} onClick={() => setMobileHorizon(horizon)} className={`min-h-9 rounded text-sm ${mobileHorizon === horizon ? "bg-muted font-semibold" : "text-muted-foreground"}`}>{names[horizon]}</button>)}
      </div>
      <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {(Object.keys(HORIZONS) as Horizon[]).map((horizon) => {
          const p = data?.ccy === ccy ? data.plans.find((item) => item.horizon === horizon) : undefined
          const f = p?.feature, d = p?.decision, cfg = HORIZONS[horizon]
          const unavailable = Boolean(error || p?.error || staleResponse || d?.stale || d?.blocked)
          const status = !f ? (isLoading ? (zh ? "读取行情…" : "Loading…") : (zh ? "数据不可用" : "Data unavailable")) : unavailable ? (zh ? "数据受限 · 等待" : "Data limited · wait") : d?.action === "reduce" ? (zh ? "结构走弱 · 减仓观察" : "Weakening · consider reducing") : d?.action === "buy" ? (zh ? "条件触发 · 仅模拟观察" : "Setup triggered · paper only") : (zh ? "等待买入确认" : "Wait for confirmation")
          const evidence = validation.results.find((r) => r.horizon === horizon)
          return <article key={horizon} className={`min-w-0 space-y-2 p-3 ${mobileHorizon === horizon ? "block" : "hidden lg:block"}`}>
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{names[horizon]}</h3><span className="text-xs text-muted-foreground">{cfg.interval.toUpperCase()} · {zh ? "现货" : "spot"}</span></div>
            <div className="flex items-baseline justify-between gap-2"><strong className="text-sm text-foreground">{status}</strong><span className="font-mono text-sm tabular-nums">{f ? `${f.score >= 0 ? "+" : ""}${f.score.toFixed(0)}` : "—"}<span className="text-xs text-muted-foreground"> / 100</span></span></div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">{zh ? "收盘价" : "Close"}</span><p className="mt-0.5 font-mono text-sm">${money(f?.price)}</p></div>
              <div><span className="text-muted-foreground">{zh ? "支撑 / 跌破关注" : "Support"}</span><p className="mt-0.5 font-mono text-sm">${money(f?.support)}</p></div>
              <div><span className="text-muted-foreground">{zh ? "突破观察线" : "Breakout level"}</span><p className="mt-0.5 font-mono text-sm">${money(f?.resistance)}</p></div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{zh ? `趋势 ${cfg.weights.trend}% · 结构 ${cfg.weights.structure}% · 成交流 ${cfg.weights.flow}%` : `Trend ${cfg.weights.trend}% · Structure ${cfg.weights.structure}% · Flow ${cfg.weights.flow}%`}{f ? ` · ${zh ? "覆盖" : "coverage"} ${f.coverage}%` : ""}</p>
            {f && <p className="text-xs text-muted-foreground">VWAP ${money(f.vwap)} · RSI {f.rsi.toFixed(0)} · ATR ${money(f.atr)}</p>}
            <details className="group text-xs">
              <summary className="cursor-pointer py-1 font-medium text-muted-foreground hover:text-foreground">{zh ? "触发、退出与验证" : "Triggers, exits & evidence"}</summary>
              <div className="mt-2 space-y-2 leading-relaxed">
                <p>{zh ? "买入观察：评分≥25，突破放量 / 回踩转强 / CVD 底背离后收回 VWAP，且价格不高于 EMA20 + 2ATR。MACD、RSI 不重复加权。" : "Watch entry: score ≥25 plus a volume breakout, confirmed pullback or CVD divergence with VWAP reclaim. Avoid chasing above EMA20 + 2ATR. MACD/RSI receive no duplicate vote."}</p>
                <p>{zh ? `退出：评分≤−15、顶背离或持有${horizon === "2d" ? "48小时" : horizon === "2w" ? "14天" : "60天"}；初始止损 ${cfg.stopAtr}ATR，止盈 2.5R。` : `Exit at score ≤−15, bearish divergence or ${cfg.holdBars} bars. Initial stop ${cfg.stopAtr}ATR; target 2.5R.`}</p>
                {d && f && <p>{zh ? "以当前收盘价试算（非挂单）" : "Illustration at current close (not an order)"}：{zh ? "止损" : "stop"} ${money(d.stop)} · {zh ? "目标" : "target"} ${money(d.target)} · {zh ? "仓位上限" : "allocation cap"} {(d.positionFraction * 100).toFixed(1)}% · {zh ? "账户风险" : "equity risk"} {PLAN_POLICY.riskFraction * 100}%</p>}
                {evidence && <p className="rounded bg-muted p-2">BTC {zh ? "历史样本外" : "historical holdout"}：{percent(evidence.standard.netReturn)} · {zh ? "双倍成本" : "double costs"} {percent(evidence.doubleCost.netReturn)} · {evidence.standard.trades} {zh ? "笔交易；不支持实盘有效性结论。" : "trades; efficacy is not established."}{ccy !== "BTC" && (zh ? " 当前资产未回测。" : " This asset has not been tested.")}</p>}
                <a href="/research/btc-plan-validation.json" target="_blank" rel="noreferrer" className="underline underline-offset-2">{zh ? "完整回测记录与数据出处" : "Full backtest and provenance"}</a>
                {p?.source && <p><a href={p.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">{p.market}</a> · {zh ? "已完成K线" : "closed candle"} {f ? new Date(f.time + cfg.stepMs).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—"}</p>}
              </div>
            </details>
          </article>
        })}
      </div>
    </section>
  )
}
