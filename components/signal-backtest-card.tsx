"use client"

import { useState } from "react"

import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { cn } from "@/lib/utils"

interface Bucket { days: number; samples: number; medianPct: number | null; hitRatePct: number | null; maxAdverseExcursionPct: number | null }
interface Payload {
  ccy: string
  signal: "black-swan" | "euphoria"
  caveats?: string[]
  summary: { occurrences: number; baselineSamples: number; buckets: Bucket[] }
  recentOccurrences: { time: number; direction: "long" | "short"; score: number }[]
}

const fmt = (v: number | null, suffix = "%") => (v === null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}${suffix}`)

/**
 * Replaces the raw JSON link: shows what this event type did afterwards, and says
 * plainly that the numbers exclude costs and overlap heavily.
 */
export function SignalBacktestCard({ ccy, signal = "black-swan", className }: { ccy: string; signal?: "black-swan" | "euphoria"; className?: string }) {
  const [open, setOpen] = useState(false)
  const { data, error } = usePersistentSWR<Payload>(
    `signal-backtest:${ccy}:${signal}`,
    open ? `/api/crypto/signal-backtest?ccy=${encodeURIComponent(ccy)}&signal=${signal}` : null,
    jsonFetcher,
    { revalidateOnFocus: false },
  )
  const label = signal === "black-swan" ? "黑天鹅事件" : "欣快事件"
  return (
    <div className={cn("rounded-md border border-border", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
        <span>{label}历史前瞻 {open ? "▾" : "▸"}</span>
        <span className="text-[10px]">事件统计,未计成本</span>
      </button>
      {open && (
        <div className="border-t border-border px-2 py-2 text-xs">
          {error ? <p className="text-muted-foreground">不可用:{String(error.message ?? error)}</p> : !data ? <p className="text-muted-foreground">加载中…</p> : (
            <>
              <p className="mb-1 text-muted-foreground">{data.summary.occurrences} 次事件,基线样本 {data.summary.baselineSamples}</p>
              <table className="w-full">
                <thead className="text-muted-foreground"><tr><th className="text-left font-medium">之后</th><th className="text-right font-medium">样本</th><th className="text-right font-medium">收益中位</th><th className="text-right font-medium">命中率</th><th className="text-right font-medium">最大不利</th></tr></thead>
                <tbody>{data.summary.buckets.map((b) => (
                  <tr key={b.days}><td>{b.days} 日</td><td className="text-right tabular-nums">{b.samples}</td><td className={`text-right tabular-nums ${(b.medianPct ?? 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>{fmt(b.medianPct)}</td><td className="text-right tabular-nums">{b.hitRatePct === null ? "—" : `${b.hitRatePct.toFixed(0)}%`}</td><td className="text-right tabular-nums">{fmt(b.maxAdverseExcursionPct)}</td></tr>
                ))}</tbody>
              </table>
              {data.caveats?.length ? <ul className="mt-2 list-disc pl-4 text-[11px] text-muted-foreground">{data.caveats.map((c) => <li key={c}>{c}</li>)}</ul> : null}
              <a href="/crypto/research" className="mt-2 inline-block text-[11px] underline underline-offset-2">要看含成本、参数隔离的账户回测 → 研究工作台</a>
            </>
          )}
        </div>
      )}
    </div>
  )
}
