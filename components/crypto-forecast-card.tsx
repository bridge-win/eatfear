"use client"

import { useMemo, useState } from "react"
import { Info } from "lucide-react"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { cn } from "@/lib/utils"
import type { ForecastResponse } from "@/lib/api-routes/crypto/forecast/route"

const REFRESH_MS = 6 * 3600 * 1000
const HORIZONS = ["30", "60", "90"] as const

function money(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v.toFixed(2)
}

function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`
}

export function CryptoForecastCard({ instId, className }: { instId: string; className?: string }) {
  const ccy = instId.split("-")[0]
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>("30")
  const { data, error, isLoading } = usePersistentSWR<ForecastResponse>(
    `crypto-forecast:${ccy}`,
    `/api/crypto/forecast?ccy=${encodeURIComponent(ccy)}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS, revalidateOnFocus: false },
  )

  const view = useMemo(() => {
    const h = data?.horizons[horizon]
    if (!h) return null
    const last = h.bands[h.bands.length - 1].quantiles
    const calib = h.calibration.find((c) => c.model === h.volModel)
    return { h, last, calib }
  }, [data, horizon])

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">未来区间</h3>
            <HoverCard openDelay={100}>
              <HoverCardTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80 text-xs leading-relaxed">
                <p className="mb-1 font-medium">这张卡回答的不是「涨还是跌」,是「合理范围有多宽」。</p>
                <p className="text-muted-foreground">
                  方向在样本外不可预测(多因子模型 R² 为负、方向命中不超过永远看多),所以中位数就是当前价。
                  宽度来自波动率模型,形状取历史标准化收益的经验分位,保留胖尾。留出窗覆盖率是它历史上的校准记录。
                </p>
                <a href="/crypto/research?tab=forecast" className="mt-2 inline-block underline underline-offset-2">
                  查看校准与检验
                </a>
              </HoverCardContent>
            </HoverCard>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data ? `截至 ${data.asOf} · 现价 ${money(data.spot)}` : "校准分布"}
          </p>
        </div>
        <div className="flex gap-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px] tabular-nums",
                horizon === h ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
            >
              {h}日
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-muted-foreground">预测暂不可用:{String(error.message ?? error)}</p>
      ) : isLoading || !view ? (
        <p className="mt-3 text-xs text-muted-foreground">正在拉取日线并校准…</p>
      ) : (
        <div className="mt-3">
          <RangeBar spot={view.h.spot} q={view.last} />
          <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px] tabular-nums">
            {(["0.05", "0.25", "0.5", "0.75", "0.95"] as const).map((q) => (
              <div key={q}>
                <div className="text-muted-foreground">{q === "0.5" ? "中位" : `${Number(q) * 100}%`}</div>
                <div className={q === "0.5" ? "font-semibold" : ""}>{money(view.last[q])}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              σ {pct(view.h.sigma)} · {view.h.volModel} · 有效样本 {view.h.effectiveSampleSize}
            </span>
            {view.calib ? (
              <span title="名义 50/80/90% 区间在留出窗内实际覆盖的比例;高于名义 = 偏保守,低于 = 过度自信">
                留出窗覆盖 {pct(view.calib.coverage.p50)}/{pct(view.calib.coverage.p80)}/{pct(view.calib.coverage.p90)}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function RangeBar({ spot, q }: { spot: number; q: Record<string, number> }) {
  const lo = q["0.05"], hi = q["0.95"]
  const span = hi - lo || 1
  const x = (v: number) => `${(((v - lo) / span) * 100).toFixed(1)}%`
  const w = (a: number, b: number) => `${(((b - a) / span) * 100).toFixed(1)}%`
  return (
    <div className="relative h-5">
      <div className="absolute inset-y-2 rounded-full bg-primary/10" style={{ left: 0, width: "100%" }} />
      <div className="absolute inset-y-2 rounded-full bg-primary/25" style={{ left: x(q["0.1"]), width: w(q["0.1"], q["0.9"]) }} />
      <div className="absolute inset-y-1.5 rounded-full bg-primary/50" style={{ left: x(q["0.25"]), width: w(q["0.25"], q["0.75"]) }} />
      <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: x(spot) }} title="当前价 = 中位" />
    </div>
  )
}
