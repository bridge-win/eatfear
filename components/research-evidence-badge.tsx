"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { badgeForSignal, evidence, formatPct, type EvidenceTone, type StrategyEvidence } from "@/lib/research-evidence"

const TONE_CLASS: Record<EvidenceTone, string> = {
  survived: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  failed: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  negative: "border-emerald-600/40 bg-emerald-600/10 text-emerald-300",
  none: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
}

/** Human labels for the signal families a card can be read as. */
export const SIGNAL_LABELS: Record<string, string> = {
  capitulation: "恐慌投降(量×情绪)",
  volumeSpike: "放量冲击",
  fearGreed: "恐惧贪婪水平",
  sentiment: "情绪转向",
  meanReversion: "均值回归",
  regime: "市场状态过滤",
  trend: "趋势跟随",
  trendStrength: "趋势强度",
  momentum: "时间序列动量",
  breakout: "突破",
  volatility: "波动率择时",
  cyclePosition: "周期位置",
  valuation: "估值锚",
  volume: "成交量",
  moneyFlow: "资金流",
}

function StrategyRow({ strategy }: { strategy: StrategyEvidence }) {
  const wf = strategy.robustness.walkForward
  return (
    <div className="border-b border-border/40 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{strategy.name}</span>
        <span className={strategy.oos.total > 0 ? "tabular-nums text-rose-400" : "tabular-nums text-emerald-400"}>
          {formatPct(strategy.oos.total)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
        <span>夏普 {strategy.oos.sharpe.toFixed(2)}</span>
        <span>回撤 {formatPct(strategy.oos.maxdd, 0)}</span>
        <span>{strategy.oos.trades} 笔</span>
        {wf.n_windows ? <span>滚动前推 {wf.win_windows}/{wf.n_windows} 窗为正</span> : null}
        {strategy.robustness.concentration ? <span>剔除最赚 3 笔后 {formatPct(strategy.robustness.concentration.drop3)}</span> : null}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">判定:{strategy.verdict.join("、")}</div>
    </div>
  )
}

/**
 * Shows what a signal actually did out-of-sample, so a live reading is never read in
 * isolation. When a card can be interpreted as more than one signal family (a black-swan
 * score is both a capitulation read and a volume-shock read), the badge exposes a
 * dropdown rather than silently picking one.
 */
export function EvidenceBadge({ signalIds, className }: { signalIds: string | string[]; className?: string }) {
  const ids = useMemo(() => (Array.isArray(signalIds) ? signalIds : [signalIds]), [signalIds])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(ids[0])
  const badge = badgeForSignal(active)
  const window = `${evidence.windows.strategies.test[0]} → ${evidence.windows.strategies.test[1]}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={className} aria-label={`查看 ${SIGNAL_LABELS[active] ?? active} 的历史兑现记录`}>
          <Badge variant="outline" className={`cursor-pointer text-[10px] font-normal ${TONE_CLASS[badge.tone]}`}>
            历史:{badge.label}
            {ids.length > 1 ? ` · ${ids.length} 种解读` : ""}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] text-xs">
        <div className="mb-2">
          <div className="font-medium">历史兑现记录</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            样本外 {window},含 {(evidence.windows.strategies.fee * 10000).toFixed(0)}bp 单边手续费,参数在窗口开始前冻结。
          </div>
        </div>
        {ids.length > 1 ? (
          <label className="mb-2 block text-[11px] text-muted-foreground">
            这张卡可以读成
            <select value={active} onChange={(e) => setActive(e.target.value)} className="ml-1 rounded border border-border bg-transparent px-1 py-0.5 text-xs text-foreground">
              {ids.map((id) => (
                <option key={id} value={id}>
                  {SIGNAL_LABELS[id] ?? id}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="mb-2 text-[11px] text-muted-foreground">解读:{SIGNAL_LABELS[active] ?? active}</div>
        )}
        <p className="mb-2 leading-relaxed text-muted-foreground">{badge.detail}</p>
        {badge.strategies.length > 0 ? (
          <div className="max-h-64 overflow-y-auto">
            {badge.strategies.slice(0, 6).map((s) => (
              <StrategyRow key={s.id} strategy={s} />
            ))}
          </div>
        ) : null}
        <div className="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          全部 {evidence.summary.nStrategies} 个策略中 {evidence.summary.nSurvivors} 个未被三项检验证伪;买入持有同期 {formatPct(evidence.benchmark.oos.total)}。
          <a href="/crypto/research" className="ml-1 underline underline-offset-2">完整证据库</a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
