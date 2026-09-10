"use client"

import { useState } from "react"

import forecastEvidenceJson from "@/public/research/forecast-evidence.json"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { formatPct } from "@/lib/research-evidence"
import type { ForecastResponse } from "@/lib/api-routes/crypto/forecast/route"

interface DriftModel { name: string; years: string; n: number; r2VsZero: number; corr: number | null; hit: number; topQuintile: number | null; bottomQuintile: number | null }
interface RegimeRow { state: string; pinballUnconditional: number; pinballConditional: number; improvement: number; n: number; nEff: number }
interface ForecastEvidence {
  data: { source: string; span: [string, string] }
  driftTest: { method: string; models: DriftModel[]; verdict: string }
  regimeTest: { method: string; byHorizon: Record<string, RegimeRow[]>; verdict: string }
  volModelSelection: { method: string; byHorizon: Record<string, { selectWinner: string; holdoutWinner: string; chosen: string; holdout: { model: string; qlike: number; coverage: Record<string, number>; pitKs: number }[] }>; verdict: string }
  literature: string[]
}
const E = forecastEvidenceJson as unknown as ForecastEvidence

const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(d))
const money = (v: number) => Math.round(v).toLocaleString()

export function ForecastDetail() {
  const [horizon, setHorizon] = useState<"30" | "60" | "90">("30")
  const { data, error } = usePersistentSWR<ForecastResponse>("crypto-forecast:BTC", "/api/crypto/forecast?ccy=BTC", jsonFetcher, { revalidateOnFocus: false })
  const live = data?.horizons[horizon]
  const last = live?.bands[live.bands.length - 1].quantiles

  return (
    <div className="space-y-5 text-xs">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 leading-relaxed">
        <p><b>这一页交付的是分布,不是点位。</b> 三项检验说明了为什么:方向与幅度在样本外不可预测(检验一);按市场状态调整分布反而更差(检验三);能被校准的只有宽度(检验二)。</p>
        <p className="mt-1 text-muted-foreground">检验结论冻结自 {E.data.source} {E.data.span[0]}→{E.data.span[1]};下方实时分布由同一引擎(lib/research/forecast.ts)在 OKX 日线上计算。</p>
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">实时分布</h3>
          {(["30", "60", "90"] as const).map((h) => (
            <button key={h} type="button" onClick={() => setHorizon(h)} className={`rounded-md border px-2 py-0.5 ${horizon === h ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{h} 日</button>
          ))}
        </div>
        {error ? <p className="text-muted-foreground">实时分布暂不可用:{String(error.message ?? error)}</p> : !live || !last ? <p className="text-muted-foreground">加载中…</p> : (
          <div className="grid gap-3 md:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-1 text-left font-medium">分位</th>{["0.05", "0.1", "0.25", "0.5", "0.75", "0.9", "0.95"].map((q) => <th key={q} className="text-right font-medium">{q === "0.5" ? "中位" : `${Number(q) * 100}%`}</th>)}</tr></thead>
                <tbody>
                  <tr className="border-b border-border/40"><td className="py-1">第 {live.horizon} 日({live.horizonEnd})</td>{["0.05", "0.1", "0.25", "0.5", "0.75", "0.9", "0.95"].map((q) => <td key={q} className={`text-right tabular-nums ${q === "0.5" ? "font-semibold" : ""}`}>{money(last[q])}</td>)}</tr>
                  <tr><td className="py-1 text-muted-foreground">相对现价</td>{["0.05", "0.1", "0.25", "0.5", "0.75", "0.9", "0.95"].map((q) => <td key={q} className="text-right tabular-nums text-muted-foreground">{formatPct(last[q] / live.spot - 1, 0)}</td>)}</tr>
                </tbody>
              </table>
              <table className="mt-3 w-full">
                <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-1 text-left font-medium">价位</th>{live.probabilities.map((p) => <th key={p.price} className="text-right font-medium">{(p.price / 1000).toFixed(1)}k</th>)}</tr></thead>
                <tbody><tr><td className="py-1">第 {live.horizon} 日收在此价之下</td>{live.probabilities.map((p) => <td key={p.price} className="text-right tabular-nums">{(p.below * 100).toFixed(0)}%</td>)}</tr></tbody>
              </table>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-muted-foreground">截至 {live.asOf} · 现价 {money(live.spot)}</div>
              <div className="mt-1">波动模型 <b>{live.volModel}</b> · σ {(live.sigma * 100).toFixed(0)}%</div>
              <div className="mt-1 text-muted-foreground">{live.selectedBecause}</div>
              <div className="mt-1 text-muted-foreground">样本 {live.sampleSize}(重叠窗口,有效约 {live.effectiveSampleSize})</div>
              <div className="mt-2 text-muted-foreground">备选 σ:{Object.entries(live.sigmaAlternatives).map(([k, v]) => `${k} ${(v! * 100).toFixed(0)}%`).join(" · ")}</div>
            </div>
          </div>
        )}
        {live && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full">
              <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-1 text-left font-medium">波动模型(留出窗)</th><th className="text-right font-medium" title="Patton 2011 稳健损失,越小越准">QLIKE</th><th className="text-right font-medium">覆盖 50/80/90%</th><th className="text-right font-medium" title="PIT 对均匀分布的 KS 统计量,越小越校准">PIT-KS</th><th className="text-right font-medium">n</th></tr></thead>
              <tbody>{live.calibration.map((c) => (
                <tr key={c.model} className={`border-b border-border/40 ${c.model === live.volModel ? "font-semibold" : ""}`}><td className="py-1">{c.model}{c.model === live.volModel ? " ★" : ""}</td><td className="text-right tabular-nums">{num(c.qlike, 3)}</td><td className="text-right tabular-nums">{(c.coverage.p50 * 100).toFixed(0)}/{(c.coverage.p80 * 100).toFixed(0)}/{(c.coverage.p90 * 100).toFixed(0)}%</td><td className="text-right tabular-nums">{num(c.pitKs, 3)}</td><td className="text-right tabular-nums">{c.n}</td></tr>
              ))}</tbody>
            </table>
            <p className="mt-1 text-muted-foreground">覆盖率目标即 50/80/90:高于目标 = 区间过宽(保守),低于 = 过窄(自信过头)。</p>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">检验一:方向与幅度能不能预测</h3>
        <p className="mb-2 text-muted-foreground">{E.driftTest.method}</p>
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-1 text-left font-medium">模型</th><th className="text-right font-medium">样本外年份</th><th className="text-right font-medium">n</th><th className="text-right font-medium" title="以零漂移为基准;负值 = 比什么都不预测更差">R² vs 零漂移</th><th className="text-right font-medium">相关</th><th className="text-right font-medium">方向命中</th><th className="text-right font-medium">预测最高1/5 实际</th><th className="text-right font-medium">最低1/5 实际</th></tr></thead>
          <tbody>{E.driftTest.models.map((m) => (
            <tr key={m.name} className="border-b border-border/40"><td className="py-1">{m.name}</td><td className="text-right">{m.years}</td><td className="text-right tabular-nums">{m.n}</td><td className={`text-right tabular-nums ${m.r2VsZero < 0 ? "text-emerald-400" : ""}`}>{num(m.r2VsZero, 3)}</td><td className="text-right tabular-nums">{num(m.corr)}</td><td className="text-right tabular-nums">{(m.hit * 100).toFixed(1)}%</td><td className="text-right tabular-nums">{m.topQuintile === null ? "—" : formatPct(m.topQuintile)}</td><td className="text-right tabular-nums">{m.bottomQuintile === null ? "—" : formatPct(m.bottomQuintile)}</td></tr>
          ))}</tbody>
        </table></div>
        <p className="mt-1"><b>结论</b> {E.driftTest.verdict}。</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">检验三:按市场状态调整分布有没有用</h3>
        <p className="mb-2 text-muted-foreground">{E.regimeTest.method}</p>
        <div className="overflow-x-auto"><table className="w-full">
          <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-1 text-left font-medium">状态变量</th>{Object.keys(E.regimeTest.byHorizon).map((h) => <th key={h} className="text-right font-medium">{h} 日改善</th>)}</tr></thead>
          <tbody>{E.regimeTest.byHorizon["30"].map((row, i) => (
            <tr key={row.state} className="border-b border-border/40"><td className="py-1">{row.state}</td>{Object.keys(E.regimeTest.byHorizon).map((h) => { const r = E.regimeTest.byHorizon[h][i]; return <td key={h} className={`text-right tabular-nums ${r.improvement < 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatPct(r.improvement)}</td> })}</tr>
          ))}</tbody>
        </table></div>
        <p className="mt-1"><b>结论</b> {E.regimeTest.verdict}。这就是因子图谱只做解释、不进分布的原因。</p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">检验二(冻结版):波动模型选择随市况翻转</h3>
        <p className="mb-2 text-muted-foreground">{E.volModelSelection.method}</p>
        <div className="grid gap-2 sm:grid-cols-3">{Object.entries(E.volModelSelection.byHorizon).map(([h, s]) => (
          <div key={h} className="rounded-lg border border-border p-2"><b>{h} 日</b> 选择窗赢家 {s.selectWinner} · 留出窗赢家 {s.holdoutWinner} → 采用 <b>{s.chosen}</b></div>
        ))}</div>
        <p className="mt-1"><b>结论</b> {E.volModelSelection.verdict}。</p>
      </section>

      <section className="text-muted-foreground">
        <b>文献</b>
        <ul className="mt-1 list-disc pl-5">{E.literature.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
    </div>
  )
}
